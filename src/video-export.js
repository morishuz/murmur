import { Output, BufferTarget, CanvasSource, Mp4OutputFormat, WebMOutputFormat, canEncodeVideo, Quality } from 'mediabunny';
import { renderScene } from './renderer.js';
import { GPURenderer } from './gpu/renderer.js';
import { copyTrails } from './trails.js';
import { renderTimeline, exportTiming } from './export-timeline.js';

export async function renderVideo(world, options, signal, progress) {
  exportTiming(options);
  if (!globalThis.VideoEncoder) throw new Error('This browser has no WebCodecs video encoder. Open this app in a browser with WebCodecs encoding support.');
  if (![1280,1920,2560,3840].includes(options.size) || !['mp4','webm'].includes(options.format)) throw new Error('Invalid video format or size.');
  const quality = new Quality('high');
  const candidates = options.format === 'mp4' ? ['avc'] : ['vp9', 'vp8'];
  let codec;
  for (const candidate of candidates) if (await canEncodeVideo(candidate, {width: options.size, height: options.size * 10 / 16, frameRate: options.fps, quality})) { codec = candidate; break; }
  signal.throwIfAborted();
  if (!codec) throw new Error(`No supported ${options.format.toUpperCase()} encoder for these settings. Try the other format or a lower resolution.`);
  const canvas = document.createElement('canvas'); canvas.width = options.size; canvas.height = options.size * 10 / 16;
  const output = new Output({format: options.format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(), target: new BufferTarget()});
  const source = new CanvasSource(canvas, {codec, quality});
  output.addVideoTrack(source, {frameRate: options.fps});
  let scene,renderer;
  try {
    await output.start();
    // Export an independent snapshot, preserving the live flock and its velocity field.
    scene = world.clone();
    if(scene.backend==='webgpu'){
      renderer=new GPURenderer(scene.runtime,canvas);
      if(options.style.trails && options.previewRenderer)renderer.copyTrailsFrom(options.previewRenderer,scene);
    }else if(options.style.trails && options.previewCanvas) copyTrails(options.previewCanvas,canvas,scene);
    await renderTimeline(scene, options, {
      signal, progress, yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
      capture: async (timestamp, duration, frame) => {
        if(renderer){
          if(scene.runtime.lost)throw new Error('Graphics device lost during export. Please try again.');
          renderer.render(scene,options.style);
          await scene.runtime.device.queue.onSubmittedWorkDone();
        }else renderScene(canvas, scene, options.style);
        await source.add(timestamp, duration, {keyFrame: frame % (options.fps * 2) === 0});
      },
    });
    signal.throwIfAborted();
    await output.finalize();
    signal.throwIfAborted();
    return {blob: new Blob([output.target.buffer], {type: options.format === 'mp4' ? 'video/mp4' : 'video/webm'}), extension: options.format};
  } catch (error) { await output.cancel().catch(() => {}); throw error; }
  finally{renderer?.destroy();scene?.destroy?.();}
}
