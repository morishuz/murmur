import {Flock} from '../src/flock.js';
import {renderScene} from '../src/renderer.js';
import {getGPU} from '../src/gpu/runtime.js';
import {GPUFlock} from '../src/gpu/flock.js';
import {GPURenderer} from '../src/gpu/renderer.js';
const report=document.querySelector('#report');
const logs=[];
function log(value){logs.push(value);report.textContent=JSON.stringify(logs,null,2);}
const nextFrame=()=>new Promise(requestAnimationFrame);
const stats=a=>({mean:a.reduce((s,n)=>s+n,0)/a.length,p95:[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)],max:Math.max(...a)});
log({webgpu:!!navigator.gpu,userAgent:navigator.userAgent});
const backend=new URLSearchParams(location.search).get('backend')||'cpu';
const runtime=backend==='gpu'?await getGPU():null;
const settleSeconds=Number(new URLSearchParams(location.search).get('settle')||0);
if(backend==='gpu'&&!runtime)throw new Error('GPU unavailable');
log({backend,readback:false,resolution:[1600,1000],warmupFrames:60,sampleFrames:120,settleSeconds});
for(const count of [1000,3000,10000])for(const trails of [false,true]){
 const initial=new Flock(count),scene=runtime?new GPUFlock(runtime,initial):initial,canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;document.querySelector('canvas').replaceWith(canvas);
 const renderer=runtime?new GPURenderer(runtime,canvas):null;
 const style={background:'#e8ece7',birds:'#263c35',size:4,trails,traceColor:'#789489',persistence:3};
 for(let step=0;step<settleSeconds*120;step++)scene.step(1/120);
 if(runtime){scene.flush();await runtime.device.queue.onSubmittedWorkDone();}
 const physics=[],draw=[],complete=[],intervals=[];let previous=performance.now();
 for(let frame=0;frame<180;frame++){
  await nextFrame();const start=performance.now();
  scene.step(1/120);scene.step(1/120);const simulated=performance.now();
  if(renderer)renderer.render(scene,style);else renderScene(canvas,scene,style);const rendered=performance.now();
  if(runtime)await runtime.device.queue.onSubmittedWorkDone();
  const done=performance.now();
  if(frame>=60){physics.push(simulated-start);draw.push(rendered-simulated);complete.push(done-start);intervals.push(start-previous);}
  previous=start;
 }
 log({backend,count,trails,physics:stats(physics),drawSubmission:stats(draw),frameWork:stats(complete),completionFence:!!runtime,frameInterval:stats(intervals)});
 renderer?.destroy();scene.destroy?.();
}
log({done:true});
