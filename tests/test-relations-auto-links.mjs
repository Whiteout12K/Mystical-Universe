import test from 'node:test';
import assert from 'node:assert/strict';
import {autoLinkRelations,serializeRelations,parseRelationsSource,writeRelationsFile} from '../wiki/wiki-code/relations-data.js';
const fixture=(relatives,affiliations='')=>({version:1,characters:[{id:'test',name:'Test',path:'',relatives,affiliations}]});
test('names and affiliations get their distinct routes, preserving hyphens and role notes',()=>{
 const result=autoLinkRelations(fixture('Lynn Kara-Reeyn (foster sister)\nPrince Aether (father, deceased)','IT Agency\nDistrict 5 (former)')).characters[0];
 assert.equal(result.relatives,'[[char/lynn_kara-reeyn|Lynn Kara-Reeyn]] (foster sister)\n[[char/prince_aether|Prince Aether]] (father, deceased)');
 assert.equal(result.affiliations,'[[location/it_agency|IT Agency]]\n[[location/district_5|District 5]] (former)');
});
test('explicit destinations, labels and external links remain unchanged',()=>{
 const source='[[fandom:Other|Other Name]] (father)\n[[char/river_grantia|River Grant]] (sister)\n[https://example.com Person] (friend)';
 assert.equal(autoLinkRelations(fixture(source)).characters[0].relatives,source);
});
test('spoilers, nested spoilers and notes keep their markup',()=>{
 const result=autoLinkRelations(fixture('{{Spoiler|Prince Aether (former fiancé)}}\n{{Spoiler|{{Spoiler|Lux Luces}} (sister)}}\nLux Luces ({{Spoiler|deceased}})')).characters[0].relatives;
 assert.equal(result,'{{Spoiler|[[char/prince_aether|Prince Aether]] (former fiancé)}}\n{{Spoiler|{{Spoiler|[[char/lux_luces|Lux Luces]]}} (sister)}}\n[[char/lux_luces|Lux Luces]] ({{Spoiler|deceased}})');
});
test('repeated saves are idempotent, preserve blanks and never mutate the draft',()=>{
 const data=fixture('  Lux Luces (sister)\n\n[[Other]]','{{Spoiler|Secret Society}}');const original=structuredClone(data);
 const result=autoLinkRelations(data);assert.deepEqual(data,original);assert.deepEqual(autoLinkRelations(result),result);assert.match(result.characters[0].affiliations,/location\/secret_society/);assert.match(result.characters[0].relatives,/^  \[\[/);
});
test('save and reload retain automatically linked markup with conflict protection',async()=>{
 const data=fixture('Lux Luces (friend)','District 7'),baseline=serializeRelations(data);let disk=baseline;
 const handle={getFile:async()=>({text:async()=>disk}),createWritable:async()=>({write:async content=>{disk=content},close:async()=>{}})};
 const saved=autoLinkRelations(data);await writeRelationsFile(handle,saved,baseline);
 const reloaded=parseRelationsSource(disk);assert.deepEqual(reloaded,saved);assert.deepEqual(autoLinkRelations(reloaded),saved);
 await assert.rejects(()=>writeRelationsFile(handle,saved,baseline),/changed outside/);
});
