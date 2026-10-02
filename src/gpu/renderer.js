import {trailOpacity} from '../trails.js';
export function rgba(hex){return [parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255,1];}
export class GPURenderer {
 constructor(runtime,canvas){
  this.runtime=runtime;this.canvas=canvas;this.context=canvas.getContext('webgpu');
  if(!this.context)throw new Error('WebGPU canvas unavailable.');
  this.context.configure({device:runtime.device,format:runtime.format,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
  const device=runtime.device;
  this.uniform=device.createBuffer({size:8*256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.sampler=device.createSampler({magFilter:'linear',minFilter:'linear'});
  this.batches=[];this.time=0;this.scene=null;this.msaa=null;
 }
 setScene(scene){
  if(this.scene===scene)return;
  this.clearTrails();this.previous?.destroy();this.scene=scene;this.time=scene.time;
  const {device,drawLayout}=this.runtime;
  this.previous=device.createBuffer({size:scene.count*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});
  scene.flush();const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(scene.buffer,0,this.previous,0,scene.count*32);device.queue.submit([encoder.finish()]);
  this.group=device.createBindGroup({layout:drawLayout,entries:[{binding:0,resource:{buffer:scene.buffer}},{binding:1,resource:{buffer:this.previous}},{binding:2,resource:{buffer:this.uniform,size:48}}]});
 }
 clearTrails(){for(const batch of this.batches)batch.texture.destroy();this.batches=[];}
 newBatch(time){
  const {device,compositeLayout}=this.runtime;
  const texture=device.createTexture({size:[1600,1000],format:'r8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST});
  const view=texture.createView();
  const group=device.createBindGroup({layout:compositeLayout,entries:[{binding:0,resource:view},{binding:1,resource:this.sampler},{binding:2,resource:{buffer:this.uniform,size:48}}]});
  return {texture,view,group,time,fresh:true};
 }
 copyTrailsFrom(source,scene){
  this.setScene(scene);const {device}=this.runtime;const encoder=device.createCommandEncoder();
  for(const old of source.batches){const batch=this.newBatch(old.time);encoder.copyTextureToTexture({texture:old.texture},{texture:batch.texture},[1600,1000]);batch.fresh=false;this.batches.push(batch);}
  if(source.previous)encoder.copyBufferToBuffer(source.previous,0,this.previous,0,scene.count*32);
  this.time=source.time;device.queue.submit([encoder.finish()]);
 }
 render(scene,style){
  this.setScene(scene);scene.flush();
  const {device,format,birds,lines,composite}=this.runtime;const {canvas}=this;
  if(!canvas.width||!canvas.height)return;
  if(!this.msaa||this.width!==canvas.width||this.height!==canvas.height){
   this.msaa?.destroy();this.width=canvas.width;this.height=canvas.height;
   this.msaa=device.createTexture({size:[canvas.width,canvas.height],format,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT});
  }
  const encoder=device.createCommandEncoder(),data=new Float32Array(8*64);
  const setStyle=(slot,width,height,opacity=1)=>data.set([width,height,style.size,opacity,...rgba(style.birds),...rgba(style.traceColor||'#789489')],slot*64);
  setStyle(0,canvas.width,canvas.height);setStyle(1,1600,1000);
  if(!style.trails)this.clearTrails();
  else{
   this.batches=this.batches.filter(batch=>{if(scene.time-batch.time<style.persistence)return true;batch.texture.destroy();return false;});
   if(scene.time>this.time){
    let batch=this.batches.at(-1);
    if(!batch||scene.time-batch.time>=style.persistence/4){batch=this.newBatch(scene.time);this.batches.push(batch);if(this.batches.length>5)this.batches.shift().texture.destroy();}
    const pass=encoder.beginRenderPass({colorAttachments:[{view:batch.view,loadOp:batch.fresh?'clear':'load',storeOp:'store',clearValue:[0,0,0,0]}]});
    pass.setPipeline(lines);pass.setBindGroup(0,this.group,[256]);pass.draw(6,scene.count);pass.end();batch.fresh=false;
   }
  }
  const pass=encoder.beginRenderPass({colorAttachments:[{view:this.msaa.createView(),resolveTarget:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'discard',clearValue:rgba(style.background)}]});
  for(let i=0;i<this.batches.length;i++){
   const batch=this.batches[i];setStyle(i+2,canvas.width,canvas.height,trailOpacity(scene.time-batch.time,style.persistence));
   pass.setPipeline(composite);pass.setBindGroup(0,batch.group,[(i+2)*256]);pass.draw(6);
  }
  pass.setPipeline(birds);pass.setBindGroup(0,this.group,[0]);pass.draw(3,scene.count);pass.end();
  encoder.copyBufferToBuffer(scene.buffer,0,this.previous,0,scene.count*32);
  device.queue.writeBuffer(this.uniform,0,data);device.queue.submit([encoder.finish()]);this.time=scene.time;
 }
 destroy(){this.clearTrails();this.previous?.destroy();this.msaa?.destroy();this.uniform.destroy();this.context.unconfigure();}
}
