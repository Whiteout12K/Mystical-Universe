import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {getEquipmentStatEntries,getArtifactMainStat,getArtifactSubStats,equipmentStatKey} from '../ml-game/apps/c-stat/equipment-stats.js';
import {getCharacterStats} from '../ml-game/apps/c-stat/c-stat.js';
const read=name=>JSON.parse(readFileSync(new URL('../images/mlg-assets/'+name+'.json',import.meta.url),'utf8'));
const rules=read('equipment-rules').artifacts.stat_scaling;
test('every weapon and accessory matches both codex endpoints and interpolates intermediate levels',()=>{
 for(const category of ['weapon','accessory'])for(const info of Object.values(read('data-'+category))){for(const [i,ref]of info.reference_stats.entries()){
  assert.equal(getEquipmentStatEntries(info,1)[i].value,ref.level_1);
  assert.equal(getEquipmentStatEntries(info,100)[i].value,ref.level_100);
  assert.equal(getEquipmentStatEntries(info,1000)[i].value,ref.level_100);
  assert.equal(getEquipmentStatEntries(info,50)[i].value,ref.level_1+(ref.level_100-ref.level_1)*49/99);
 }}
});
test('artifact main stats and substats follow the codex ranges and ignore old letter suffixes',()=>{
 for(const [name,rule]of Object.entries(rules.main_stats)){
  assert.equal(getArtifactMainStat({}, {main:name,main_value:999},1,rules).value,rule.value);
  assert.equal(getArtifactMainStat({}, {main:name},20,rules).value,rule.value*20);
  assert.equal(getArtifactMainStat({}, {main:name},200,rules).value,rule.value*20);
 }
 for(const [name,rule]of Object.entries(rules.substats)){
  assert.equal(getArtifactSubStats({sub_1:name,sub_1_value:999,sub_1_rolls:0},rules)[0].value,rule.value);
  assert.equal(getArtifactSubStats({sub_1:name,sub_1_rolls:5},rules)[0].value,rule.value*6);
 }
 assert.equal(equipmentStatKey('health (a, 1)'),'health');assert.equal(equipmentStatKey('crit_rate (f)'),'crit_rate');
 assert(!read('equipment-rules').artifacts.paragraphs.some(s=>/\([a-o](?:,\s*\d+)?\)/.test(s)));
});
test('profile totals use the same card values and add artifact crit points directly',async()=>{
 const original=globalThis.fetch;const databases=Object.fromEntries(['data-character','data-weapon','data-accessory','data-artifact','equipment-rules'].map(name=>['/images/mlg-assets/'+name+'.json',read(name)]));
 globalThis.fetch=async path=>({ok:true,json:async()=>databases[path]||{username:'Test',data:{c1:{level:1,equip:{weapon:{id:1,level:100},accessory:{id:1,level:100},artifact1:{id:1,level:20,main:'health',main_value:3,main_type:'%'},artifact4:{id:1,level:20,main:'crit_rate',main_value:1.5,main_type:'%',sub_1:'crit_rate',sub_1_value:5,sub_1_rolls:5,sub_1_type:'%'}}}}}});
 try{const result=await getCharacterStats('Test');assert.equal(result.character.stats.attack,490);assert.equal(result.character.stats.health,4048);assert.equal(result.character.stats.crit_rate,102);}finally{globalThis.fetch=original;}
});
test('profile viewer inline scripts remain valid and use the shared module',()=>{const html=readFileSync(new URL('../ml-game/apps/view.html',import.meta.url),'utf8');for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);assert(html.includes('equipmentStatModule.getEquipmentStatEntries'));assert(html.includes('equipmentStatModule.getArtifactMainStat'));assert(html.includes('equipmentStatModule.getArtifactSubStats'));});
