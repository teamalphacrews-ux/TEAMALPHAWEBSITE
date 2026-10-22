import test from 'node:test';
import assert from 'node:assert/strict';
import { googleCalendarHandoff, googleConnectionError } from '../src/admin/components/calendar/googleConnection.js';

const ticket = 'a'.repeat(64);
const api = 'https://api.example.test';
const valid = `${api}/api/auth/google/begin?ticket=${ticket}`;

test('Google connection accepts only the configured API handoff with a single bounded ticket', () => {
  assert.equal(googleCalendarHandoff({url:valid}, api, 'https://studio.example.test'), valid);
  const local = `http://127.0.0.1:5000/api/auth/google/begin?ticket=${ticket}`;
  assert.equal(googleCalendarHandoff({url:local}, 'http://127.0.0.1:5000', 'http://127.0.0.1:5173'), local);
  assert.equal(googleCalendarHandoff({url:local}, 'http://127.0.0.1:5173', 'http://127.0.0.1:5173'), local);
  assert.throws(()=>googleCalendarHandoff({url:local},api,'https://studio.example.test'));
});

test('empty preview responses and unsafe or malformed redirects never become navigation destinations', () => {
  for (const result of [[], {}, null, {url:undefined}, {url:''},
    {url:'javascript:alert(1)'}, {url:valid.replace('api.example.test','other.example.test')},
    {url:valid.replace('/begin?', '/callback?')}, {url:valid+'#fragment'},
    {url:valid+'&ticket='+ticket}, {url:valid+'&next=https://other.example.test'},
    {url:valid.replace(ticket,'invalid')}, {url:valid.replace('https://','https://user:password@')},
    {url:valid.replace('https://','http://')}, {url:'/api/auth/google/begin?ticket='+ticket}]) {
    assert.throws(()=>googleCalendarHandoff(result,api,'https://studio.example.test'));
  }
});

test('Google connection displays backend msg and message errors instead of generic save errors', () => {
  assert.equal(googleConnectionError({response:{data:{msg:'Calendar setup is incomplete.'}}}), 'Calendar setup is incomplete.');
  assert.equal(googleConnectionError({response:{data:{message:'Google rejected the request.'}}}), 'Google rejected the request.');
  assert.equal(googleConnectionError(new Error('Invalid connection response.')), 'Invalid connection response.');
});
