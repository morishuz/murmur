struct Style { viewport:vec4f, bird:vec4f, trace:vec4f }
@group(0) @binding(0) var ink:texture_2d<f32>;
@group(0) @binding(1) var inkSampler:sampler;
@group(0) @binding(2) var<uniform> style:Style;
struct Output {@builtin(position) position:vec4f,@location(0) uv:vec2f}
@vertex fn vertex(@builtin(vertex_index) i:u32)->Output {
 let corners=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(0,1),vec2f(0,1),vec2f(1,0),vec2f(1,1));
 let uv=corners[i];let scale=min(style.viewport.x/1600.0,style.viewport.y/1000.0);
 let p=(uv-0.5)*vec2f(1600,1000)*scale;
 var out:Output;out.position=vec4f(p.x*2.0/style.viewport.x,-p.y*2.0/style.viewport.y,0,1);out.uv=uv;return out;
}
@fragment fn fragment(in:Output)->@location(0) vec4f {
 let alpha=textureSample(ink,inkSampler,in.uv).r*style.viewport.w;
 return vec4f(style.trace.rgb*alpha,alpha);
}
