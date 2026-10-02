struct Bird { pv:vec4f, ap:vec4f }
struct Style { viewport:vec4f, bird:vec4f, trace:vec4f }
@group(0) @binding(0) var<storage,read> birds:array<Bird>;
@group(0) @binding(1) var<storage,read> previous:array<Bird>;
@group(0) @binding(2) var<uniform> style:Style;
fn clip(position:vec2f)->vec4f {
 let scale=min(style.viewport.x/1600.0,style.viewport.y/1000.0);
 let pixel=(position-vec2f(800,500))*scale;
 return vec4f(pixel.x*2.0/style.viewport.x,-pixel.y*2.0/style.viewport.y,0,1);
}
@vertex fn birdVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->@builtin(position) vec4f {
 let shape=array<vec2f,3>(vec2f(1,0),vec2f(-0.65,0.46),vec2f(-0.65,-0.46));
 let heading=normalize(birds[i].pv.zw);let p=shape[v]*style.viewport.z;
 return clip(birds[i].pv.xy+heading*p.x+vec2f(-heading.y,heading.x)*p.y);
}
@fragment fn birdFragment()->@location(0) vec4f {return style.bird;}
struct LineOutput {@builtin(position) position:vec4f,@location(0) side:f32,@location(1) halfWidth:f32}
@vertex fn lineVertex(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->LineOutput {
 let corners=array<vec2f,6>(vec2f(0,-1),vec2f(1,-1),vec2f(0,1),vec2f(0,1),vec2f(1,-1),vec2f(1,1));
 let start=previous[i].pv.xy;let end=birds[i].pv.xy;
 let delta=end-start;let direction=delta/max(length(delta),0.0001);
 let normal=vec2f(-direction.y,direction.x);let corner=corners[v];
 let scale=min(style.viewport.x/1600.0,style.viewport.y/1000.0);
 let halfWidth=0.325;let extent=halfWidth+1.0/scale;
 var out:LineOutput;out.position=clip(mix(start,end,corner.x)+normal*corner.y*extent);
 out.side=corner.y*extent;out.halfWidth=halfWidth;return out;
}
@fragment fn lineFragment(in:LineOutput)->@location(0) vec4f {
 let scale=min(style.viewport.x/1600.0,style.viewport.y/1000.0);
 let coverage=clamp((in.halfWidth-abs(in.side))*scale+0.5,0.0,1.0);
 return vec4f(coverage);
}
