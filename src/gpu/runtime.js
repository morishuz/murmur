import computeCode from './compute.wgsl?raw';
import drawCode from './draw.wgsl?raw';
import compositeCode from './composite.wgsl?raw';
let cached;
export async function getGPU() {
 if(!navigator.gpu)return null;
 if(!cached)cached=initialise().catch(error=>{console.warn('WebGPU unavailable; using CPU.',error);return null;});
 return cached;
}
async function initialise() {
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
 if(!adapter)return null;
 const device=await adapter.requestDevice();
 device.pushErrorScope('validation');
 try{
 const modules=[computeCode,drawCode,compositeCode].map(code=>device.createShaderModule({code}));
 for(const module of modules){const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>`${m.lineNum}: ${m.message}`).join('\n'));}
 const computeLayout=device.createBindGroupLayout({entries:[
  {binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
  {binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
  {binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
  {binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform',hasDynamicOffset:true,minBindingSize:32}},
 ]});
 const compute={};
 for(const entryPoint of ['clearGrid','buildGrid','steer','integrate'])compute[entryPoint]=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[computeLayout]}),compute:{module:modules[0],entryPoint}});
 const drawLayout=device.createBindGroupLayout({entries:[
  {binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}},
  {binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}},
  {binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',hasDynamicOffset:true,minBindingSize:48}},
 ]});
 const format=navigator.gpu.getPreferredCanvasFormat();
 const drawPipelineLayout=device.createPipelineLayout({bindGroupLayouts:[drawLayout]});
 const birds=await device.createRenderPipelineAsync({layout:drawPipelineLayout,vertex:{module:modules[1],entryPoint:'birdVertex'},fragment:{module:modules[1],entryPoint:'birdFragment',targets:[{format}]},primitive:{topology:'triangle-list'},multisample:{count:4}});
 const lines=await device.createRenderPipelineAsync({layout:drawPipelineLayout,vertex:{module:modules[1],entryPoint:'lineVertex'},fragment:{module:modules[1],entryPoint:'lineFragment',targets:[{format:'r8unorm',blend:{color:{operation:'max',srcFactor:'one',dstFactor:'one'},alpha:{operation:'max',srcFactor:'one',dstFactor:'one'}}}]},primitive:{topology:'triangle-list'}});
 const compositeLayout=device.createBindGroupLayout({entries:[
  {binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},
  {binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{}},
  {binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',hasDynamicOffset:true,minBindingSize:48}},
 ]});
 const composite=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[compositeLayout]}),vertex:{module:modules[2],entryPoint:'vertex'},fragment:{module:modules[2],entryPoint:'fragment',targets:[{format,blend:{color:{srcFactor:'one',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},primitive:{topology:'triangle-list'},multisample:{count:4}});
 const error=await device.popErrorScope();if(error)throw new Error(error.message);
 const runtime={device,format,computeLayout,drawLayout,compositeLayout,compute,birds,lines,composite,lost:false};
 device.lost.then(()=>{runtime.lost=true;cached=undefined;});
 device.addEventListener('uncapturederror',event=>{runtime.lost=true;cached=undefined;console.error('WebGPU error:',event.error.message);});
 return runtime;
 }catch(error){await device.popErrorScope().catch(()=>{});device.destroy();throw error;}
}
