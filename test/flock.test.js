import test from 'node:test';
import assert from 'node:assert/strict';
import {Flock} from '../src/flock.js';
import {renderTimeline} from '../src/export-timeline.js';
test('seeded simulation and isolated export clone',()=>{const a=new Flock(100),b=a.clone();for(let i=0;i<120;i++){a.step(1/120);b.step(1/120);}assert.deepEqual(a.x,b.x);b.step(1/120);assert.notDeepEqual(a.x,b.x);});
test('1000 birds remain finite, bounded and within flight speed limits for a minute',()=>{const a=new Flock();for(let s=0;s<7200;s++)a.step(1/120);for(let i=0;i<a.count;i++){assert.ok(Number.isFinite(a.x[i])&&Number.isFinite(a.y[i]));assert.ok(a.x[i]>0&&a.x[i]<1600&&a.y[i]>0&&a.y[i]<1000);const speed=Math.hypot(a.vx[i],a.vy[i]);assert.ok(speed>=44.99&&speed<=115.01);}});
test('export time is independent of encoding wall time and does not advance its source',async()=>{const source=new Flock(10),scene=source.clone(),times=[];await renderTimeline(scene,{fps:24,duration:1,speed:.5},{capture:async(t,d)=>{times.push(t);assert.equal(d,1/24);}});assert.equal(times.length,24);assert.equal(times[23],23/24);assert.ok(Math.abs(scene.time-23/24*.5)<1e-10);assert.equal(source.time,0);});
test('cancellation interrupts rendering',async()=>{const controller=new AbortController();let frames=0;await assert.rejects(renderTimeline(new Flock(10),{fps:60,duration:1,speed:1},{signal:controller.signal,capture:async()=>{frames++;controller.abort();}}),{name:'AbortError'});assert.equal(frames,1);});

test('optimised neighbour queries preserve the original steering forces',async()=>{
 const {Flock:Reference}=await import('./fixtures/reference-flock.js');
 for(const count of [100,1000,3000]) {
  const reference=new Reference(count),optimised=new Flock(count);
  reference.step(1/120);optimised.updateSteering();
  for(let i=0;i<count;i++) {
   assert.ok(Math.abs(reference.ax[i]-optimised.ax[i])<.0001);
   assert.ok(Math.abs(reference.ay[i]-optimised.ay[i])<.0001);
  }
 }
});
test('steering runs at 30 Hz across live and export timesteps',()=>{
 for(const hz of [120,144,240]) {
  const world=new Flock(10);let calls=0;const update=world.updateSteering.bind(world);
  world.updateSteering=()=>{calls++;update();};
  for(let i=0;i<hz;i++)world.step(1/hz);
  assert.equal(calls,30);
  const clone=world.clone();world.step(1/hz);clone.step(1/hz);assert.deepEqual(world.x,clone.x);
 }
});
test('3000 birds stay stable for 20 seconds with cached steering',()=>{
 const world=new Flock(3000);
 for(let i=0;i<2400;i++)world.step(1/120);
 for(let i=0;i<world.count;i++){
  assert.ok(Number.isFinite(world.x[i])&&Number.isFinite(world.y[i]));
  assert.ok(world.x[i]>0&&world.x[i]<1600&&world.y[i]>0&&world.y[i]<1000);
 }
});
