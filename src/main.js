import './style.css';
import {createEngine} from './engine.js';
import {renderVideo} from './video-export.js';
async function main(){
const $=id=>document.getElementById(id);
let canvas=document.querySelector('canvas');
let world,paused=false,exporting=false,accumulator=0,last=performance.now(),frames=0,meter=last,controller,url;
const style={background:$('background').value,birds:$('birds').value,size:4,trails:false,traceColor:$('traceColor').value,persistence:3};
let engine;
try{engine=await createEngine(canvas,{forceCPU:new URLSearchParams(location.search).get('backend')==='cpu'});}catch{const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;engine=await createEngine(canvas,{forceCPU:true});}
world=engine.create(1000,42);
const resize=()=>{const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);};
const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
function replaceFlock(count,seed){const previous=world;world=engine.create(count,seed);world.settings={...previous.settings};previous.destroy?.();accumulator=0;}
for(const id of ['alignment','cohesion','separation','speed','size','count']) $(''+id).addEventListener('input',()=>{
 const v=Number($(id).value);$(id+'-value').textContent=id==='count'?v.toLocaleString():v.toFixed(2)+(id==='speed'?'×':'');
 if(id==='count'){replaceFlock(v,world.seed);}else if(id==='size')style.size=v;else world.settings[id]=v;
});
for(const id of ['background','birds','traceColor'])$(id).addEventListener('input',()=>{style[id]=$(id).value;});
$('trails').onchange=()=>{style.trails=$('trails').checked;$('trail-settings').hidden=!style.trails;};
$('persistence').oninput=()=>{style.persistence=Number($('persistence').value);$('persistence-value').textContent=style.persistence.toFixed(1)+' s';};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';accumulator=0;};
$('reset').onclick=()=>replaceFlock(world.count,world.seed+1);
async function recoverGPU(error){
 console.warn('Restarting flock using CPU fallback.',error);
 const previous=world;engine.destroy();observer.unobserve(canvas);
 const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;
 engine=await createEngine(canvas,{forceCPU:true});world=engine.create(previous.count,previous.seed);world.settings={...previous.settings};
 previous.destroy?.();observer.observe(canvas);resize();accumulator=0;last=performance.now();
 $('metrics').title='Graphics acceleration unavailable; flock restarted with CPU rendering.';
 requestAnimationFrame(animate);
}
async function animate(now){
 if(engine.runtime?.lost){recoverGPU(new Error('Graphics device lost'));return;}
 try{
 const elapsed=Math.min((now-last)/1000,.1);last=now;
 if(!paused&&!exporting){accumulator+=elapsed*world.settings.speed;let steps=0;while(accumulator>=1/120&&steps<24){world.step(1/120);accumulator-=1/120;steps++;}}
 if(!exporting){
  engine.render(world,style);
  // Bound the GPU queue: on slower hardware, do not accumulate stale frames.
  if(engine.runtime)await engine.runtime.device.queue.onSubmittedWorkDone();
 }
 frames++;
 if(now-meter>750){$('metrics').textContent=`${world.count.toLocaleString()} BIRDS / ${Math.round(frames*1000/(now-meter))} FPS`;meter=now;frames=0;}
 requestAnimationFrame(animate);
 }catch(error){if(engine.backend==='webgpu')recoverGPU(error);else throw error;}
}requestAnimationFrame(animate);
$('cancel').onclick=()=>controller?.abort();
$('export').onclick=async()=>{
 controller=new AbortController();exporting=true;
 const controls=[...document.querySelectorAll('aside input, aside select, aside button')].filter(el=>el.id!=='cancel');controls.forEach(el=>el.disabled=true);
 $('cancel').hidden=false;$('progress').hidden=false;$('progress').value=0;$('download').hidden=true;$('export-status').textContent='Preparing encoder…';
 try{
  const result=await renderVideo(world,{fps:Number($('fps').value),duration:Number($('duration').value),speed:world.settings.speed,size:Number($('resolution').value),format:$('format').value,style:{...style},previewCanvas:canvas,previewRenderer:engine.renderer},controller.signal,(done,total)=>{$('progress').value=done/total;$('export-status').textContent=`Rendering frame ${done} / ${total}`;});
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(result.blob);$('download').href=url;$('download').download=`murmur-${world.seed}.${result.extension}`;$('download').hidden=false;$('export-status').textContent='Your film is ready.';
 }catch(error){$('export-status').textContent=error.name==='AbortError'?'Render cancelled.':error.message;}
 finally{exporting=false;accumulator=0;controls.forEach(el=>el.disabled=false);$('cancel').hidden=true;}
};

}
main().catch(error=>{console.error(error);document.getElementById('metrics').textContent='Unable to start. Please reload.';});
