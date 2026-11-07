import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {normalizePlan,planHash,parsePlanHash,artifactBonuses,resonanceAssessment,equipmentInteractions} from '../assets/js/site-enhancements/team-builder-model.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const roster=Object.fromEntries(Object.entries(read('images/mlg-assets/data-character.json')).filter(([id])=>/^c\d+$/.test(id)));
const catalogues=Object.fromEntries(['weapons','accessories','artifacts'].map((kind,i)=>[kind,read('images/mlg-assets/data-'+['weapon','accessory','artifact'][i]+'.json')]));
const data=Object.fromEntries(Object.keys(roster).map(id=>{const file=new URL('../images/mlg-assets/Characters/'+id.toUpperCase()+'/'+id+'.json',import.meta.url);return [id,existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{}];}));
test('shared plans validate IDs, duplicates, equipment restrictions and skill choices',()=>{
 const plan=normalizePlan({team:['c1','c1','c6'],support:'c6',resonance:{id:'c1',skill:'B1'},equipment:{c1:{weapon:'w1',accessory:'a1',artifacts:['o1','o1','invalid','o3']},c6:{weapon:'w1'}},technical:{c1:'T2'}},roster,catalogues,data);
 assert.deepEqual(plan.team,['c1','','c6']);assert.equal(plan.support,'');assert.equal(plan.resonance,null);assert.equal(plan.equipment.c1.weapon,'w1');assert.equal(plan.equipment.c6.weapon,'');assert.deepEqual(plan.equipment.c1.artifacts,['o1','o1','','o3']);assert.equal(plan.technical.c1,'T2');assert(!Object.hasOwn(plan.equipment,'invalid'));
 assert.deepEqual(normalizePlan({team:['__proto__','missing','c2'],resonance:{id:'__proto__',skill:'T1'}},roster,catalogues,data).team,['','','c2']);
});
test('share link round trips order, support, Resonance, equipment and personal skill',()=>{
 const plan=normalizePlan({team:['c6','c1','c5'],support:'c2',resonance:{id:'c1',skill:'T2'},technical:{c1:'T1'},equipment:{c1:{weapon:'w1',accessory:'a1',artifacts:['o1','o1','o1','o1']}}},roster,catalogues,data);
 assert.deepEqual(normalizePlan(parsePlanHash(planHash(plan)),roster,catalogues,data),plan);assert.equal(parsePlanHash('#other'),null);assert.throws(()=>parsePlanHash('#team=%broken'));assert.throws(()=>parsePlanHash('#team='+encodeURIComponent(JSON.stringify({version:99,team:[]}))));
});
test('artifact bonuses require the actual matching piece counts',()=>{
 assert.deepEqual(artifactBonuses({artifacts:['o1','','','']},catalogues.artifacts),[]);
 assert.equal(artifactBonuses({artifacts:['o1','o1','o3','o3']},catalogues.artifacts).length,2);
 assert.deepEqual(artifactBonuses({artifacts:Array(4).fill('o1')},catalogues.artifacts).map(b=>b.pieces),[2,4]);
});
test('Resonance checks species, element, owner presence and exclusive abilities',()=>{
 const assess=(team,id,skill,support='')=>resonanceAssessment(normalizePlan({team,support,resonance:{id,skill}},roster,catalogues,data),roster,data);
 assert.deepEqual(assess(['c6','c3','c5'],'c1','T1').eligible,['c6','c5']);
 assert.deepEqual(assess(['c2','c3','c5'],'c1','T2').eligible,[]);
 assert.deepEqual(assess(['c1','c3','c5'],'c1','T2').eligible,['c1']);
 assert.deepEqual(assess(['c2','c5','c6'],'c3','T1','c3').eligible,[]);
 assert(assess(['c2','c5','c6'],'c3','T1').notes.some(n=>/owner is outside/.test(n)));
 assert.deepEqual(assess(['c1','c5','c6'],'c7','T1').eligible,['c1','c5','c6']);
 assert.equal(assess(['c1'],'c20','T1').status,'Skill details unavailable');
});
test('equipment interaction notes are conditional and source-specific',()=>{
 assert(equipmentInteractions('c1',{weapon:'w1',accessory:'a1',artifacts:Array(4).fill('o1')},roster,catalogues,data).some(n=>n.id==='w1'));
 assert(!equipmentInteractions('c1',{artifacts:['o1','o1','','']},roster,catalogues,data).some(n=>n.id==='o1'));
});
