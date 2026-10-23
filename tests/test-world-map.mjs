import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('ml-game/apps/world-map/locations.json',root),'utf8'));
const all=[...data.districts,...data.landmarks];
test('atlas includes every district once and keeps Regnum in Lux Urbis',()=>{
 assert.deepEqual(data.districts.map(d=>d.number).sort((a,b)=>a-b),Array.from({length:13},(_,i)=>i+1));
 assert.equal(new Set(all.map(r=>r.id)).size,all.length);
 assert.match(all.find(r=>r.id==='regnum').subtitle,/District 7/);
 assert.match(all.find(r=>r.id==='district7').name,/Lux Urbis/);
 assert.equal(all.find(r=>r.id==='district9').name,'District 9');
});
test('glossary geography separates mainland districts from the hidden island',()=>{
 for(const [number,country]of [[1,'Japanese'],[2,'France'],[6,'Russia'],[8,'China'],[9,'Australia'],[10,'Africa'],[11,'Canada'],[12,'Italy']]){
  const d=data.districts.find(r=>r.number===number);assert.equal(d.view,'world');assert(d.details.Location.includes(country));
 }
 assert.deepEqual(data.districts.filter(d=>d.view==='island').map(d=>d.number),[3,4,5,7,13]);
});
test('map records have valid coordinates and only working local destinations',()=>{
 for(const r of all){assert(r.x>=0&&r.x<=1200&&r.y>=0&&r.y<=680,r.id);assert(r.description.length>50,r.id);
  for(const link of r.links||[]){const u=new URL(link.url,'https://mystical.test');assert.equal(u.origin,'https://mystical.test');assert(existsSync(new URL(u.pathname.slice(1),root)),link.url);}
 }
});
