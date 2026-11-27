import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeLoadout, loadoutLimits, selectedSkills, effectReferences} from '../assets/js/site-enhancements/character-build-model.js';
import {normalizePlan, planHash, parsePlanHash} from '../assets/js/site-enhancements/team-builder-model.js';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const roster = read('images/mlg-assets/data-character.json'), sources = read('data/skill-catalog.json').sources, effects = read('images/mlg-assets/data-effects.json'), guides = read('data/character-build-rules.json');
const catalogs = Object.fromEntries([['weapons','weapon'],['accessories','accessory'],['artifacts','artifact']].map(([key,file]) => [key,read('images/mlg-assets/data-'+file+'.json')]));
test('default kits enforce one Basic, two different Specials, one Ultimate and one Technical', () => {
  assert.deepEqual(loadoutLimits(roster.c1), {basic:1,special:2,ultimate:1,technical:1});
  const kit=normalizeLoadout(undefined,roster.c1,sources.c1);
  assert.deepEqual(kit,{basic:['B1'],special:['S1','S2'],ultimate:['U1'],technical:['T1']});
  const invalid=normalizeLoadout({basic:['S1','B1'],special:['S2','S2','S3'],ultimate:['missing'],technical:['T2','T3']},roster.c1,sources.c1);
  assert.deepEqual(invalid,{basic:[''],special:['S2',''],ultimate:[''],technical:['T2']});
});
test('character-specific slot rules and explicit empty slots are preserved', () => {
  const character={...roster.c1,skill_slots:{special:3,technical:2,ultimate:0}};
  const kit=normalizeLoadout(undefined,character,sources.c1);
  assert.equal(kit.special.length,3);assert.equal(kit.technical.length,2);assert.equal(kit.ultimate.length,0);
  assert.equal(normalizeLoadout({special:['','S3']},roster.c1,sources.c1).special[0],'');
});
test('subordinate variants use the corresponding skill overrides and share the variant in team links', () => {
  const kit=normalizeLoadout({variant:1},roster.c11,sources.c11);
  assert.equal(kit.basic[0],'B1-2');assert.equal(kit.special[0],'S1-2');assert.equal(kit.variant,1);
  const plan=normalizePlan({team:['c11'],loadouts:{c11:kit}},roster,catalogs,sources);
  assert.equal(normalizePlan(parsePlanHash(planHash(plan)),roster,catalogs,sources).loadouts.c11.variant,1);
});
test('legacy team links retain Technical choice and new links preserve kits and equipment', () => {
  const old=normalizePlan({team:['c1'],technical:{c1:'T2'}},roster,catalogs,sources);
  assert.equal(old.loadouts.c1.technical[0],'T2');
  old.loadouts.c1.special=['S3','S2'];old.equipment.c1.weapon='w1';
  const restored=normalizePlan(parsePlanHash(planHash(old)),roster,catalogs,sources);
  assert.deepEqual(restored,old);
});
test('effect targets use explicit mappings, maintain self debuffs, and honor unlock levels', () => {
  const character={...roster.c2,effect_targets:guides.c2.effect_targets};
  const kit=normalizeLoadout(undefined,character,sources.c2);
  const rows=effectReferences(character,sources.c2,effects,kit,6);
  assert(rows.some(row=>row.id==='fatigue'&&row.target==='self'));
  assert(!rows.some(row=>row.id==='fatigue'&&row.target==='enemies'));
  assert(rows.some(row=>row.id==='midnight-frost'&&row.target==='enemies'));
  assert(!effectReferences(character,sources.c2,effects,kit,5).some(row=>row.id==='black-ice'));
  assert(!effectReferences(character,sources.c2,effects,kit,1).some(row=>row.id==='flash'&&row.target==='allies'));
  assert(effectReferences(character,sources.c2,effects,kit,2).some(row=>row.id==='flash'&&row.target==='allies'));
});

test('target analysis separates self gains, allies and opponent effects within one paragraph',async()=>{
 const {inferEffectTargets}=await import('../assets/js/site-enhancements/character-build-model.js');
 const identify=(text,id)=>inferEffectTargets(text,effects[id],roster.c3).sort();
 assert.deepEqual(identify('For every opponent hit, {{nickname}} will gain [Let\'m Cook]. {{Subject}} inflicts [Attack Down I] on nearby opponents.','letm-cook'),['self']);
 assert.deepEqual(identify('For every opponent hit, {{nickname}} will gain [Let\'m Cook]. {{Subject}} inflicts [Attack Down I] on nearby opponents.','attack-down1'),['enemies']);
 const text='Opponents get [Slowness] and allies and self get [Speed Up].';
 assert.deepEqual(identify(text,'slowness'),['enemies']);
 assert.deepEqual(identify(text,'speed-up'),['allies','self']);
 assert.deepEqual(identify('Give [Shield] to self and allies.','shield'),['allies','self']);
 assert.deepEqual(identify('{{nickname}} gains [Fatigue].','fatigue'),['self']);
 assert.deepEqual(identify('Enemies receive [Shield].','shield'),['enemies']);
 assert.deepEqual(identify('{{nickname}} inflicts [Fatigue] on self.','fatigue'),['self']);
 assert.deepEqual(identify('Rapidly consuming Dash Skills gives {{nickname}} [Gamer] and [Tinkering].','gamer'),['self']);
 assert.deepEqual(identify('Apply [Electrocute] per hit.','electrocute'),['enemies']);
 assert.deepEqual(identify('{{effect:freeze}}','freeze'),[]);
});
test('target analysis reads numbered descriptions and keeps star-specific target metadata',()=>{
 const definitions={B1:{description:'A hit.',description2:'Inflict [Freeze] on enemies.'}};
 assert(effectReferences({},definitions,effects,{basic:['B1']}).some(row=>row.id==='freeze'&&row.target==='enemies'));
 const character={...roster.c3,effect_targets:guides.c3.effect_targets};
 const rows=effectReferences(character,sources.c3,effects,normalizeLoadout(null,character,sources.c3),1);
 assert(!rows.some(row=>row.id==='super-shield'));
});

test('each character star limit follows authored Dupes rather than the number of star images',async()=>{
 const {maxCharacterStarLevel}=await import('../assets/js/site-enhancements/character-build-model.js');
 assert.equal(maxCharacterStarLevel(sources.c1),5);
 assert.equal(maxCharacterStarLevel(sources.c2),6);
 assert.equal(maxCharacterStarLevel(sources.c4),0);
 assert.equal(maxCharacterStarLevel({Dupes:{additional:[{level:1},{level:9},{level:'12'},{level:-3},{level:2.5}]}}),12);
});
