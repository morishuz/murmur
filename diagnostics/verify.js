import {Flock} from '../src/flock.js';
import {getGPU} from '../src/gpu/runtime.js';
import {GPUFlock} from '../src/gpu/flock.js';
import {GPURenderer} from '../src/gpu/renderer.js';
import {createEngine} from '../src/engine.js';
import {renderScene} from '../src/renderer.js';
import {renderVideo} from '../src/video-export.js';
import {Input,BlobSource,ALL_FORMATS,CanvasSink} from 'mediabunny';
const out=document.querySelector('pre');const results=[];
const log=x=>{results.push(x);out.textContent=JSON.stringify(results,null,2);};
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const canvas=()=>{const c=document.createElement('canvas');c.width=1280;c.height=800;return c;};
const style={background:'#e8ece7',birds:'#263c35',size:4,trails:true,traceColor:'#789489',persistence:3};
try{
 const runtime=await getGPU();check(runtime,'WebGPU unavailable');
 runtime.device.addEventListener('uncapturederror',e=>log({gpuError:e.error.message}));
 for(const count of [1000,3000,10000]){
  const cpu=new Flock(count),gpu=new GPUFlock(runtime,cpu);cpu.step(1/120);gpu.step(1/120);
  const actual=await gpu.snapshot();let max=0;
  for(let i=0;i<count;i++)max=Math.max(max,Math.abs(cpu.ax[i]-actual.ax[i]),Math.abs(cpu.ay[i]-actual.ay[i]));
  check(max<.001,'GPU force mismatch');log({test:'CPU / GPU acceleration agreement',count,maxError:max});
  const start=performance.now();for(let i=0;i<1200;i++)gpu.step(1/120);const later=await gpu.snapshot();
  // Soft boundary permits small excursions beyond the visible frame (also on CPU).
  for(let i=0;i<count;i++)check(Number.isFinite(later.x[i])&&later.x[i]>-200&&later.x[i]<1800&&later.y[i]>-200&&later.y[i]<1200&&Math.hypot(later.vx[i],later.vy[i])>=44.99&&Math.hypot(later.vx[i],later.vy[i])<=115.01,`Unstable GPU state: bird ${i}, x=${later.x[i]}, y=${later.y[i]}, vx=${later.vx[i]}, vy=${later.vy[i]}`);
  log({test:'10 seconds stable',count,wallMs:performance.now()-start});gpu.destroy();
 }
 for(const backend of ['cpu','gpu']){
  const source=new Flock(1000),scene=backend==='gpu'?new GPUFlock(runtime,source):source;
  const preview=canvas();document.body.append(preview);
  const renderer=backend==='gpu'?new GPURenderer(runtime,preview):null;
  for(let i=0;i<120;i++){scene.step(1/120);scene.step(1/120);if(renderer)renderer.render(scene,style);else renderScene(preview,scene,style);}
  if(renderer)await runtime.device.queue.onSubmittedWorkDone();
  const before=backend==='gpu'?await scene.snapshot():scene.clone();
  for(const trails of [false,true])for(const format of ['mp4','webm']){
   let frames=0;
   const result=await renderVideo(scene,{fps:24,duration:1,speed:1,size:1280,format,style:{...style,trails},previewCanvas:preview,previewRenderer:renderer},new AbortController().signal,(done)=>frames=done);
   check(frames===24,'Wrong encoded frame count');
   const input=new Input({source:new BlobSource(result.blob),formats:ALL_FORMATS});
   const track=await input.getPrimaryVideoTrack();check(track,'No video track');
   const duration=await input.computeDuration();check(Math.abs(duration-1)<.002,'Wrong duration');
   const sink=new CanvasSink(track,{poolSize:2});let decoded=0,lastTime=-1,inkFirst=0,inkLast=0;
   for await(const frame of sink.canvases()){
    check(frame.timestamp>lastTime,'Non-increasing timestamps');lastTime=frame.timestamp;
    const ctx=frame.canvas.getContext('2d'),pixels=ctx.getImageData(0,0,1280,800).data;
    let ink=0,sum=0;
    for(let p=0;p<pixels.length;p+=4){sum+=pixels[p];if(pixels[p]<180)ink++;}
    check(sum/(1280*800)>180,'Blank or black exported frame');check(ink>100,'Birds missing from export');
    if(decoded===0)inkFirst=ink;inkLast=ink;decoded++;
   }
   input.dispose();check(decoded===24,'Decoded frame count mismatch');
   log({test:'encoded and decoded',backend,trails,format,decoded,duration,bytes:result.blob.size,inkFirst,inkLast});
  }
  const controller=new AbortController();let cancelled=false;
  try{await renderVideo(scene,{fps:24,duration:1,speed:1,size:1280,format:'mp4',style,previewCanvas:preview,previewRenderer:renderer},controller.signal,()=>controller.abort());}catch(error){cancelled=error.name==='AbortError';}
  check(cancelled,'Cancellation failed');
  const after=backend==='gpu'?await scene.snapshot():scene;
  check(after.time===before.time&&after.x.every((x,i)=>x===before.x[i]),'Export changed live flock');
  log({test:'cancellation and live scene isolation',backend,passed:true});
  renderer?.destroy();scene.destroy?.();
 }
 const dense=new GPUFlock(runtime,new Flock(10000));
 const denseCanvas=canvas(),denseRenderer=new GPURenderer(runtime,denseCanvas);
 for(let i=0;i<60;i++){dense.step(1/120);dense.step(1/120);denseRenderer.render(dense,style);}
 const denseTime=dense.time;
 const denseVideo=await renderVideo(dense,{fps:60,duration:1,speed:2,size:1920,format:'mp4',style,previewCanvas:denseCanvas,previewRenderer:denseRenderer},new AbortController().signal);
 const denseInput=new Input({source:new BlobSource(denseVideo.blob),formats:ALL_FORMATS});
 const denseTrack=await denseInput.getPrimaryVideoTrack();const denseSink=new CanvasSink(denseTrack,{poolSize:2});let denseFrames=0;
 for await(const frame of denseSink.canvases()){check(frame.canvas.width===1920&&frame.canvas.height===1200,'Wrong dense export resolution');denseFrames++;}
 check(denseFrames===60&&Math.abs(await denseInput.computeDuration()-1)<.002&&dense.time===denseTime,'Dense video timing/isolation failed');
 log({test:'10000 birds with trails, 1920x1200 MP4, 60 FPS, 2x speed',frames:denseFrames,bytes:denseVideo.blob.size,passed:true});
 denseInput.dispose();denseRenderer.destroy();dense.destroy();
 const fallback=await createEngine(canvas(),{forceCPU:true});check(fallback.backend==='cpu','Forced CPU fallback failed');fallback.render(fallback.create(100,42),style);fallback.destroy();
 runtime.device.destroy();await runtime.device.lost;check(runtime.lost,'Device loss not detected');
 log({test:'CPU fallback and device-loss detection',passed:true});
 log({done:true});
}catch(error){log({error:error.stack});}
