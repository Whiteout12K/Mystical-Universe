import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const roster=JSON.parse(read('images/mlg-assets/data-character.json'));
const html=read('webpages/apps/team_builder.html');
const getCharacters=html.match(/const getCharacters=(.*);\n/)[0];
const bonds=html.slice(html.indexOf('function getCharacterBonds(){'),html.indexOf('function getSynergies(){'));
test('Original and Alter synergies use exact form IDs and independent definitions',()=>{
 const scope=vm.createContext({roster});vm.runInContext(getCharacters+'\nlet active=[];const characters=getCharacters(roster);const activeIds=()=>active;\n'+bonds,scope);
 vm.runInContext("active=['c1','c2'];",scope);assert(scope.getCharacterBonds().some(b=>b.name==='Dynamic Duo'));
 vm.runInContext("active=['c1b','c2'];",scope);assert.equal(scope.getCharacterBonds().length,0);
 vm.runInContext("characters.c1b.character_synergies=[{with:['c2'],name:'Alter bond',effect:'Custom bonus'}];",scope);
 assert.equal(scope.getCharacterBonds()[0].name,'Alter bond');
 vm.runInContext("active=['c1','c2'];",scope);assert(scope.getCharacterBonds().every(b=>b.name!=='Alter bond'));
});
