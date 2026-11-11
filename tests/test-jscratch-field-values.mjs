import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fieldKind,defaultFieldValue} from '../JScratch/editor/field-values.mjs';
import {installBlocks} from '../JScratch/editor/blocks.mjs';
import {parseProgram,generateProgram} from '../JScratch/editor/model.mjs';
const require=createRequire(import.meta.url),Blockly=require('../JScratch/editor/vendor/blockly_compressed.js'),catalog=JSON.parse(fs.readFileSync(new URL('../JScratch/editor/catalog.json',import.meta.url)));
const definition=name=>catalog.find(d=>d.name===name);
test('unconfigured text/name/path fields start empty and numbers start at zero',()=>{
    for(const [name,index]of [['broadcast',0],['createSprite',0],['spriteCostume',1],['makeSound',1],['uiText',1],['setSpriteVar',1],['keyPressed',0],['join',0]])assert.equal(defaultFieldValue(definition(name),index),'""',name);
    for(const [name,index]of [['moveTo',1],['moveTo',2],['wait',0],['add',0],['setVar',1]])assert.equal(defaultFieldValue(definition(name),index),'0',name);
    assert.equal(defaultFieldValue(definition('spriteCostume'),2),'1');assert.equal(defaultFieldValue(definition('spriteSolid'),1),'true');assert.equal(defaultFieldValue(definition('makeList'),1),'[]');assert.equal(fieldKind(definition('getJson'),1),'text');
});
test('clearing fields emits blank strings or zero and remains valid JavaScript',()=>{
    const bridge=installBlocks(Blockly,catalog),ws=new Blockly.Workspace();try{bridge.load(parseProgram('whenStart(createSprite("Player"),moveTo("Player",10,20),uiSetText("HUD","Hello"),spriteSolid("Player",true));',catalog),ws);
        const sprite=ws.getAllBlocks(false).find(b=>b.type==='js_createSprite').getInputTargetBlock('ARG0').getField('VALUE'),move=ws.getAllBlocks(false).find(b=>b.type==='js_moveTo').getInputTargetBlock('ARG1').getField('VALUE'),text=ws.getAllBlocks(false).find(b=>b.type==='js_uiSetText').getInputTargetBlock('ARG1').getField('VALUE'),bool=ws.getAllBlocks(false).find(b=>b.type==='js_spriteSolid').getInputTargetBlock('ARG1').getField('VALUE');
        sprite.setValue('');move.setValue('   ');text.setValue('');bool.setValue('');assert.equal(sprite.getValue(),'""');assert.equal(sprite.getText(),'');assert.equal(move.getValue(),'0');assert.equal(move.getText(),'0');assert.equal(text.getText(),'');assert.equal(bool.getValue(),'false');assert.match(generateProgram(bridge.read(ws)),/createSprite\(""\)/);assert.match(generateProgram(bridge.read(ws)),/moveTo\("Player", 0, 20\)/);
    }finally{ws.dispose();}
});
test('displaying an empty string hides quotes without changing imported source',()=>{
    const bridge=installBlocks(Blockly,catalog),ws=new Blockly.Workspace();try{const source='whenStart(uiSetText("HUD",""));';bridge.load(parseProgram(source,catalog),ws);const field=ws.getAllBlocks(false).find(b=>b.type==='js_uiSetText').getInputTargetBlock('ARG1').getField('VALUE');assert.equal(field.getText(),'');assert.equal(field.getValue(),'""');assert.match(generateProgram(bridge.read(ws)),/uiSetText\("HUD", ""\)/);}finally{ws.dispose();}
});
