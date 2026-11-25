const test = require('node:test');
const assert = require('node:assert/strict');
const { currentWorkspace, runInWorkspace } = require('../saas/tenantContext');
const { scopedCalendarReturn, activeCalendarOwner, attachCalendar } = require('../saas/calendarConnection');
const { createGoogleOAuthHandlers, configuration } = require('../utils/oauthState');
const { calendarCredential } = require('../utils/calendarCredentials');

const sid = '1'.repeat(24), otherId = '2'.repeat(24), uid = '3'.repeat(24), account = '4'.repeat(24);
const workspace = id => ({ _id:id, databaseName:'studio_' + id, ownerAccountId:account, state:'active', subscriptionStatus:'active' });
const env = { NODE_ENV:'production', SAAS_ENABLED:'true', VAULT_SECRET:'t'.repeat(32), FRONTEND_URL:'https://studio.example.test', SAAS_GOOGLE_CLIENT_ID:'studio.apps.googleusercontent.com', SAAS_GOOGLE_CLIENT_SECRET:'test-commercial-client', SAAS_GOOGLE_REDIRECT_URI:'https://api.example.test/api/saas/oauth/google/callback' };
const models = { Workspace:{findOne:async q => [sid, otherId].includes(q._id) ? workspace(q._id) : null} };
function response() {
  return {
    set(){return this;}, status(value){this.code=value;return this;}, send(value){this.body=value;}, json(value){this.body=value;}, redirect(value){this.location=value;}, cookie(name,value){this.cookieHeader=name+'='+value;}, clearCookie(){},
  };
}

test('commercial Calendar uses the registered commercial client, never legacy credentials', () => {
  runInWorkspace(workspace(sid), () => {
    assert.equal(configuration(env).redirectUri, env.SAAS_GOOGLE_REDIRECT_URI);
    assert.equal(configuration({...env,GOOGLE_CLIENT_ID:'other-deployment'}).clientId,env.SAAS_GOOGLE_CLIENT_ID);
    assert.throws(() => configuration({...env,SAAS_GOOGLE_CLIENT_SECRET:null,GOOGLE_CLIENT_SECRET:'other-deployment'}));
    assert.throws(() => configuration({...env,VAULT_SECRET:''}));
  });
  assert.throws(() => configuration(env));
});

test('authorization verifies the active studio owner, account and subscription', async () => {
  const membership = {workspaceId:sid,accountId:account,localUserId:uid,role:'owner',state:'active'};
  const registry = { Membership:{exists:async query => Object.entries(query).every(([key,value]) => membership[key] === value)}, Account:{exists:async query => query._id === account && query.state === 'active'} };
  assert.equal(await activeCalendarOwner(workspace(sid),uid,registry),true);
  assert.equal(await activeCalendarOwner(workspace(otherId),uid,registry),false);
  assert.equal(await activeCalendarOwner({...workspace(sid),subscriptionStatus:'expired'},uid,registry),false);
  membership.role='staff';
  assert.equal(await activeCalendarOwner(workspace(sid),uid,registry),false);
  membership.role='owner';
  registry.Account.exists=async()=>false;
  assert.equal(await activeCalendarOwner(workspace(sid),uid,registry),false);
});

