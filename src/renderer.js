import {WIDTH,HEIGHT} from './flock.js';
import {renderTrails} from './trails.js';
export function renderScene(canvas, scene, style) {
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=style.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.min(canvas.width/WIDTH,canvas.height/HEIGHT);
  renderTrails(canvas,scene,style,scale);
  ctx.save();ctx.translate((canvas.width-WIDTH*scale)/2,(canvas.height-HEIGHT*scale)/2);ctx.scale(scale,scale);
  ctx.fillStyle=style.birds;ctx.beginPath();
  for(let i=0;i<scene.count;i++) {
    const x=scene.x[i],y=scene.y[i],v=Math.hypot(scene.vx[i],scene.vy[i]),ux=scene.vx[i]/v,uy=scene.vy[i]/v;
    const s=style.size,wing=s*.46;
    ctx.moveTo(x+ux*s,y+uy*s);ctx.lineTo(x-ux*s*.65-uy*wing,y-uy*s*.65+ux*wing);ctx.lineTo(x-ux*s*.65+uy*wing,y-uy*s*.65-ux*wing);ctx.closePath();
  }
  ctx.fill();ctx.restore();
}
