import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../wiki/wiki-code/relationship-layout.js',import.meta.url),'utf8');
function setup(){const window={};let yields=0;runInNewContext(source,{window,setTimeout:resolve=>{yields++;resolve();}});return {layout:window.layoutWikiRelationships,get yields(){return yields;}};}
const distance=(p,i,j)=>Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y);
test('family and spiritual bonds sit closer than other personal ties and affiliations',async()=>{
 const {layout}=setup();
 const edges=[{i:0,j:1,type:'personal',close:true},{i:0,j:2,type:'personal',close:true},{i:0,j:3,type:'personal',close:false},{i:0,j:4,type:'affiliation',close:false}];
 const p=await layout(5,edges);
 assert.ok(Math.max(distance(p,0,1),distance(p,0,2))<distance(p,0,3));
 assert.ok(distance(p,0,3)<distance(p,0,4));
});
test('measured names stay separated, including long labels and isolated characters',async()=>{
 const api=setup(),bounds=Array.from({length:24},(_,i)=>({x:i%3?-65:-160,y:-38,width:i%3?130:320,height:108}));
 const edges=Array.from({length:16},(_,i)=>({i:Math.floor(i/4),j:i+4,type:'personal',close:true}));
 const p=await api.layout(bounds.length,edges,bounds);
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  const a=bounds[i],b=bounds[j];
  assert.ok(p[i].x+a.x+a.width+17.9<=p[j].x+b.x||p[j].x+b.x+b.width+17.9<=p[i].x+a.x||p[i].y+a.y+a.height+17.9<=p[j].y+b.y||p[j].y+b.y+b.height+17.9<=p[i].y+a.y,`labels ${i} and ${j} overlap`);
 }
 assert.ok(api.yields>0,'layout yields to input and painting');
});
test('layout is deterministic and supports empty or disconnected graphs',async()=>{
 const {layout}=setup();assert.equal((await layout(0,[])).length,0);
 const a=await layout(8,[]),b=await layout(8,[]);
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.ok(a.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('former partners sit farther apart than current personal ties',async()=>{
 const {layout}=setup();
 const p=await layout(4,[{i:0,j:1,type:'personal'},{i:0,j:2,type:'personal',former:true},{i:0,j:3,type:'affiliation'}]);
 assert.ok(distance(p,0,1)<distance(p,0,2));
 assert.ok(distance(p,0,2)<distance(p,0,3));
});
test('love interests sit almost as close as family and closer than other personal ties',async()=>{
 const {layout}=setup();
 const p=await layout(4,[{i:0,j:1,type:'personal',close:true},{i:0,j:2,type:'personal',loveInterest:true},{i:0,j:3,type:'personal'}]);
 const family=distance(p,0,1),love=distance(p,0,2),other=distance(p,0,3);
 assert.ok(love>family);assert.ok(love<family*1.4);assert.ok(love<other);
});
