import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {parse} from '../JScratch/editor/vendor/acorn.mjs';
import {parseProgram,generateProgram} from '../JScratch/editor/model.mjs';
import {installBlocks} from '../JScratch/editor/blocks.mjs';
import {reporterType,booleanInput,migrateWorkspaceTypes} from '../JScratch/editor/types.mjs';
import {blockTitle,blockPrefix,argumentLabel} from '../JScratch/editor/labels.mjs';
import {readBlockDefinitions} from '../JScratch/editor/definitions.mjs';
const require=createRequire(import.meta.url),Blockly=require('../JScratch/editor/vendor/blockly_compressed.js'),catalog=JSON.parse(fs.readFileSync(new URL('../JScratch/editor/catalog.json',import.meta.url)));
function clean(x){if(Array.isArray(x))return x.filter(n=>n?.type!=='EmptyStatement').map(clean);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).filter(([k])=>!['start','end','raw'].includes(k)).map(([k,v])=>[k,clean(v)]));return x;}
const syntax=source=>clean(parse(source,{ecmaVersion:'latest'}));
test('Boolean sockets reject rounded number reporters and accept Boolean comparisons and sensing',()=>{
    installBlocks(Blockly,catalog);const ws=new Blockly.Workspace();try{const condition=ws.newBlock('js_ifBlock').getInput('ARG0').connection,add=ws.newBlock('js_add_value').outputConnection,eq=ws.newBlock('js_equal_value').outputConnection,key=ws.newBlock('js_keyPressed_value').outputConnection;assert.deepEqual(condition.getCheck(),['Boolean']);assert.equal(ws.connectionChecker.doTypeChecks(condition,add),false);assert.equal(ws.connectionChecker.doTypeChecks(condition,eq),true);assert.equal(ws.connectionChecker.doTypeChecks(condition,key),true);assert.equal(ws.connectionChecker.doTypeChecks(ws.newBlock('js_setVar').getInput('ARG1').connection,eq),true);for(const name of ['and','or','not'])for(const input of ws.newBlock('js_'+name+'_value').inputList.filter(i=>i.connection))assert.deepEqual(input.connection.getCheck(),['Boolean']);}finally{ws.dispose();}
});
test('Boolean and generic values round-trip with unchanged truthiness and parameter scope',()=>{
    const bridge=installBlocks(Blockly,catalog),ws=new Blockly.Workspace(),source='whenStart(ifBlock(getVar("Ready"),setVar("Answer",add(1,div(4,2)))),waitUntil(1),spriteSolid("A",false));defineFunction("Guard",["flag"],ifBlock(functionValue("flag"),returnFunction(true)));';try{bridge.load(parseProgram(source,catalog),ws);assert.deepEqual(syntax(generateProgram(bridge.read(ws))),syntax(source));assert.ok(ws.getAllBlocks(false).some(b=>b.type==='js_boolean_test'));assert.ok(ws.getAllBlocks(false).some(b=>b.type==='js_boolean_expression'));}finally{ws.dispose();}
});
test('older workspace connections migrate before type checking without losing IDs or positions',()=>{
    const bridge=installBlocks(Blockly,catalog),ws=new Blockly.Workspace(),source='whenStart(ifBlock(getVar("Ready"),setVar("A",true)),ifBlock(equal(1,1),wait(0)));';try{bridge.load(parseProgram(source,catalog),ws);const root=ws.getTopBlocks(false)[0];root.moveBy(-280.5,72.25);const state=Blockly.serialization.workspaces.save(ws);function old(b){if(b.type==='js_boolean_test')return old(b.inputs.VALUE.block);if(b.type==='js_boolean_expression')b.type='js_expression';for(const input of Object.values(b.inputs??{}))for(const key of ['block','shadow'])if(input[key])input[key]=old(input[key]);if(b.next?.block)b.next.block=old(b.next.block);return b;}state.blocks.blocks=state.blocks.blocks.map(old);const original=JSON.stringify(state),migrated=migrateWorkspaceTypes(state,catalog);assert.equal(JSON.stringify(state),original);Blockly.serialization.workspaces.load(migrated,ws);assert.equal(ws.getTopBlocks(false)[0].id,root.id);assert.equal(ws.getTopBlocks(false)[0].getRelativeToSurfaceXY().x,state.blocks.blocks[0].x);assert.deepEqual(syntax(generateProgram(bridge.read(ws))),syntax(source));}finally{ws.dispose();}
});
test('operators use readable infix labels while their public JavaScript names remain unchanged',()=>{
    for(const [name,symbol]of Object.entries({add:'+',sub:'-',mult:'*',div:'/',equal:'=',gThan:'>',lThan:'<',gEqThan:'≥',lEqThan:'≤',and:'and',or:'or'})){const d=catalog.find(d=>d.name===name);assert.equal(blockTitle(d),'val '+symbol+' val2');assert.equal(blockPrefix(d),'');assert.equal(argumentLabel(d,0),'');assert.equal(argumentLabel(d,1),symbol);assert.equal(d.name,name);}
});
test('declarative extensions share validated Boolean input/output metadata',()=>{
    const [d]=readBlockDefinitions('defineJScratchBlock({name:"isReady",kind:"reporter",output:"boolean",params:[{name:"flag",type:"boolean",default:false}]},()=>true);');assert.equal(reporterType(d),'Boolean');assert.equal(booleanInput(d,0),true);assert.throws(()=>JScratchBlockAPI.normalize({name:'badType',kind:'reporter',output:'number'}),/Output type/);assert.throws(()=>JScratchBlockAPI.normalize({name:'badInput',kind:'command',params:[{name:'flag',type:'wat'}]}),/Parameter type/);
});
test('palette exposes Boolean shadows and searchable operators/Boolean constants',()=>{
    const bridge=installBlocks(Blockly,catalog);const all=bridge.toolbox().contents.flatMap(c=>c.contents),ifBlock=all.find(item=>item.type==='js_ifBlock');assert.equal(ifBlock.inputs.ARG0.shadow.type,'js_boolean_expression');assert.equal(ifBlock.inputs.ARG0.shadow.fields.VALUE,'false');assert.ok(bridge.toolbox('true').contents[0].contents.some(b=>b.type==='js_boolean_expression'));assert.ok(bridge.toolbox('>=').contents[0].contents.some(b=>b.type==='js_gEqThan_value'));
});
test('new test reporters produce Boolean values in value slots while legacy conditions preserve source',()=>{
    const bridge=installBlocks(Blockly,catalog),ws=new Blockly.Workspace();try{bridge.load(parseProgram('whenStart(setVar("Flag",1));',catalog),ws);const command=ws.getAllBlocks(false).find(b=>b.type==='js_setVar');command.getInputTargetBlock('ARG1').dispose();const test=ws.newBlock('js_boolean_test'),number=ws.newBlock('js_expression');number.setFieldValue('5','VALUE');test.getInput('VALUE').connection.connect(number.outputConnection);command.getInput('ARG1').connection.connect(test.outputConnection);assert.deepEqual(syntax(generateProgram(bridge.read(ws))),syntax('whenStart(setVar("Flag",not(not(5))));'));}finally{ws.dispose();}
});
