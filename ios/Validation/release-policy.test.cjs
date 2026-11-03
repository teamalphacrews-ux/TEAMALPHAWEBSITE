const test=require('node:test'),assert=require('node:assert/strict');
const {validateConfig,validateATS,validateDNS,isPublicAddress}=require('../scripts/release-policy.cjs');
const {parse,xcodeArguments}=require('../scripts/release-preflight.cjs');
const valid=()=>({STUDIO_WEB_URL:'https://app.photography-studio.com',STUDIO_API_URL:'https://api.photography-studio.com',STUDIO_START_PATH:'/studio-os/login',STUDIO_COMMERCIAL_BACKEND_VERIFIED:'true',STUDIO_RELEASE_CHANNEL:'beta',IPHONEOS_DEPLOYMENT_TARGET:'17.0',CONFIGURATION:'Release'});
test('explicit commercial beta passes structural validation',()=>assert.deepEqual(validateConfig(valid()).errors,[]));
test('unverified placeholder never triggers DNS',async()=>{
 const result=validateConfig({...valid(),STUDIO_WEB_URL:'https://unconfigured.invalid',STUDIO_COMMERCIAL_BACKEND_VERIFIED:'false'});
 assert.ok(result.errors.length>=2);let calls=0;await validateDNS(result,async()=>{calls++;return[];});assert.equal(calls,0);
});
test('rejects insecure, personal, reserved and ambiguous endpoints',()=>{
 const bad=['http://app.photography-studio.com','https://localhost','https://127.0.0.1','https://[::1]','https://192.168.1.4','https://2130706433','https://0x7f000001','https://studio.test','https://studio.invalid','https://sub.example.com','https://studio.internal','https://teamalpha.photography','https://team-alpha-api.onrender.com','https://team-alpha-studio.onrender.com','https://user:secret@app.photography-studio.com','https://app.photography-studio.com/auth','https://app.photography-studio.com?preview=1','https://app.photography-studio.com/#token','https://app.photography-studio.com:444','https://app.photography-studio.com.','$(STUDIO_WEB_URL)'];
 for(const value of bad)for(const key of ['STUDIO_WEB_URL','STUDIO_API_URL'])assert.ok(validateConfig({...valid(),[key]:value}).errors.length,key+': '+value);
});
test('signed beta route, label, verification and deployment cannot be weakened',()=>{
 for(const [key,values]of Object.entries({STUDIO_START_PATH:['/auth','//evil.com/studio-os/login','/studio-os/login?demo=1',''],STUDIO_COMMERCIAL_BACKEND_VERIFIED:['','false','yes',1],STUDIO_RELEASE_CHANNEL:['','production','demo'],IPHONEOS_DEPLOYMENT_TARGET:['','16.7','$(TARGET)','17garbage'],CONFIGURATION:['Debug'],SWIFT_ACTIVE_COMPILATION_CONDITIONS:['DEBUG','OTHER DEBUG'],OTHER_SWIFT_FLAGS:['-DDEBUG','-D DEBUG']}))for(const value of values)assert.ok(validateConfig({...valid(),[key]:value}).errors.length,key+': '+value);
});
test('ATS rejects insecure media, web and local exceptions',()=>{
 for(const key of ['NSAllowsArbitraryLoads','NSAllowsArbitraryLoadsInWebContent','NSAllowsArbitraryLoadsForMedia','NSAllowsLocalNetworking'])assert.ok(validateATS({NSAppTransportSecurity:{[key]:true}}).length);
 assert.ok(validateATS({NSAppTransportSecurity:{NSExceptionDomains:{'api.photography-studio.com':{}}}}).length);
 assert.deepEqual(validateATS({NSAppTransportSecurity:{NSAllowsArbitraryLoads:false}}),[]);
});
test('DNS rejects nonpublic or mixed addresses',async()=>{
 const bad=['0.0.0.0','10.0.0.1','100.64.0.1','127.0.0.1','169.254.1.1','172.16.0.1','192.168.1.1','192.0.2.2','198.18.0.1','198.51.100.3','203.0.113.4','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','ff02::1','2001:db8::1','2001:2::1','2002:7f00:1::1','3fff::1','invalid'];
 for(const address of bad){assert.equal(isPublicAddress(address),false,address);assert.ok((await validateDNS(validateConfig(valid()),async()=>[{address:'8.8.8.8'},{address}])).length);}
 for(const address of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(isPublicAddress(address),true);
});
test('DNS failure fails closed; both endpoints checked',async()=>{
 assert.ok((await validateDNS(validateConfig(valid()),async()=>[])).length);
 assert.ok((await validateDNS(validateConfig(valid()),async()=>{throw Error('offline');})).length);
 const calls=[];assert.deepEqual(await validateDNS(validateConfig(valid()),async host=>{calls.push(host);return[{address:'8.8.8.8'}];}),[]);
 assert.deepEqual(calls.sort(),['api.photography-studio.com','app.photography-studio.com']);
});
test('archive cannot consume injected settings or provisioning mutations',()=>{
 assert.throws(()=>parse(['--archive','--settings','untrusted.json']));assert.throws(()=>parse(['--build-environment','--settings','untrusted.json']));assert.throws(()=>parse(['--unknown']));assert.throws(()=>xcodeArguments({'--team':'bad;value'}));
 const args=xcodeArguments({'--team':'ABCDEFGHIJ'});assert.ok(args.includes('Release'));assert.ok(args.includes('DEVELOPMENT_TEAM=ABCDEFGHIJ'));assert.ok(!args.includes('-allowProvisioningUpdates'));
});

test('source plist cannot substitute or hardcode a different environment before signing',()=>{
 const {validateSourceInfo,configurationKeys}=require('../scripts/release-policy.cjs'),settings=valid();
 const info=Object.fromEntries(configurationKeys.map(key=>[key,'$('+key+')']));
 assert.deepEqual(validateSourceInfo(info,settings),[]);
 for(const [key,value] of [['STUDIO_WEB_URL','https://teamalpha.photography'],['STUDIO_COMMERCIAL_BACKEND_VERIFIED',false],['STUDIO_START_PATH','$(ALTERNATE_PATH)'],['STUDIO_API_URL','https://another.studio.com']])assert.ok(validateSourceInfo({...info,[key]:value},settings).length);
});
test('ATS allowance coercion and malformed dictionaries fail closed',()=>{
 for(const value of ['YES','TRUE','false',2,0,null])assert.ok(validateATS({NSAppTransportSecurity:{NSAllowsArbitraryLoads:value}}).length);
 for(const value of [false,null,'',[]])assert.ok(validateATS({NSAppTransportSecurity:value}).length);
});
