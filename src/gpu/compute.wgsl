struct Bird { pv: vec4f, ap: vec4f }
struct Params { timing: vec4f, social: vec4f }
@group(0) @binding(0) var<storage,read_write> birds: array<Bird>;
@group(0) @binding(1) var<storage,read_write> heads: array<atomic<i32>>;
@group(0) @binding(2) var<storage,read_write> next: array<i32>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(64)
fn clearGrid(@builtin(global_invocation_id) id: vec3u) {
 if(id.x<2560u){atomicStore(&heads[id.x],-1);}
}
@compute @workgroup_size(64)
fn buildGrid(@builtin(global_invocation_id) id: vec3u) {
 let i=id.x;if(i>=u32(params.timing.z)){return;}
 let cell=clamp(vec2i(floor(birds[i].pv.xy/25.0)),vec2i(0),vec2i(63,39));
 next[i]=atomicExchange(&heads[u32(cell.y*64+cell.x)],i32(i));
}
@compute @workgroup_size(64)
fn steer(@builtin(global_invocation_id) id: vec3u) {
 let i=id.x;if(i>=u32(params.timing.z)){return;}
 let position=birds[i].pv.xy;let velocity=birds[i].pv.zw;
 let low=max(vec2i(0),vec2i(floor((position-75.0)/25.0)));
 let high=min(vec2i(63,39),vec2i(floor((position+75.0)/25.0)));
 let blind=0.4225*dot(velocity,velocity);
 var separation=vec2f(0);var centre=vec2f(0);var alignment=vec2f(0);var weight=0.0;
 for(var gy=low.y;gy<=high.y;gy++) {
  for(var gx=low.x;gx<=high.x;gx++) {
   let near=max(max(vec2f(vec2i(gx,gy))*25.0-position,vec2f(0)),position-vec2f(vec2i(gx+1,gy+1))*25.0);
   if(dot(near,near)>5625.0){continue;}
   var j=atomicLoad(&heads[u32(gy*64+gx)]);
   loop {
    if(j<0){break;}
    let other=birds[u32(j)].pv;let delta=other.xy-position;let d2=dot(delta,delta);
    if(d2<=5625.0 && d2>=0.00001) {
     if(d2<324.0){separation-=delta*((1.0-sqrt(d2)/18.0)/max(d2,1.0));}
     let projection=dot(delta,velocity);
     if(!(projection<0.0 && projection*projection>blind*d2)) {
      let w=1.0-d2/5625.0;centre+=delta*w;alignment+=other.zw*w;weight+=w;
     }
    }
    j=next[u32(j)];
   }
  }
 }
 var force=separation*1250.0*params.social.z;
 if(weight>0.0){force+=(alignment/weight-velocity)*1.7*params.social.x+centre/weight*0.65*params.social.y;}
 let edge=(position-vec2f(800,500))/vec2f(650,370);let q=length(edge);
 if(q>0.72){force-=edge/q*((q-0.72)*190.0);}
 let phase=birds[i].ap.z;let time=params.timing.y;
 let wave=sin(time*0.43+position.x*0.004)+0.5*sin(time*0.7+position.y*0.007+phase);
 let speed=length(velocity);let heading=velocity/speed;
 force+=vec2f(-heading.y,heading.x)*wave*7.0;
 force+=heading*(80.0+12.0*sin(phase)-speed)*1.4;
 force*=min(1.0,100.0/max(0.001,length(force)));
 birds[i].ap=vec4f(force,phase,0);
}
@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) id: vec3u) {
 let i=id.x;if(i>=u32(params.timing.z)){return;}
 let dt=params.timing.x;
 var velocity=birds[i].pv.zw+birds[i].ap.xy*dt;
 let speed=length(velocity);velocity*=clamp(speed,45.0,115.0)/max(speed,0.0001);
 birds[i].pv=vec4f(birds[i].pv.xy+velocity*dt,velocity);
}