test('Calendar consent returns to its originating database, with browser proof, PKCE, encrypted tokens and a single-use state', async () => {
  const rows = new Map();
  const key = id => currentWorkspace()._id + '/' + id;
  let connected, update, exchanges=0, owner=true;
  const handlers = createGoogleOAuthHandlers({
    store: {
      create: async doc => rows.set(key(doc._id),doc),
      findOneAndDelete: async q => {
        const doc=rows.get(key(q._id));
        if (!doc || doc.kind !== q.kind || doc.expiresAt <= q.expiresAt.$gt || (q.browserHash && q.browserHash !== doc.browserHash)) return null;
        rows.delete(key(q._id)); return doc;
      },
    },
    env, User:{
      findOne:async q=>q._id === uid ? {_id:uid,role:'admin'} : null,
      findOneAndUpdate:async (q,data)=>{assert.equal(q.studioOwner,true);update=data.$set;return {_id:uid};},
    },
    authorizeOwner:async () => owner,
    makeClient:()=>({
      generateAuthUrl: options => 'https://accounts.google.com/?'+new URLSearchParams(options),
      getToken:async options=>{assert.ok(options.codeVerifier.length>=43);exchanges++;return {tokens:{access_token:'plaintext-access',refresh_token:'plaintext-refresh',scope:'https://www.googleapis.com/auth/calendar.events.owned'}};},
      setCredentials(){},
    }),
    getGoogleProfile:async()=> ({ email:'sample@example.test', id:'provider-account-1' }),
    attach:(User, filter, data, subject) => attachCalendar(User,filter,data,subject,{CalendarBinding:{updateOne:async()=>({})}},run=>run({})),
    onConnected:async()=>{connected=currentWorkspace()._id;},
  });
  const started=response();
  await runInWorkspace(workspace(sid),()=>handlers.start({user:{id:uid,role:'admin'}},started));
  const ticket=new URL(started.body.url).searchParams.get('ticket');
  const begin=scopedCalendarReturn(handlers.begin,'ticket',models);
  const wrong=response(); await begin({query:{ticket:ticket.replace(sid,otherId)}},wrong);
  assert.equal(new URL(wrong.location).searchParams.get('sync'),'error');
  const good=response(); await begin({query:{ticket}},good);
  const approval=new URL(good.location); const state=approval.searchParams.get('state');
  assert.equal(approval.searchParams.get('access_type'),'offline');
  assert.deepEqual(approval.searchParams.get('scope').split(','), ['https://www.googleapis.com/auth/calendar.events.owned', 'https://www.googleapis.com/auth/userinfo.email']);
  assert.equal(approval.searchParams.get('code_challenge_method'),'S256');
  const callback=scopedCalendarReturn(handlers.callback,'state',models);
  const finish=async (nonce,cookie) => {
    const res=response(); await callback({query:{state:nonce,code:'sample-code'},headers:{cookie}},res);return res;
  };
  assert.match((await finish(state.replace(sid,otherId),good.cookieHeader)).location,/sync=error$/);
  assert.match((await finish(state,'')).location,/sync=error$/);
  assert.equal(exchanges,0);
  assert.match((await finish(state,good.cookieHeader)).location,/sync=success$/);
  assert.equal(exchanges,1); assert.equal(connected,sid);
  assert.doesNotMatch(JSON.stringify(update),/plaintext/);
  runInWorkspace(workspace(sid),()=>assert.equal(calendarCredential(update.googleRefreshToken,uid,'refresh','open',env),'plaintext-refresh'));
  runInWorkspace(workspace(otherId),()=>assert.throws(()=>calendarCredential(update.googleRefreshToken,uid,'refresh','open',env)));
  assert.match((await finish(state,good.cookieHeader)).location,/sync=error$/);
  owner=false;
  const denied=response(); await runInWorkspace(workspace(sid),()=>handlers.start({user:{id:uid,role:'admin'}},denied));
  assert.equal(denied.code,403);
});

test('one Google primary calendar can be claimed by one studio, even through a renamed account', async () => {
  const claimed = new Map();
  const directory = { CalendarBinding:{ async updateOne(filter, update, options) {
    assert.equal(options.upsert, true);
    if (claimed.has(filter._id) && claimed.get(filter._id) !== filter.workspaceId)
      throw Object.assign(new Error('duplicate'), {code:11000});
    claimed.set(filter._id, filter.workspaceId);
  } } };
  const User = { async findOneAndUpdate(filter, update) { return update.$set; } };
  const connect = (id, email) => runInWorkspace(workspace(id), () => attachCalendar(User,
    {_id:uid, studioOwner:true}, {googleEmail:email}, 'stable-google-subject', directory, work=>work({})));
  const first = await connect(sid,'owner@example.test');
  const second = await connect(sid,'renamed@example.test');
  assert.equal(first.googleCalendarSource,second.googleCalendarSource);
  assert.notEqual(first.googleConnectionId,second.googleConnectionId);
  await assert.rejects(connect(otherId,'owner@example.test'),{code:'calendar_in_use'});
});

