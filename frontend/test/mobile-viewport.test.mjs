import test from 'node:test';
import assert from 'node:assert/strict';
import { installStudioMobileViewport } from '../src/utils/mobileViewport.js';
function target() {
 const listeners=new Map();
 return {listeners,addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener(n,f){listeners.get(n)?.delete(f);},emit(n){for(const f of listeners.get(n)||[])f();}};
}
function fixture({visualViewport=true}={}){
 let id=0;const frames=new Map(),timers=new Map(),attributes=new Set(),styles=new Map();
 const root={clientWidth:390,clientHeight:844,hasAttribute:n=>attributes.has(n),toggleAttribute(n,v){if(v)attributes.add(n);else attributes.delete(n);},style:{getPropertyValue:n=>styles.get(n)||'',setProperty:(n,v)=>styles.set(n,v),removeProperty:n=>styles.delete(n)}};
 const doc=Object.assign(target(),{documentElement:root,activeElement:null});
 const viewport=Object.assign(target(),{height:844,width:390,scale:1,offsetTop:0});
 const win=Object.assign(target(),{innerWidth:390,innerHeight:844,visualViewport:visualViewport?viewport:undefined,requestAnimationFrame(f){frames.set(++id,f);return id;},cancelAnimationFrame(k){frames.delete(k);},setTimeout(f){timers.set(++id,f);return id;},clearTimeout(k){timers.delete(k);}});
 const tick=()=>{const pending=[...frames.values()];frames.clear();for(const f of pending)f();};
 const focus=()=>{doc.activeElement={matches:()=>true};doc.emit('focusin');tick();};
 const blur=()=>{doc.activeElement=null;doc.emit('focusout');tick();};
 const resize=(h,layout=win.innerHeight)=>{viewport.height=h;win.innerHeight=layout;viewport.emit('resize');win.emit('resize');tick();};
 const cleanup=installStudioMobileViewport(win,doc);
 return{root,doc,win,viewport,frames,timers,tick,focus,blur,resize,cleanup,keyboard:()=>root.hasAttribute('data-studio-keyboard')};
}
test('native keyboard resizing both viewports hides the dock',()=>{
 const e=fixture();e.focus();e.resize(470,470);assert.equal(e.keyboard(),true);assert.equal(e.root.style.getPropertyValue('--studio-visible-height'),'470px');
});
test('Safari keyboard resizing only visualViewport hides the dock',()=>{const e=fixture();e.focus();e.resize(470);assert.equal(e.keyboard(),true);});
test('focusout before viewport restoration retains keyboard state until restoration',()=>{
 const e=fixture();e.focus();e.resize(470,470);e.blur();assert.equal(e.keyboard(),true);e.resize(844,844);assert.equal(e.keyboard(),false);
});
test('hardware keyboard focus and browser chrome changes do not hide navigation',()=>{const e=fixture();e.focus();assert.equal(e.keyboard(),false);e.resize(780,780);assert.equal(e.keyboard(),false);});
test('pinch zoom is not keyboard occlusion and does not replace the normal baseline',()=>{
 const e=fixture();e.focus();e.viewport.scale=2;e.resize(422);assert.equal(e.keyboard(),false);e.viewport.scale=1;e.resize(844);e.resize(470,470);assert.equal(e.keyboard(),true);
});
test('rotation resets portrait baseline and tracking works after rotating back',()=>{
 const e=fixture();e.focus();e.resize(470,470);e.blur();e.win.innerWidth=844;e.win.innerHeight=390;e.viewport.height=390;e.win.emit('orientationchange');e.tick();assert.equal(e.keyboard(),false);
 e.win.innerWidth=390;e.win.innerHeight=844;e.viewport.height=844;e.win.emit('orientationchange');e.tick();e.focus();e.resize(470,470);assert.equal(e.keyboard(),true);
});
test('repeated keyboard cycles and viewport panning publish fresh geometry',()=>{
 const e=fixture();for(let i=0;i<20;i++){e.focus();e.resize(470,470);assert.equal(e.keyboard(),true);e.viewport.offsetTop=63;e.viewport.emit('scroll');e.tick();assert.equal(e.root.style.getPropertyValue('--studio-visible-top'),'63px');e.blur();e.viewport.offsetTop=0;e.resize(844,844);assert.equal(e.keyboard(),false);}
});
test('without visualViewport native layout shrinking still detects and restores keyboard',()=>{
 const e=fixture({visualViewport:false});e.focus();e.win.innerHeight=470;e.win.emit('resize');e.tick();assert.equal(e.keyboard(),true);e.blur();e.win.innerHeight=844;e.win.emit('resize');e.tick();assert.equal(e.keyboard(),false);
});
test('event bursts coalesce and cleanup removes listeners, timers and geometry',()=>{
 const e=fixture();e.focus();e.viewport.emit('resize');e.viewport.emit('scroll');e.win.emit('resize');assert.equal(e.frames.size,1);e.cleanup();e.cleanup();assert.equal(e.frames.size,0);assert.equal(e.timers.size,0);
 for(const item of [e.win,e.doc,e.viewport])for(const listeners of item.listeners.values())assert.equal(listeners.size,0);
 assert.equal(e.root.style.getPropertyValue('--studio-visible-height'),'');assert.equal(e.root.style.getPropertyValue('--studio-visible-top'),'');assert.equal(e.keyboard(),false);
});
