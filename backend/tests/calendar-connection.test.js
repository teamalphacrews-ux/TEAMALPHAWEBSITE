require('node:test').beforeEach(t => t.mock.method(require('../services/studioArchiveGate'), 'withShared', work => work()));
const test = require('node:test');
const assert = require('node:assert/strict');
const { calendarConnection, createCalendarSyncHandler } = require('../utils/calendarConnection');
const env = { NODE_ENV:'production', GOOGLE_CLIENT_ID:'test-id', GOOGLE_CLIENT_SECRET:'private-test-secret', GOOGLE_REDIRECT_URI:'https://api.example.test/api/auth/google/callback', FRONTEND_URL:'https://studio.example.test' };
const user = { email:'studio@example.test', googleEmail:'calendar@example.test', googleAccessToken:'private-access', googleRefreshToken:'private-refresh' };
const response = () => ({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});

test('Calendar readiness validates production configuration without exposing secrets or requiring a webhook', () => {
  assert.equal(calendarConnection(user,env).isSynced,true);
  for (const field of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','FRONTEND_URL']) {
    const result = calendarConnection(user,{...env,[field]:''});
    assert.equal(result.configured,false);
    assert.equal(result.isSynced,false);
    assert.ok(result.setupMessage);
    assert.doesNotMatch(JSON.stringify(result),/private-test-secret|private-access|private-refresh/);
  }
  assert.equal(calendarConnection(user,{...env,GOOGLE_REDIRECT_URI:'http://api.example.test/api/auth/google/callback'}).configured,false);
});

test('Calendar connection requires refresh permission and projects only safe connection metadata', () => {
  const result=calendarConnection({...user,googleRefreshToken:''},env);
  assert.equal(result.isSynced,false);
  assert.equal(result.reconnectRequired,true);
  assert.match(result.setupMessage,/Reconnect/);
  assert.doesNotMatch(JSON.stringify(calendarConnection(user,env)),/private-access|private-refresh/);
});

test('manual Calendar sync never reports provider failures or in-progress requests as success', async () => {
  for (const [outcome,status] of [[{success:false},502],[undefined,502],[{success:false,inProgress:true},409],[{success:true},200]]) {
    const res=response();
    const handler=createCalendarSyncHandler({env,User:{findById:async()=>user},pollGoogleCalendar:async()=>outcome});
    await handler({user:{id:'studio-admin'}},res);
    assert.equal(res.statusCode,status);
    assert.equal(res.body.success===true,status===200);
  }
});

test('manual Calendar sync rejects setup and permission failures before contacting Google', async () => {
  let calls=0;
  for (const [account,config,status] of [[user,{},503],[{...user,googleRefreshToken:''},env,400],[null,env,404]]) {
    const res=response();
    await createCalendarSyncHandler({env:config,User:{findById:async()=>account},pollGoogleCalendar:async()=>{calls++;}})({user:{id:'studio-admin'}},res);
    assert.equal(res.statusCode,status);
  }
  assert.equal(calls,0);
});

test('polling returns provider failures honestly and releases its per-user lock', async t => {
  const {google}=require('googleapis');
  const User=require('../models/User');
  const Event=require('../models/Event');
  const {pollGoogleCalendar}=require('../services/googleCalendarService');
  const updates=[];
  let fail=true, release;
  let entered;
  const started=new Promise(resolve=>{entered=resolve;});
  t.mock.method(google,'calendar',()=>({events:{list:async()=>{
    if(fail)throw new Error('Provider unavailable: private diagnostic marker');
    entered();
    await new Promise(resolve=>{release=resolve;});
    return {data:{items:[]}};
  }}}));
  t.mock.method(User,'findByIdAndUpdate',async(id,update)=>{updates.push(update);});
  t.mock.method(Event,'find',async()=>[]);
  const account={...user,_id:'507f1f77bcf86cd799439011'};
  assert.deepEqual(await pollGoogleCalendar(null),{success:false});
  assert.deepEqual(await pollGoogleCalendar(account),{success:false});
  assert.match(updates[0].googleSyncError,/sync could not finish/i);
  assert.doesNotMatch(updates[0].googleSyncError,/private diagnostic marker/);
  fail=false;
  const running=pollGoogleCalendar(account);
  await started;
  assert.deepEqual(await pollGoogleCalendar(account),{success:false,inProgress:true});
  release();
  assert.deepEqual(await running,{success:true});
  assert.equal(updates.at(-1).googleSyncError,null);
});

test('reconciliation uses the same exclusive overlap bounds as the Google listing', async t => {
  const { google } = require('googleapis');
  const User = require('../models/User');
  const Event = require('../models/Event');
  const { pollGoogleCalendar } = require('../services/googleCalendarService');
  let listed, scanned;
  t.mock.method(Date, 'now', () => Date.parse('2028-02-29T11:35:20.537Z'));
  t.mock.method(google, 'calendar', () => ({ events: { list: async options => {
    listed = options;
    return { data: { items: [] } };
  } } }));
  t.mock.method(Event, 'find', async filter => { scanned = filter; return []; });
  t.mock.method(User, 'findByIdAndUpdate', async () => ({}));
  const account = { ...user, _id: '507f1f77bcf86cd799439011' };
  assert.deepEqual(await pollGoogleCalendar(account), { success: true });
  assert.equal(new Date(listed.timeMin).getUTCMilliseconds(), 0);
  assert.equal(new Date(listed.timeMax).getUTCMilliseconds(), 0);
  assert.deepEqual(scanned.start, { $lt: new Date(listed.timeMax) });
  assert.deepEqual(scanned.end, { $gt: new Date(listed.timeMin) });
});

test('a truncated Google event page cannot purge records or advance the last successful sync', async t => {
  const { google } = require('googleapis');
  const User = require('../models/User');
  const Event = require('../models/Event');
  const { pollGoogleCalendar } = require('../services/googleCalendarService');
  const statusUpdates = [];
  let cleanups = 0;
  t.mock.method(google, 'calendar', () => ({ events: { list: async () => ({ data: {} }) } }));
  t.mock.method(Event, 'find', async () => { cleanups++; return []; });
  t.mock.method(User, 'findByIdAndUpdate', async (_id, data) => statusUpdates.push(data));
  const result = await pollGoogleCalendar({ ...user, _id: '507f1f77bcf86cd799439011' });
  assert.equal(result.success, false);
  assert.equal(cleanups, 0);
  assert.equal(statusUpdates.length, 1);
  assert.ok(statusUpdates[0].googleSyncError);
  assert.equal(statusUpdates[0].googleLastSyncAt, undefined);
});

test('a repeated Google pagination token terminates before applying any changes', async t => {
  const { google } = require('googleapis');
  const User = require('../models/User');
  const Event = require('../models/Event');
  const { pollGoogleCalendar } = require('../services/googleCalendarService');
  let pages = 0, localScans = 0;
  t.mock.method(google, 'calendar', () => ({ events: { list: async () => {
    pages++;
    if (pages > 2) throw new Error('test provider call budget exhausted');
    return { data: { items: [], nextPageToken: 'again' } };
  } } }));
  t.mock.method(Event, 'find', async () => { localScans++; return []; });
  t.mock.method(User, 'findByIdAndUpdate', async () => ({}));
  const result = await pollGoogleCalendar({ ...user, _id: '507f1f77bcf86cd799439011' });
  assert.equal(result.success, false);
  assert.equal(pages, 2);
  assert.equal(localScans, 0);
});
