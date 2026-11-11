import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {indexReferences,renameReferences,functionDefinitions} from '../JScratch/editor/references.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../JScratch/editor/catalog.json',import.meta.url)));
test('rename changes exact broadcast uses across files, preserves strings, comments and references',()=>{
    const sources=[{name:'begin.js',source:'// World\nwhenStart(broadcast("World"),uiText("Label","World"));'},{name:'scenes/world.js',source:'whenBroadcast("World",setVar("World",1));'},{name:'sample.js',source:'broadcast("World");'}];
    const plan=renameReferences(sources,catalog,{kind:'broadcast',scope:''},'World','Battle');assert.equal(plan.matches.length,2);assert.equal(plan.changed.length,2);assert.match(plan.changed[0].source,/\/\/ World/);assert.match(plan.changed[0].source,/uiText\("Label","World"\)/);assert.match(plan.changed[1].source,/setVar\("World",1\)/);
});
test('private names use sprite and clone scopes, and methods own parameters',()=>{
    const sources=[{name:'a.js',source:'setSpriteVar("A","HP",1);setSpriteVar("B","HP",2);whenClone("A",setSpriteVar("self","HP",3));defineFunction("Damage",["HP"],returnFunction(functionValue("HP")));'}];
    const plan=renameReferences(sources,catalog,{kind:'spriteVar',scope:'A'},'HP','Health');assert.equal(plan.matches.length,2);assert.match(plan.changed[0].source,/setSpriteVar\("B","HP",2\)/);
    const local=renameReferences(sources,catalog,{kind:'functionLocal',scope:'Damage'},'HP','Amount');assert.equal(local.matches.length,2);assert.match(local.changed[0].source,/\["Amount"\]/);assert.equal(functionDefinitions(sources)[0].name,'Damage');
});
test('rename guards collisions and invalid source; computed references get warnings',()=>{
    const sources=[{name:'a.js',source:'broadcast("A");broadcast("B");broadcast(getVar("Next"));'}];assert.throws(()=>renameReferences(sources,catalog,{kind:'broadcast'},'A','B'),/already used/);assert.ok(indexReferences(sources,catalog).warnings.some(w=>w.kind==='broadcast'));assert.throws(()=>renameReferences([...sources,{name:'bad.js',source:'('}],catalog,{kind:'broadcast'},'A','C'),/invalid/);
});
test('sprite rename includes direct collision lists and raw runtime member access',()=>{
    const sources=[{name:'a.js',source:'createSprite("Wall");makeList("walls",["Wall"]);spriteCollisionTargets("Player",getList("walls"));ENGINE.sprites.Wall.x=1;'}];const plan=renameReferences(sources,catalog,{kind:'sprite'},'Wall','Stone wall');assert.equal(plan.matches.length,3);assert.match(plan.changed[0].source,/ENGINE.sprites\["Stone wall"\].x/);
});
