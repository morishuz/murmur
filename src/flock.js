export const WIDTH = 1600, HEIGHT = 1000;
const CELL = 25, COLS = Math.ceil(WIDTH / CELL), ROWS = Math.ceil(HEIGHT / CELL);
export class Flock {
  constructor(count = 1000, seed = 42) {
    this.count = count; this.seed = seed; this.time = 0;
    this.steeringElapsed = 1 / 30;
    this.settings = {alignment: 1, cohesion: 1, separation: 1, speed: 1};
    for (const key of ['x','y','vx','vy','ax','ay','phase']) this[key] = new Float32Array(count);
    // Counting-sort birds into contiguous cell ranges for cache-friendly queries.
    this.offsets = new Int32Array(COLS * ROWS + 1);
    this.cursor = new Int32Array(COLS * ROWS);
    this.cells = new Int32Array(count);
    this.order = new Int32Array(count);
    let s = seed >>> 0;
    const random = () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random());
      this.x[i] = 800 + Math.cos(a) * r * 500; this.y[i] = 500 + Math.sin(a) * r * 280;
      const heading = -.25 + (random() - .5) * .8;
      this.vx[i] = Math.cos(heading) * 80; this.vy[i] = Math.sin(heading) * 80;
      this.phase[i] = random() * Math.PI * 2;
    }
  }
  clone() {
    const copy = new Flock(this.count, this.seed);
    for (const key of ['x','y','vx','vy','ax','ay','phase']) copy[key].set(this[key]);
    copy.time = this.time; copy.steeringElapsed = this.steeringElapsed; copy.settings = {...this.settings}; return copy;
  }
  updateSteering() {
    const {count,x,y,vx,vy,ax,ay,offsets,cursor,cells,order,settings} = this;
    offsets.fill(0);
    for (let i = 0; i < count; i++) {
      const cx = Math.max(0,Math.min(COLS-1,Math.floor(x[i]/CELL))), cy = Math.max(0,Math.min(ROWS-1,Math.floor(y[i]/CELL)));
      const cell = cy * COLS + cx; cells[i] = cell; offsets[cell+1]++;
    }
    for(let cell=1;cell<offsets.length;cell++) offsets[cell]+=offsets[cell-1];
    cursor.set(offsets.subarray(0,cursor.length));
    for(let i=0;i<count;i++) order[cursor[cells[i]]++]=i;
    for (let i = 0; i < count; i++) {
      const xi=x[i],yi=y[i],vxi=vx[i],vyi=vy[i];
      const blindThreshold=.65*.65*(vxi*vxi+vyi*vyi);
      const minX=Math.max(0,Math.floor((xi-75)/CELL)),maxX=Math.min(COLS-1,Math.floor((xi+75)/CELL));
      const minY=Math.max(0,Math.floor((yi-75)/CELL)),maxY=Math.min(ROWS-1,Math.floor((yi+75)/CELL));
      let sx=0,sy=0,px=0,py=0,ux=0,uy=0,n=0;
      for (let gy=minY;gy<=maxY;gy++) {
        const cellDY=Math.max(gy*CELL-yi,0,yi-(gy+1)*CELL);
        for(let gx=minX;gx<=maxX;gx++) {
          const cellDX=Math.max(gx*CELL-xi,0,xi-(gx+1)*CELL);
          // Reject whole cells outside the perception circle before reading birds.
          if(cellDX*cellDX+cellDY*cellDY>5625) continue;
          const cell=gy*COLS+gx,end=offsets[cell+1];
          for(let k=offsets[cell];k<end;k++) {
            const j=order[k];
            const dx=x[j]-xi,dy=y[j]-yi,d2=dx*dx+dy*dy;
            if(d2>5625 || d2<.00001) continue;
            if(d2<324) { const w=(1-Math.sqrt(d2)/18)/Math.max(d2,1); sx-=dx*w;sy-=dy*w; }
            // Equivalent cone test without a square root for every neighbour.
            const dot=dx*vxi+dy*vyi;
            if(dot<0 && dot*dot>blindThreshold*d2) continue;
            const w=1-d2/5625; px+=dx*w;py+=dy*w;ux+=vx[j]*w;uy+=vy[j]*w;n+=w;
          }
        }
      }
      let fx=sx*1250*settings.separation,fy=sy*1250*settings.separation;
      if(n>0) {fx+=(ux/n-vx[i])*1.7*settings.alignment+px/n*.65*settings.cohesion;fy+=(uy/n-vy[i])*1.7*settings.alignment+py/n*.65*settings.cohesion;}
      // A broad, soft elliptical boundary turns birds before they meet the frame.
      const ex=(x[i]-800)/650,ey=(y[i]-500)/370,q=Math.hypot(ex,ey);
      if(q>.72) {const force=(q-.72)*190;fx-=ex/q*force;fy-=ey/q*force;}
      // Smooth correlated variation, without a shared target or scripted orbit.
      const wave=Math.sin(this.time*.43+x[i]*.004)+.5*Math.sin(this.time*.7+y[i]*.007+this.phase[i]);
      const v=Math.hypot(vx[i],vy[i]);fx+=-vy[i]/v*wave*7;fy+=vx[i]/v*wave*7;
      const target=80+12*Math.sin(this.phase[i]);fx+=vx[i]/v*(target-v)*1.4;fy+=vy[i]/v*(target-v)*1.4;
      const limit=Math.min(1,100/Math.max(.001,Math.hypot(fx,fy)));ax[i]=fx*limit;ay[i]=fy*limit;
    }
  }
  step(dt) {
    // Re-evaluate social decisions at 30 Hz; integrate motion at the caller's
    // 120 Hz (or finer export) timestep. No neighbours are sampled or omitted.
    if(this.steeringElapsed >= 1/30 - 1e-10) {
      this.updateSteering();
      this.steeringElapsed %= 1/30;
      if(this.steeringElapsed >= 1/30 - 1e-10) this.steeringElapsed = 0;
    }
    const {count,x,y,vx,vy,ax,ay} = this;
    for(let i=0;i<count;i++) {
      vx[i]+=ax[i]*dt;vy[i]+=ay[i]*dt;
      const v=Math.hypot(vx[i],vy[i]),scale=Math.max(45,Math.min(115,v))/Math.max(v,.0001);
      vx[i]*=scale;vy[i]*=scale;x[i]+=vx[i]*dt;y[i]+=vy[i]*dt;
    }
    this.time+=dt; this.steeringElapsed+=dt;
  }
}
