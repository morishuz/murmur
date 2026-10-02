import {Flock as Before} from '../test/fixtures/reference-flock.js';
import {Flock as After} from '../src/flock.js';
for(const count of [1000,3000]){
 const original=new Before(count);for(let i=0;i<1200;i++)original.step(1/120);
 for(const [name,Type] of [['before',Before],['after',After]]){
 const world=new Type(count);for(const key of ['x','y','vx','vy','phase'])world[key].set(original[key]);world.time=original.time;
 for(let i=0;i<30;i++)world.step(1/120);
 const start=performance.now();for(let i=0;i<180;i++)world.step(1/120);
 console.log(JSON.stringify({count,name,msPerStep:(performance.now()-start)/180}));
 }
}
