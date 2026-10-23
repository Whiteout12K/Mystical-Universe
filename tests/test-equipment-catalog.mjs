import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {equipmentAnchor,equipmentImage,equipmentPieces,equipmentSections,catalogueSearchText} from '../js/site-enhancements/equipment-catalog.js';
const root=new URL('../',import.meta.url),read=name=>JSON.parse(readFileSync(new URL('images/mlg-assets/'+name,root),'utf8'));
const weapons=read('data-weapon.json'),accessories=read('data-accessory.json'),artifacts=read('data-artifact.json');
test('complete equipment catalogue retains stable IDs and separate item-specific descriptions',()=>{
 assert.equal(Object.keys(weapons).length,4);assert.equal(Object.keys(accessories).length,8);assert.equal(Object.keys(artifacts).length,8);
 assert.equal(weapons.w1.name,'Gladius Lucis');assert.equal(weapons.w2.name,'Icelorian Blade');assert.equal(accessories.a1.name,'Rune of the Spellcaster');assert.equal(artifacts.o4.name,'ITA Suit');
 assert.match(equipmentSections(weapons.w2)[0].title,/Night’s Bitter Edge/);assert.doesNotMatch(catalogueSearchText(weapons.w2),/Divine Swords|Luminous Rainecutter/);
 assert.equal(accessories.a2.name,'Water Spirit Rune');assert.deepEqual(equipmentSections(accessories.a2)[0].paragraphs,[]);
});
test('documented endpoint stats, restrictions, and source ambiguities remain explicit',()=>{
 assert.deepEqual(weapons.w1.reference_stats.map(s=>[s.level_1,s.level_100]),[[55,440],[4,32]]);
 assert.equal(weapons.w1.restriction,'Angelor only');
 for(const id of ['a3','a8']){assert.deepEqual(accessories[id].reference_stats.map(s=>s.name),['Attack','Attack']);assert(accessories[id].reference_notes.length);}
});
test('every artifact has four image-ready slots and two/four-piece bonuses',()=>{
 for(const a of Object.values(artifacts)){assert.equal(equipmentPieces(a).length,4);assert.deepEqual(a.set_bonuses.map(b=>b.pieces),[2,4]);for(const n of [1,2,3,4])assert.equal(typeof a[`piece_num_${n}_img`],'string');}
 assert.equal(equipmentPieces(artifacts.o1)[1].name,'Core Sprout of Origin');assert.equal(equipmentPieces(artifacts.o3)[2].name,'Enlightenment Dress');
});
test('equipment hash routes and optional images are stable without unresolved skill placeholders',()=>{
 assert.equal(equipmentAnchor('accessories','a1'),'accessory-a1');assert.equal(equipmentAnchor('artifacts','o1'),'artifact-o1');assert.equal(equipmentAnchor('weapons','w1'),'weapon-w1');
 for(const e of [...Object.values(weapons),...Object.values(accessories),...Object.values(artifacts)]){assert(!JSON.stringify(e.reference_sections).includes('data-dmg'));assert(e.source.url.startsWith('https://docs.google.com/'));const image=equipmentImage(e);if(image)assert(existsSync(new URL(image.slice(1),root)),image);}
 assert.equal(equipmentImage(accessories.a1),'');
});
