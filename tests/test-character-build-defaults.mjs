import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeOwnedCharacterBuilds} from '../data/character-build-defaults.mjs';
import {createInitialData} from '../data/player-registration.mjs';
test('owned profile reset equips B1 only, returns items to inventory and preserves ownership and stats',()=>{
 const weapon={id:1,type:'Weapon',level:100},artifact={id:2,type:'Artifact',piece_num:1};
 const original={gold:123,c_owned:[1,0,1],c1:{level:72,star_level:4,equip:{weapon:[weapon],artifact1:[artifact]}},c_skill2_owned:[[1]],inventory1:[],inventory2:[]};
 const data=initializeOwnedCharacterBuilds(original);
 assert.equal(data.gold,123);assert.deepEqual(data.c_owned,[1,0,1]);assert.deepEqual(data.c_skill2_owned,[[1]]);
 assert.equal(data.c1.level,72);assert.equal(data.character_builds.c1.stars,4);
 assert.deepEqual(data.character_builds.c1.loadout,{basic:['B1'],special:['',''],ultimate:[''],technical:['']});
 assert.deepEqual(data.c_equipped_skills[0],[1,0,0,0,0,0]);assert(!data.character_builds.c2);
 assert.deepEqual(data.inventory1,[weapon]);assert.deepEqual(data.inventory2,[artifact]);assert.deepEqual(data.c1.equip.weapon,[]);
 assert.deepEqual(original.inventory1,[]);
 data.character_builds.c1.loadout.special=['S1',''];assert.equal(initializeOwnedCharacterBuilds(data),data);
});
test('new D1 and offline registrations use the same owned-character defaults',()=>{
 const data=createInitialData();
 for(const [index,owned]of data.c_owned.entries())if(owned){const build=data.character_builds['c'+(index+1)];assert.deepEqual(build.loadout.basic,['B1']);assert.deepEqual(build.loadout.special,['','']);assert.equal(build.gear.weapon,'');assert.equal(build.gear.artifactRarity,'SSR');}
});

test('account Star Level comes from owned character progression, never the saved test build',async()=>{
 const {ownedCharacterStarLevel}=await import('../data/character-build-defaults.mjs');
 const data={c_owned:[1,1,0],c1:{star_level:8},c2:{star_level:'3'},c3:{star_level:16},character_builds:{c1:{stars:16}}};
 assert.equal(ownedCharacterStarLevel(data,'c1'),8);
 assert.equal(ownedCharacterStarLevel(data,'c2'),3);
 assert.equal(ownedCharacterStarLevel(data,'c3'),0);
 data.c1.star_level=99;assert.equal(ownedCharacterStarLevel(data,'c1'),16);
 data.c1.star_level=-2;assert.equal(ownedCharacterStarLevel(data,'c1'),0);
});
