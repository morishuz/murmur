import {Flock} from './flock.js';
import {renderScene} from './renderer.js';
import {getGPU} from './gpu/runtime.js';
import {GPUFlock} from './gpu/flock.js';
import {GPURenderer} from './gpu/renderer.js';
export async function createEngine(canvas,{forceCPU=false}={}) {
 const runtime=forceCPU?null:await getGPU();
 if(runtime){
  try{
   const renderer=new GPURenderer(runtime,canvas);canvas.dataset.backend='webgpu';
   return {backend:'webgpu',runtime,renderer,create:(count,seed)=>new GPUFlock(runtime,new Flock(count,seed)),render:(scene,style)=>renderer.render(scene,style),destroy:()=>renderer.destroy()};
  }catch(error){console.warn('GPU renderer unavailable; using CPU.',error);}
 }
 // A canvas cannot change context type after a failed WebGPU configuration.
 if(!canvas.getContext('2d'))throw new Error('Replace canvas before CPU fallback.');
 canvas.dataset.backend='cpu';
 return {backend:'cpu',create:(count,seed)=>new Flock(count,seed),render:(scene,style)=>renderScene(canvas,scene,style),destroy:()=>{}};
}
