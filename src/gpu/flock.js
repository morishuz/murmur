import {Flock} from '../flock.js';
const STRIDE=32,SLOTS=128;
export class GPUFlock {
 constructor(runtime,source=new Flock()) {
  this.runtime=runtime;this.count=source.count;this.seed=source.seed;this.time=source.time;
  this.settings={...source.settings};this.steeringElapsed=source.steeringElapsed;
  this.backend='webgpu';this.pending=0;this.encoder=null;
  const device=runtime.device;
  this.buffer=device.createBuffer({size:this.count*STRIDE,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
  this.heads=device.createBuffer({size:2560*4,usage:GPUBufferUsage.STORAGE});
  this.next=device.createBuffer({size:this.count*4,usage:GPUBufferUsage.STORAGE});
  this.uniform=device.createBuffer({size:SLOTS*256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.values=new Float32Array(SLOTS*64);
  this.group=device.createBindGroup({layout:runtime.computeLayout,entries:[
   {binding:0,resource:{buffer:this.buffer}},{binding:1,resource:{buffer:this.heads}},
   {binding:2,resource:{buffer:this.next}},{binding:3,resource:{buffer:this.uniform,size:32}},
  ]});
  if(source instanceof GPUFlock){
   source.flush();const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(source.buffer,0,this.buffer,0,this.count*STRIDE);device.queue.submit([encoder.finish()]);
  }else{
   const data=new Float32Array(this.count*8);
   for(let i=0;i<this.count;i++)data.set([source.x[i],source.y[i],source.vx[i],source.vy[i],source.ax[i],source.ay[i],source.phase[i],0],i*8);
   device.queue.writeBuffer(this.buffer,0,data);
  }
 }
 clone(){return new GPUFlock(this.runtime,this);}
 step(dt){
  if(this.runtime.lost)throw new Error('Graphics device was lost.');
  if(this.pending===SLOTS)this.flush();
  const {device,compute}=this.runtime;
  this.encoder??=device.createCommandEncoder();
  const offset=this.pending*256;
  this.values.set([dt,this.time,this.count,0,this.settings.alignment,this.settings.cohesion,this.settings.separation,0],this.pending*64);
  const dispatch=(pipeline,groups)=>{const pass=this.encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,this.group,[offset]);pass.dispatchWorkgroups(groups);pass.end();};
  if(this.steeringElapsed>=1/30-1e-10){
   dispatch(compute.clearGrid,40);dispatch(compute.buildGrid,Math.ceil(this.count/64));dispatch(compute.steer,Math.ceil(this.count/64));
   this.steeringElapsed%=1/30;if(this.steeringElapsed>=1/30-1e-10)this.steeringElapsed=0;
  }
  dispatch(compute.integrate,Math.ceil(this.count/64));
  this.pending++;this.time+=dt;this.steeringElapsed+=dt;
 }
 flush(){
  if(!this.encoder)return;
  const {device}=this.runtime;
  device.queue.writeBuffer(this.uniform,0,this.values,0,this.pending*64);
  device.queue.submit([this.encoder.finish()]);this.encoder=null;this.pending=0;
 }
 async snapshot(){
  this.flush();const {device}=this.runtime;
  const read=device.createBuffer({size:this.count*STRIDE,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  try{
   const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(this.buffer,0,read,0,this.count*STRIDE);device.queue.submit([encoder.finish()]);
   await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange());
   const scene=new Flock(this.count,this.seed);scene.time=this.time;scene.steeringElapsed=this.steeringElapsed;scene.settings={...this.settings};
   for(let i=0;i<this.count;i++){scene.x[i]=data[i*8];scene.y[i]=data[i*8+1];scene.vx[i]=data[i*8+2];scene.vy[i]=data[i*8+3];scene.ax[i]=data[i*8+4];scene.ay[i]=data[i*8+5];scene.phase[i]=data[i*8+6];}
   return scene;
  }finally{read.destroy();}
 }
 destroy(){this.flush();for(const buffer of [this.buffer,this.heads,this.next,this.uniform])buffer.destroy();}
}
