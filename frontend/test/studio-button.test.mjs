import test from 'node:test';
import assert from 'node:assert/strict';
import { createButtonActionGuard } from '../src/admin/components/common/studioButtonAction.js';
function event(){return {prevented:0,stopped:0,preventDefault(){this.prevented++;},stopPropagation(){this.stopped++;}};}
test('unavailable controls block action and native submission',()=>{const g=createButtonActionGuard(),e=event();let n=0;assert.equal(g.run(e,()=>n++,true).accepted,false);assert.equal(n,0);assert.equal(e.prevented,1);assert.equal(e.stopped,1);});
test('ordinary activation preserves native event and result',async()=>{const g=createButtonActionGuard(),e=event();assert.equal(g.run(e,()=>42).result,42);assert.equal(e.prevented,0);await Promise.resolve();assert.equal(g.run(e,()=>1).accepted,true);});
test('rapid repeated taps are ignored until next turn',async()=>{const g=createButtonActionGuard(),e=event();let n=0;g.run(e,()=>n++);assert.equal(g.run(e,()=>n++).accepted,false);assert.equal(n,1);await Promise.resolve();g.run(e,()=>n++);assert.equal(n,2);});
test('reentrant callbacks cannot start duplicate work',()=>{const g=createButtonActionGuard(),e=event();let n=0;g.run(e,()=>{n++;g.run(e,()=>n++);});assert.equal(n,1);});
test('pending work stays locked until its promise settles',async()=>{const g=createButtonActionGuard(),e=event();let finish;const pending=new Promise(resolve=>{finish=resolve;});g.run(e,()=>pending);await Promise.resolve();assert.equal(g.run(e,()=>{}).accepted,false);finish();await pending;assert.equal(g.run(e,()=>{}).accepted,true);});
test('rejected work unlocks for retry without signalling success',async()=>{const g=createButtonActionGuard(),e=event();const failure=Promise.reject(new Error('network'));g.run(e,()=>failure);await assert.rejects(failure,/network/);assert.equal(g.run(e,()=>{}).accepted,true);});
test('synchronous failure propagates and allows retry',()=>{const g=createButtonActionGuard(),e=event();assert.throws(()=>g.run(e,()=>{throw new Error('failed');}),/failed/);assert.equal(g.run(e,()=>{}).accepted,true);});
