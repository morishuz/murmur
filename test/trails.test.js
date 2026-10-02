import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTrails,copyTrails,trailOpacity} from '../src/trails.js';
// Small canvas double checks history lifecycle without requiring a browser encoder.
function canvas() {
 const calls=[];
 const ctx={calls,globalAlpha:1,save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},stroke(){calls.push(['stroke']);},fillRect(){},drawImage(source){calls.push(['image',source,this.globalAlpha]);}};
 return {width:1600,height:1000,getContext:()=>ctx};
}
test('fading reaches zero and is based on elapsed simulation time',()=>{
 assert.equal(trailOpacity(0,4),1);assert.equal(trailOpacity(2,4),.25);
 assert.equal(trailOpacity(4,4),0);assert.equal(trailOpacity(5,4),0);
});
test('trails are opt-in, freeze on pause, expire, reset, and export independently',()=>{
 const previous=globalThis.document;
 const allocated=[];
 globalThis.document={createElement:()=>{const c=canvas();allocated.push(c);return c;}};
 try {
  const output=canvas(),scene={time:0,x:new Float32Array([10]),y:new Float32Array([10]),count:1};
  const style={trails:false,persistence:2,traceColor:'#123456'};
  renderTrails(output,scene,style,1);assert.equal(allocated.length,0);
  style.trails=true;renderTrails(output,scene,style,1);
  scene.time=.1;scene.x[0]=20;renderTrails(output,scene,style,1);
  assert.equal(allocated.length,1);
  renderTrails(output,scene,style,1);
  assert.equal(allocated[0].getContext().calls.filter(c=>c[0]==='stroke').length,1);
  const exported=canvas(),clone={...scene,x:scene.x.slice(),y:scene.y.slice()};
  copyTrails(output,exported,clone);assert.equal(allocated.length,2);
  assert.notEqual(allocated[0],allocated[1]);
  scene.time=3;renderTrails(output,scene,style,1);
  const recent=output.getContext().calls.at(-1);assert.notEqual(recent[1],allocated[0]);
  const drawn=output.getContext().calls.length;
  style.trails=false;renderTrails(output,scene,style,1);
  style.trails=true;renderTrails(output,scene,style,1);
  assert.equal(output.getContext().calls.length,drawn);
  renderTrails(output,{...scene},style,1);assert.equal(output.getContext().calls.length,drawn);
 } finally {globalThis.document=previous;}
});
