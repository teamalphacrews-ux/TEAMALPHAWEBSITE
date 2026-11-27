const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream'),jwt=require('jsonwebtoken');
test.beforeEach(require('./sessionFixture'));
const User=require('../models/User'),Finance=require('../models/Finance'),Receipt=require('../models/FinanceReceipt'),router=require('../routes/receiptRoutes');
const userId='507f1f77bcf86cd799439011',id='507f1f77bcf86cd799439012';process.env.JWT_SECRET='receipt-test-only';
test.beforeEach(t=>t.mock.method(User,'findById',()=>({select:async()=>({_id:userId,role:'admin'})})));
function dispatch(req){return new Promise((resolve,reject)=>router.handle(req,{statusCode:200,headers:{},set(k,v){if(typeof k==='object')Object.assign(this.headers,k);else this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(body){resolve({status:this.statusCode,body,headers:this.headers});},send(body){resolve({status:this.statusCode,body,headers:this.headers});},sendStatus(n){resolve({status:n});}},e=>e?reject(e):resolve({status:404})));}
const auth=()=>({authorization:'Bearer '+jwt.sign({user:{id:userId,role:'admin'}},process.env.JWT_SECRET)});
test('receipt bytes require sign-in and an existing expense',async t=>{assert.equal((await dispatch({method:'GET',url:'/ledger/'+id+'/receipt',headers:{},header:()=>undefined})).status,401);t.mock.method(Finance,'exists',async()=>null);let touched=false;t.mock.method(Receipt,'findOne',()=>{touched=true;});assert.equal((await dispatch({method:'GET',url:'/ledger/'+id+'/receipt',headers:auth(),header:()=>undefined})).status,404);assert.equal(touched,false);});
test('receipt reads are private binary responses with no-store headers',async t=>{t.mock.method(Finance,'exists',async()=>({_id:id}));const data=Buffer.from([255,216,255,224,0,16,255,217]);t.mock.method(Receipt,'findOne',()=>({select:async()=>({mimeType:'image/jpeg',data})}));const result=await dispatch({method:'GET',url:'/ledger/'+id+'/receipt',headers:auth(),header:()=>undefined});assert.equal(result.status,200);assert.deepEqual(result.body,data);assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(result.headers['X-Content-Type-Options'],'nosniff');});
const jpeg = Buffer.from([255,216,255,224,0,16,255,217]);
function receiptUpload() {
  const boundary = 'receipt-boundary';
  const body = Buffer.concat([
    Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="receipt"; filename="receipt.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'),
    jpeg, Buffer.from('\r\n--'+boundary+'--\r\n')
  ]);
  return Object.assign(Readable.from([body]), {
    method:'POST', url:'/ledger/'+id+'/receipt',
    headers:{...auth(),'content-type':'multipart/form-data; boundary='+boundary,'content-length':String(body.length)},
    header:()=>undefined
  });
}
test('multipart receipt upload writes metadata and private bytes in one transaction', async t => {
  const session = {};
  t.mock.method(Finance.db, 'transaction', async write => write(session));
  t.mock.method(Finance, 'exists', async () => ({_id:id}));
  let file, metadata;
  t.mock.method(Finance, 'updateOne', async (filter, update, options) => {
    assert.deepEqual(filter, {_id:id, type:'expense'});
    assert.equal(options.session, session);
    metadata = update.$set.receipt;
    return {matchedCount:1};
  });
  t.mock.method(Receipt, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, {financeId:id});
    assert.equal(options.session, session);
    assert.equal(options.upsert, true);
    file = update.$set;
  });
  const result = await dispatch(receiptUpload());
  assert.equal(result.status, 201);
  assert.deepEqual(file.data, jpeg);
  assert.equal(file.uploadedBy, userId);
  assert.equal(metadata.bytes, jpeg.length);
  assert.equal(result.body.data, undefined);
});
test('receipt upload handles an expense removed before the transaction without saving a file', async t => {
  t.mock.method(Finance, 'exists', async () => ({_id:id}));
  t.mock.method(Finance.db, 'transaction', async write => write({}));
  t.mock.method(Finance, 'updateOne', async () => ({matchedCount:0}));
  const fileWrite = t.mock.method(Receipt, 'findOneAndUpdate', async () => {});
  assert.equal((await dispatch(receiptUpload())).status, 404);
  assert.equal(fileWrite.mock.callCount(), 0);
});
test('receipt write failure aborts the transaction before reporting success', async t => {
  let errorSeenByTransaction;
  t.mock.method(Finance, 'exists', async () => ({_id:id}));
  t.mock.method(Finance.db, 'transaction', async write => {
    try { return await write({}); }
    catch (error) { errorSeenByTransaction = error; throw error; }
  });
  t.mock.method(Finance, 'updateOne', async () => ({matchedCount:1}));
  const error = new Error('Synthetic receipt store failure');
  t.mock.method(Receipt, 'findOneAndUpdate', async () => { throw error; });
  assert.equal((await dispatch(receiptUpload())).status, 503);
  assert.equal(errorSeenByTransaction, error);
});
