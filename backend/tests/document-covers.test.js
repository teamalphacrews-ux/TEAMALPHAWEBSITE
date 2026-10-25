const test = require("node:test");
test.beforeEach(require('./sessionFixture'));
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const adminUserId = "507f1f77bcf86cd79943fd01";
const clientUserId = "507f1f77bcf86cd79943fd02";
// Authorization uses the saved account role, independent of JWT role claims.
test.beforeEach((t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => id === adminUserId ? { _id: id, role: "admin" }
      : id === clientUserId ? { _id: id, role: "client" } : null,
  }));
});
const {Readable} = require("node:stream");
const cloudinary = require("cloudinary").v2;
const router = require("../routes/documentCoverRoutes");
const {validateCover,uploadCover,cloudinaryReady} = router;
const png = Buffer.alloc(33);
Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
png.write("IHDR",12,"ascii");png.writeUInt32BE(1200,16);png.writeUInt32BE(800,20);
const jpeg = Buffer.from([255,216,255,224,0,16,255,217]);
const webp = Buffer.alloc(20);
webp.write("RIFF",0,"ascii");webp.writeUInt32LE(12,4);webp.write("WEBP",8,"ascii");webp.write("VP8 ",12,"ascii");
test("cover validator requires image signatures to match the claimed MIME type", () => {
  for (const [mimetype,buffer] of [["image/png",png],["image/jpeg",jpeg],["image/webp",webp]]) assert.equal(validateCover({mimetype,buffer}).buffer,buffer);
  for (const file of [null,{mimetype:"image/png",buffer:jpeg},{mimetype:"image/jpeg",buffer:Buffer.from("<script>evil</script>")},{mimetype:"image/svg+xml",buffer:Buffer.from("<svg></svg>")},{mimetype:"image/webp",buffer:webp.subarray(0,19)}]) assert.throws(() => validateCover(file),{status:400});
});
test("cover validator rejects oversized files and oversized PNG dimensions", () => {
  assert.throws(() => validateCover({mimetype:"image/jpeg",buffer:Buffer.alloc(8*1024*1024+1)}),{status:413});
  const huge=Buffer.from(png);huge.writeUInt32BE(20000,16);huge.writeUInt32BE(20000,20);
  assert.throws(() => validateCover({mimetype:"image/png",buffer:huge}),{status:400});
});
test("missing Cloudinary configuration cannot return a fake uploaded image", async () => {
  assert.equal(cloudinaryReady({}),false);
  await assert.rejects(uploadCover({mimetype:"image/png",buffer:png},{env:{}}),{status:503});
});
test("cover upload restricts provider folder and accepts only its secure result", async () => {
  let options,bytes;
  const client={config(){},uploader:{upload_stream(value,done){options=value;return {end(data){bytes=data;done(null,{secure_url:"https://res.cloudinary.com/sample/image/upload/cover.webp",public_id:"teamalpha/document-covers/cover",width:1200,height:800});}};}}};
  const result=await uploadCover({mimetype:"image/png",buffer:png},{client,env:{CLOUDINARY_CLOUD_NAME:"test",CLOUDINARY_API_KEY:"test",CLOUDINARY_API_SECRET:"test"}});
  assert.equal(options.folder,"teamalpha/document-covers");
  assert.equal(options.resource_type,"image");
  assert.equal(options.use_filename,false);
  assert.equal(bytes,png);
  assert.equal(result.width,1200);
  assert.match(result.url,/^https:\/\//);
});
test("provider failures and insecure URLs never leak provider diagnostics", async () => {
  for (const response of [{error:Error("sensitive provider diagnostic")},{result:{secure_url:"http://example.com/image"}}]) {
    const client={config(){},uploader:{upload_stream(_options,done){return {end(){done(response.error,response.result);}};}}};
    await assert.rejects(uploadCover({mimetype:"image/jpeg",buffer:jpeg},{client,env:{CLOUDINARY_CLOUD_NAME:"test",CLOUDINARY_API_KEY:"test",CLOUDINARY_API_SECRET:"test"}}),error => error.status===502 && !error.message.includes("sensitive"));
  }
});
test("document cover upload rejects missing authentication and client roles before multipart parsing", async () => {
  process.env.JWT_SECRET="cover-upload-test-only-secret";
  const dispatch=role => new Promise((resolve,reject) => {
    const token=role?jwt.sign({user:{id:role === "admin" ? adminUserId : clientUserId,role}},process.env.JWT_SECRET):null;
    router.handle({method:"POST",url:"/document-covers",headers:token?{authorization:"Bearer "+token}:{},header:()=>undefined},{statusCode:200,status(n){this.statusCode=n;return this;},json(body){resolve({status:this.statusCode,body});}},error=>error?reject(error):resolve({status:404}));
  });
  assert.equal((await dispatch()).status,401);
  assert.equal((await dispatch("client")).status,403);
});
test("authenticated multipart image upload reaches the provider and returns a secure URL", async t => {
  const environment = {JWT_SECRET:"multipart-cover-test-only",CLOUDINARY_CLOUD_NAME:"test",CLOUDINARY_API_KEY:"test",CLOUDINARY_API_SECRET:"test"};
  const originalEnvironment = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(cloudinary,"config",() => ({}));
  let uploaded;
  t.mock.method(cloudinary.uploader,"upload_stream",(_options,done) => ({end(data){uploaded=data;done(null,{secure_url:"https://res.cloudinary.com/test/image/upload/cover.png",public_id:"cover",width:1200,height:800});}}));
  const boundary="cover-test-boundary";
  const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n`),png,Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const signed=jwt.sign({user:{id:adminUserId,role:"admin"}},process.env.JWT_SECRET);
  const req=Readable.from([body]);
  Object.assign(req,{method:"POST",url:"/document-covers",headers:{"content-type":`multipart/form-data; boundary=${boundary}`,"content-length":String(body.length),authorization:"Bearer "+signed},header:()=>undefined});
  const result=await new Promise((resolve,reject) => router.handle(req,{statusCode:200,status(n){this.statusCode=n;return this;},json(body){resolve({status:this.statusCode,body});}},error=>error?reject(error):resolve({status:404})));
  assert.equal(result.status,201);
  assert.deepEqual(uploaded,png);
  assert.match(result.body.url,/^https:\/\//);
});
