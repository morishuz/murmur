import {WIDTH,HEIGHT} from './flock.js';
// Bounded raster history: at most five short batches, independent of bird count.
// Fading entire batches avoids the permanent faint residue of 8-bit canvas erasure.
const layers = new WeakMap();
export function trailOpacity(age, persistence) {
  return Math.max(0, 1-Math.max(0,age)/persistence) ** 2;
}
function createLayer(scene) {
  return {scene,time:scene.time,x:scene.x.slice(),y:scene.y.slice(),batches:[]};
}
function createBatch(time, color) {
  const surface=document.createElement('canvas');
  surface.width=WIDTH;surface.height=HEIGHT;
  return {surface,time,color};
}
export function copyTrails(from,to,scene) {
  const previous=layers.get(from);
  if(!previous) return;
  const layer=createLayer(scene);
  for(const old of previous.batches) {
    const batch=createBatch(old.time,old.color);
    batch.surface.getContext('2d').drawImage(old.surface,0,0);
    layer.batches.push(batch);
  }
  layers.set(to,layer);
}
export function renderTrails(canvas,scene,style,scale) {
  if(!style.trails) { layers.delete(canvas);return; }
  let layer=layers.get(canvas);
  if(!layer || layer.scene!==scene) {layer=createLayer(scene);layers.set(canvas,layer);}
  layer.batches=layer.batches.filter(batch=>scene.time-batch.time<style.persistence);
  if(scene.time>layer.time) {
    let batch=layer.batches.at(-1);
    if(!batch || scene.time-batch.time>=style.persistence/4) {
      batch=createBatch(scene.time,style.traceColor);layer.batches.push(batch);
      // Also bound memory after increasing persistence while trails are present.
      if(layer.batches.length>5) layer.batches.shift();
    }
    const ctx=batch.surface.getContext('2d');
    ctx.strokeStyle=style.traceColor;ctx.lineWidth=.65;ctx.beginPath();
    for(let i=0;i<scene.count;i++) {
      ctx.moveTo(layer.x[i],layer.y[i]);ctx.lineTo(scene.x[i],scene.y[i]);
      if((i+1)%128===0){ctx.stroke();ctx.beginPath();}
    }
    ctx.stroke();layer.x.set(scene.x);layer.y.set(scene.y);layer.time=scene.time;
  }
  const target=canvas.getContext('2d');
  target.save();
  target.translate((canvas.width-WIDTH*scale)/2,(canvas.height-HEIGHT*scale)/2);
  target.scale(scale,scale);
  for(const batch of layer.batches) {
    if(batch.color!==style.traceColor) {
      const ctx=batch.surface.getContext('2d');ctx.save();ctx.globalCompositeOperation='source-in';
      ctx.fillStyle=style.traceColor;ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.restore();batch.color=style.traceColor;
    }
    target.globalAlpha=trailOpacity(scene.time-batch.time,style.persistence);
    target.drawImage(batch.surface,0,0);
  }
  target.restore();
}
