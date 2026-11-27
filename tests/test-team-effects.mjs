import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {effectReferences,normalizeLoadout} from '../assets/js/site-enhancements/character-build-model.js';
import {equipmentSections} from '../assets/js/site-enhancements/equipment-catalog.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const roster=read('images/mlg-assets/data-character.json'),sources=read('data/skill-catalog.json').sources,effects=read('images/mlg-assets/data-effects.json'),rules=read('data/character-build-rules.json');
const catalogs=Object.fromEntries([['weapons','weapon'],['accessories','accessory'],['artifacts','artifact']].map(([k,f])=>[k,read('images/mlg-assets/data-'+f+'.json')]));
const context={roster,effects,catalogs,character:id=>({...roster[id],effect_targets:rules[id]?.effect_targets}),skills:id=>sources[id]||{}};
const code=readFileSync(new URL('../assets/js/site-enhancements/team-effects.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
const scope=vm.createContext({effectReferences,equipmentSections});vm.runInContext(code,scope);
test('team effects deduplicate each target, respect stars, and include equipped items',()=>{
 const plan={team:['c1','c2'],support:'',loadouts:Object.fromEntries(['c1','c2'].map(id=>[id,normalizeLoadout(null,roster[id],sources[id])])),equipment:{c1:{weapon:'w1',accessory:'a1',artifacts:[]}}};
 const rows=scope.collectTeamEffects(context,plan,{c2:{stars:1}});
 assert.equal(rows.filter(r=>r.id==='shield'&&r.target==='self').length,1);
 assert(!rows.some(r=>r.id==='black-ice'));
 assert(rows.some(r=>r.sources.some(s=>s.href?.includes('#weapon-w1'))));
 assert(rows.some(r=>r.sources.some(s=>s.href?.includes('#accessory-a1'))));
});
test('support uses passives and resonance adds only its chosen skill',()=>{
 const plan={team:[],support:'c1',loadouts:{},equipment:{},resonance:{id:'c2',skill:'T1'}};
 const rows=scope.collectTeamEffects(context,plan);
 assert(!rows.some(r=>r.sources.some(s=>s.owner==='c1'&&s.skill==='S2')));
 assert(rows.some(r=>r.id==='shadow-miasma'&&r.sources.some(s=>s.skill==='T1')));
 assert(!rows.some(r=>r.sources.some(s=>s.owner==='c2'&&s.skill==='Dupes')));
});
