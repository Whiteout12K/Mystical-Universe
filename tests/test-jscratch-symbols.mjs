import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SymbolLibrary,argumentPicker,stringLiteral} from '../JScratch/editor/symbols.mjs';
import {rgbToHsv,hsvToRgb,colorCss,parseColor} from '../JScratch/editor/color.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../JScratch/editor/catalog.json',import.meta.url),'utf8'));
const spec=(kind,scope='')=>({kind,scope});
test('project names are discovered across closed files, persist, and cannot be deleted while used',()=>{
    let sources=[{name:'begin.js',source:'whenStart(createSprite("Player"),setVar("Score",0),broadcast("World"));'},{name:'scenes/world.js',source:'whenBroadcast("World",moveTo("Player",0,0),changeVarBy("Score",1));'},{name:'sample.js',source:'createSprite("Example Only");'}];
    const library=new SymbolLibrary(catalog,{sources:()=>sources});assert.deepEqual(library.names(spec('broadcast')),['World']);assert.deepEqual(library.names(spec('sprite')),['Player']);assert.deepEqual(library.names(spec('variable')),['Score']);assert.equal(library.remove(spec('broadcast'),'World'),false);
    sources=[{name:'begin.js',source:'whenStart();'}];assert.equal(library.remove(spec('broadcast'),'World'),true);library.add(spec('broadcast'),'Custom');const saved=library.export(),restored=new SymbolLibrary(catalog,{data:saved});assert.deepEqual(restored.names(spec('broadcast')),['Custom']);
});
test('costume paths and sprite vars stay scoped to the owning sprite and clone family',()=>{
    let source='spriteCostume("A","a.gif");spriteCostume("B","b.gif");setSpriteVar("A","HP",10);setSpriteVar("B","Mana",20);whenClone("A",spriteCostume("self","clone.gif"),setSpriteVar("self","Age",0));';
    const library=new SymbolLibrary(catalog,{sources:()=>[{name:'world.js',source}]});assert.deepEqual(library.names(spec('costume','A')),['a.gif','clone.gif']);assert.deepEqual(library.names(spec('costume','B')),['b.gif']);assert.deepEqual(library.names(spec('spriteVar','A')),['Age','HP']);assert.deepEqual(library.names(spec('spriteVar','B')),['Mana']);
    library.add(spec('costume','B'),'a.gif');assert.equal(library.remove(spec('costume','B'),'a.gif'),true);assert.equal(library.remove(spec('costume','A'),'a.gif'),false);
    source='spriteCostume("B","b.gif");';assert.equal(library.remove(spec('costume','A'),'a.gif'),true);
});
test('dynamic names, raw-code references and incomplete code conservatively prevent deletion',()=>{
    let source='broadcast(getVar("Next"));customCommand("Player");';const library=new SymbolLibrary(catalog,{sources:()=>[{name:'game.js',source}]});library.add(spec('broadcast'),'World');library.add(spec('sprite'),'Player');assert.equal(library.remove(spec('broadcast'),'World'),false);assert.equal(library.remove(spec('sprite'),'Player'),false);source='(';assert.equal(library.remove(spec('sprite'),'Player'),false);source='';assert.equal(library.remove(spec('sprite'),'Player'),true);
});
test('picker roles distinguish name scopes, colors, numeric inputs and fixed choices',()=>{
    const byName=name=>catalog.find(d=>d.name===name);assert.equal(argumentPicker(byName('spriteCostume'),1,()=> 'Player').scope,'Player');assert.equal(argumentPicker(byName('getSpriteVar'),1,()=> 'self','Player').scope,'Player');assert.equal(argumentPicker(byName('canvasColor'),0,()=>null).kind,'color');assert.equal(argumentPicker(byName('moveTo'),1,()=>null),null);assert.deepEqual(argumentPicker(byName('coordinatePlane'),1,()=>null).options,['left','right']);assert.equal(stringLiteral('getVar("Actor")'),null);assert.equal(stringLiteral('"Player"'),'Player');
});
test('HSV color changes preserve alpha and produce valid CSS without manual hex entry',()=>{
    assert.deepEqual(hsvToRgb(rgbToHsv(255,0,0,.25)),{r:255,g:0,b:0,a:.25});assert.equal(colorCss(parseColor('#00ff00')),'#00ff00');assert.equal(colorCss(parseColor('rgba(255, 0, 0, 0.4)')),'rgba(255, 0, 0, 0.4)');assert.ok(Math.abs(parseColor('#1234').a-68/255)<1e-9);assert.equal(parseColor('#12345'),null);assert.equal(colorCss({h:240,s:1,v:.5,a:0}),'rgba(0, 0, 128, 0)');
});

test('sprite references stored in collision lists also protect names from deletion',()=>{
    let source='makeList("Walls",["Wall"]);addToList("Walls","Door");spriteCollisionTargets("Player",getList("Walls"));';const library=new SymbolLibrary(catalog,{sources:()=>[{name:'game.js',source}]});
    assert.ok(library.names(spec('sprite')).includes('Wall'));assert.equal(library.remove(spec('sprite'),'Wall'),false);assert.equal(library.remove(spec('sprite'),'Door'),false);
    source='';assert.equal(library.remove(spec('sprite'),'Wall'),true);
});

test('raw property references and computed variable lookups cannot silently remove used names',()=>{
    let source='ENGINE.sprites.Player.x=5;';const library=new SymbolLibrary(catalog,{sources:()=>[{name:'game.js',source}]});library.add(spec('sprite'),'Player');assert.equal(library.remove(spec('sprite'),'Player'),false);source='ENGINE.variables[key]=1;';library.add(spec('variable'),'Score');assert.equal(library.remove(spec('variable'),'Score'),false);
});
