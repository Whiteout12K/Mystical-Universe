import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTeamCoverage} from '../assets/js/site-enhancements/team-coverage.js';
const context={effects:{shield:{name:'Shield',description:'Protects the user with a shield.'}},catalogs:{weapons:{w1:{name:'Medic Weapon',reference_sections:[{paragraphs:['Restores health to allies.']}]}},artifacts:{a1:{name:'Purity',set_bonuses:[{pieces:2,description:['Removes debuffs from allies.']}]}}},character:id=>({name:id,skills:['B1','T1','Dupes']}),skills:id=>({B1:{name:'Strike',description:'Deals damage and stuns opponents.'},T1:{name:'Guard',description:'Gains [Shield].'},Dupes:{name:'Stars',additional:[{level:2,text:'Restores mana to allies.'}]}})};
const plan=()=>({team:['c1'],support:'c2',loadouts:{c1:{basic:['B1']},c2:{basic:['B1'],technical:['T1']}},stars:{c1:0,c2:0},equipment:{}});
const get=(p,id)=>analyzeTeamCoverage(context,p).find(c=>c.id===id).sources;
test('coverage uses selected skills and only Technical for support',()=>{const p=plan();assert(get(p,'control').some(s=>s.owner==='c1'));assert(!get(p,'control').some(s=>s.owner==='c2'));assert(get(p,'defense').some(s=>s.owner==='c2'&&s.target==='self'));assert.equal(get(p,'healing').length,0);});
test('coverage respects Star Levels, equipment and artifact piece requirements',()=>{const p=plan();assert.equal(get(p,'resources').length,0);p.stars.c1=2;assert(get(p,'resources').length);p.equipment.c1={weapon:'w1',artifacts:['a1']};assert(get(p,'healing').length);assert.equal(get(p,'cleansing').length,0);p.equipment.c1.artifacts.push('a1');assert(get(p,'cleansing').length);});
test('new authored skills and resonance are analyzed without coverage metadata',()=>{const p=plan();p.team=[];p.support='';p.resonance={id:'c3',skill:'B1'};assert(get(p,'control').some(s=>s.owner==='c3'));});

test('Healing Rate is a stat and actual healing remains detected',()=>{
 const p=plan(),local={...context,skills:()=>({B1:{name:'Stat',description:'Increases Healing Rate by 20%.'}})};
 assert.equal(analyzeTeamCoverage(local,p).find(c=>c.id==='healing').sources.length,0);
 local.skills=()=>({B1:{name:'Heal',description:'Increases Healing Rate by 20%. Heals allies.'}});
 assert(analyzeTeamCoverage(local,p).find(c=>c.id==='healing').sources.length);
});
test('Star Level sources use the unlocked level rather than Dupes',()=>{
 const p=plan();p.stars.c1=2;
 assert(get(p,'resources').some(s=>s.name==='Star Level 2'));
});

test('coverage lists the requested categories in order and separates specialist capabilities',()=>{
 const local={...context,skills:()=>({B1:{name:'Tools',description:'Gains a shield. Reduces incoming damage. Deals fire damage while off-field. Reduces enemy resistance. Increases fire damage.'}})};
 const result=analyzeTeamCoverage(local,plan());
 assert.deepEqual(result.map(c=>c.label),['Healing','Defense','Damage Reduction','Damage','Off-Field Damage','Cleansing','Stat Buffs','Control','Resistance Reduction','Element Buff','Resource Support']);
 for(const id of ['defense','damage-reduction','damage','off-field-damage','resistance-reduction','element-buff'])assert(result.find(c=>c.id===id).sources.length,id);
});
test('ordinary damage and defensive resistance boosts do not imply specialist coverage',()=>{
 const local={...context,skills:()=>({B1:{name:'Basic',description:'Deals damage. Increases resistance.'}})};
 const result=analyzeTeamCoverage(local,plan());
 for(const id of ['off-field-damage','resistance-reduction','element-buff','damage-reduction'])assert.equal(result.find(c=>c.id===id).sources.length,0,id);
});
