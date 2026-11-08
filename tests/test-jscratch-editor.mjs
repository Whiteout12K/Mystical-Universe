import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {parse} from '../JScratch/editor/vendor/acorn.mjs';
import {parseProgram,generateProgram} from '../JScratch/editor/model.mjs';
import {installBlocks} from '../JScratch/editor/blocks.mjs';
const require=createRequire(import.meta.url),Blockly=require('../JScratch/editor/vendor/blockly_compressed.js');
const catalog=JSON.parse(fs.readFileSync(new URL('../JScratch/editor/catalog.json',import.meta.url),'utf8'));
const bridge=installBlocks(Blockly,catalog);
function clean(value){
    if(Array.isArray(value))return value.filter(n=>n?.type!=='EmptyStatement').map(clean);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','raw'].includes(key)).map(([key,v])=>[key,clean(v)]));
    return value;
}
function syntax(source){return clean(parse(source,{ecmaVersion:'latest'}));}
for(const name of ['begin','world','sample'])test(`visual import/export preserves ${name}.js syntax, nesting and reporter arguments`,()=>{
    const source=fs.readFileSync(new URL(`../JScratch/program/${name}.js`,import.meta.url),'utf8'),model=parseProgram(source,catalog),ws=new Blockly.Workspace();
    try{bridge.load(model,ws);const generated=generateProgram(bridge.read(ws,model.footer));assert.deepEqual(syntax(generated),syntax(source));
        const snapshot=Blockly.serialization.workspaces.save(ws),copy=new Blockly.Workspace();
        try{Blockly.serialization.workspaces.load(snapshot,copy);assert.deepEqual(syntax(generateProgram(bridge.read(copy,model.footer))),syntax(source));}finally{copy.dispose();}
    }finally{ws.dispose();}
});
test('editor imports unknown JavaScript without evaluating it and preserves comments',()=>{
    const source='// Startup\nwhenStart(setVar("Score", add(1, 2)), ifBlock(true, broadcast("yes"), "else", broadcast("no")));\n// Custom logic\nconst custom = () => { throw new Error("never run"); };\ncustom();\n// End';
    const model=parseProgram(source,catalog),ws=new Blockly.Workspace();
    try{bridge.load(model,ws);const generated=generateProgram(bridge.read(ws,model.footer));assert.deepEqual(syntax(generated),syntax(source));for(const text of ['// Startup','// Custom logic','// End'])assert.ok(generated.includes(text));}finally{ws.dispose();}
});
test('blocks snap into nested bodies and reporters generate executable API syntax',()=>{
    const ws=new Blockly.Workspace();
    try{
        bridge.load(parseProgram('whenStart(repeat(3, setVar("Score", add(1, 2))));',catalog),ws);
        const repeat=ws.getAllBlocks(false).find(b=>b.type==='js_repeat');
        const command=ws.newBlock('js_broadcast'),value=ws.newBlock('js_expression');value.setFieldValue('"Done"','VALUE');command.getInput('ARG0').connection.connect(value.outputConnection);
        repeat.getInputTargetBlock('BODY').nextConnection.connect(command.previousConnection);
        assert.deepEqual(syntax(generateProgram(bridge.read(ws))),syntax('whenStart(repeat(3, setVar("Score", add(1,2)), broadcast("Done")));'));
        value.setFieldValue('"unterminated','VALUE');assert.throws(()=>generateProgram(bridge.read(ws)));
    }finally{ws.dispose();}
});
test('incomplete or loose reporter blocks cannot silently write broken programs',()=>{
    const ws=new Blockly.Workspace();
    try{const b=ws.newBlock('js_setVar');assert.throws(()=>bridge.read(ws),/fill/);b.dispose();ws.newBlock('js_expression');assert.throws(()=>bridge.read(ws),/loose value/);}finally{ws.dispose();}
});
test('editor palette covers API math and sensing reporters and all sample function calls',()=>{
    for(const name of ['add','mult','getVar','getSpriteVar','and','or','touchingMouse','equal','deltaTime'])assert.equal(catalog.find(d=>d.name===name)?.reporter,true,name);
    for(const name of ['whenStart','coordinatePlane','uiProgressBar','spriteSolid'])assert.ok(catalog.some(d=>d.name===name));
});

test('folder saves compare the disk contents and never overwrite outside edits',async()=>{
    const {saveProgramFile}=await import('../JScratch/editor/storage.mjs');
    const files=new Map([['begin.js','whenStart();\n']]);let aborted=false;
    const directory={async getFileHandle(name,options={}){
        if(!files.has(name)&&!options.create)throw Object.assign(new Error('Missing'),{name:'NotFoundError'});
        return {async getFile(){return {text:async()=>files.get(name)};},async createWritable(){let pending;return {async write(value){pending=value;},async close(){files.set(name,pending);},async abort(){aborted=true;}};}};
    }};
    await saveProgramFile(directory,'begin.js','whenStart(wait(1));\n','whenStart();\n');
    assert.equal(files.get('begin.js'),'whenStart(wait(1));\n');
    await assert.rejects(saveProgramFile(directory,'begin.js','bad overwrite','older text'),/changed on disk/);
    assert.equal(files.get('begin.js'),'whenStart(wait(1));\n');
    await saveProgramFile(directory,'new.js','whenStart();',null);assert.equal(files.get('new.js'),'whenStart();');assert.equal(aborted,false);
});

test('raw object/function statements and comma expressions preserve their JavaScript meaning',()=>{
    const source='({value: 1});\n(function () { return 2; });\nsetVar("Score", (1, 2));\nwhenStart(customCommand({x: 1}, (2, 3)));';
    const ws=new Blockly.Workspace(),model=parseProgram(source,catalog);
    try{bridge.load(model,ws);assert.deepEqual(syntax(generateProgram(bridge.read(ws,model.footer))),syntax(source));}finally{ws.dispose();}
});
