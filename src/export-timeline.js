export function exportTiming({fps,duration,speed}) {
  if(![24,30,60].includes(fps)||!Number.isFinite(duration)||duration<1||duration>60||!Number.isFinite(speed)||speed<.25||speed>2) throw new Error('Invalid export timing.');
  const steps=Math.ceil(120*speed/fps);return {frames:Math.round(fps*duration),steps,dt:speed/fps/steps};
}
export async function renderTimeline(scene,options,{capture,signal,progress=()=>{},yieldControl=async()=>{}}) {
  const {frames,steps,dt}=exportTiming(options);
  for(let frame=0;frame<frames;frame++) {
    signal?.throwIfAborted();
    if(frame>0) for(let s=0;s<steps;s++) scene.step(dt);
    await capture(frame/options.fps,1/options.fps,frame);progress(frame+1,frames);await yieldControl();
  }
}