test('commercial installations ignore Google calls from an unscoped legacy session', async t => {
  t.mock.method(require('../services/studioArchiveGate'), 'withShared', work=>work());
  const before=process.env.SAAS_ENABLED;
  process.env.SAAS_ENABLED='true';
  t.after(()=>{if(before===undefined) delete process.env.SAAS_ENABLED; else process.env.SAAS_ENABLED=before;});
  const User=require('../models/User'), service=require('../services/googleCalendarService');
  t.mock.method(User,'findById',()=>assert.fail('legacy collection must stay untouched'));
  assert.throws(()=>configuration({...env, GOOGLE_CLIENT_ID:'legacy', GOOGLE_CLIENT_SECRET:'legacy', GOOGLE_REDIRECT_URI:'https://api.example.test/api/auth/google/callback'}));
  assert.deepEqual(await service.pollGoogleCalendar({_id:uid}),{success:false});
  await service.syncToGoogle({},'CREATE',uid);
});

test('stale poll cannot import events or emit status after disconnect or reconnect; other studios’ exports stay private', async t => {
  t.mock.method(require('../services/studioArchiveGate'), 'withShared', work=>work());
  const {google}=require('googleapis'), User=require('../models/User'), Event=require('../models/Event');
  const service=require('../services/googleCalendarService');
  for (const [key,value] of Object.entries(env)) {
    const previous=process.env[key]; process.env[key]=value;
    t.after(()=>{if(previous===undefined) delete process.env[key];else process.env[key]=previous;});
  }
  const source='b'.repeat(64), original='generation-one';
  let generation=original, revision=0, release, entered, fail=false;
  const queries=[],emissions=[];
  const io={to:()=>({emit:(...args)=>emissions.push(args)})};
  t.mock.method(User,'exists',async filter=>filter.googleConnectionId===generation && filter.googleSyncRevision===revision);
  t.mock.method(User,'updateOne',async (filter,update)=>{
    const matched=filter.googleConnectionId===generation && (filter.googleSyncRevision===undefined || filter.googleSyncRevision===revision);
    if (matched && update.$inc?.googleSyncRevision) revision++;
    return {matchedCount:Number(matched)};
  });
  t.mock.method(Event,'findOne',async filter=>{queries.push(filter.googleEventId);return null;});
  t.mock.method(Event,'find',async filter=>{assert.equal(filter.googleEventId.$regex,'^'+source+':');return [];});
  t.mock.method(google,'calendar',()=>({events:{list:async options=>{
    assert.equal(options.calendarId,'primary');
    if(entered){ entered(); await new Promise(resolve=>{release=resolve;}); }
    if(fail)throw new Error('provider error');
    return {data:{items:[{id:'shared',status:'cancelled'},{id:'foreign-export',status:'cancelled',extendedProperties:{private:{studioXWorkspace:otherId}}}]}};
  }}}));
  await runInWorkspace(workspace(sid),async()=>{
    const owner={_id:uid,googleSyncRevision:revision,googleEmail:'test@example.test',googleConnectionId:original,googleCalendarSource:source,googleCalendarId:'legacy-id',
      googleAccessToken:calendarCredential('access',uid,'access','seal',env),googleRefreshToken:calendarCredential('refresh',uid,'refresh','seal',env)};
    assert.deepEqual(await service.pollGoogleCalendar(owner,io),{success:true});
    assert.deepEqual(queries,[source+':shared']);
    owner.googleSyncRevision=revision;
    const reading=new Promise(resolve=>{entered=resolve;});
    const overlapping=service.pollGoogleCalendar(owner,io);
    await reading; revision++; release();
    assert.equal((await overlapping).success,false);
    assert.equal(queries.length,1);

    for(const providerFailure of [false,true]) {
      generation=original; owner.googleSyncRevision=revision; fail=providerFailure;
      const started=new Promise(resolve=>{entered=resolve;});
      const running=service.pollGoogleCalendar(owner,io);
      await started; generation='new-consent'; release();
      assert.equal((await running).success,false);
      assert.equal(queries.length,1);
      assert.equal(emissions.length,0);
    }
  });
});
