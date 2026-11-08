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

test('all imported scripts and their children open expanded, including restored collapsed layouts',()=>{
    const ws=new Blockly.Workspace(),source='whenStart(repeat(2,setVar("A",1)));whenBroadcast("Play",forever(ifBlock(true,broadcast("Next"))));whenClone("Player",wait(1));';
    try{bridge.load(parseProgram(source,catalog),ws);assert.equal(ws.getAllBlocks(false).some(b=>b.isCollapsed()),false);
        for(const b of ws.getAllBlocks(false))b.setCollapsed(true);bridge.expandAll(ws);assert.equal(ws.getAllBlocks(false).some(b=>b.isCollapsed()),false);
        assert.deepEqual(syntax(generateProgram(bridge.read(ws))),syntax(source));
    }finally{ws.dispose();}
});

test('new block metadata imports automatically without executing its handler',async()=>{
    const {readBlockDefinitions,mergeDefinitions}=await import('../JScratch/editor/definitions.mjs');
    const definitions=readBlockDefinitions(`defineJScratchBlock({name:'testPoints',label:'gain points',kind:'command',category:'custom',params:[{name:'amount',default:5}]},()=>{throw new Error('never execute');});defineJScratchBlock({name:'testPointsValue',kind:'reporter',params:[]},()=>0);defineJScratchBlock({name:'testGroup',kind:'container',params:[]},()=>{});`);
    assert.equal(definitions[0].params[0].default,'5');assert.equal(definitions[0].label,'gain points');assert.equal(definitions[1].reporter,true);assert.equal(definitions[2].container,true);
    const merged=mergeDefinitions(catalog,definitions),b=installBlocks(Blockly,merged),ws=new Blockly.Workspace();
    try{const source='whenStart(testGroup(testPoints(8),setVar("Score",testPointsValue())));';b.load(parseProgram(source,merged),ws);assert.deepEqual(syntax(generateProgram(b.read(ws))),syntax(source));}finally{ws.dispose();}
    assert.throws(()=>readBlockDefinitions('defineJScratchBlock(getMetadata(),()=>{});'),/literal/);
});
test('nested project paths, references and recursive folder saves stay inside the program folder',async()=>{
    const {makeProject,validateProgramPath,validateFolderPath,readProgramDirectory}=await import('../JScratch/editor/project.mjs');
    const {saveProgramFile,saveProjectManifest}=await import('../JScratch/editor/storage.mjs');
    function directory(){const entries=new Map();return {kind:'directory',entries:async function*(){yield* entries;},async getDirectoryHandle(name,{create=false}={}){if(!entries.has(name)){if(!create)throw Object.assign(new Error('missing'),{name:'NotFoundError'});entries.set(name,directory());}return entries.get(name);},async getFileHandle(name,{create=false}={}){if(!entries.has(name)){if(!create)throw Object.assign(new Error('missing'),{name:'NotFoundError'});let text='';entries.set(name,{kind:'file',getFile:async()=>({text:async()=>text}),createWritable:async()=>({write:async v=>{text=v;},close:async()=>{}})});}return entries.get(name);}};}
    const dir=directory();await saveProgramFile(dir,'scenes/world/player.js','whenStart();',null);await saveProgramFile(dir,'sample.js','// Reference',null);
    const listing=await readProgramDirectory(dir);assert.deepEqual(listing.folders,['scenes','scenes/world']);assert.ok(listing.files.some(f=>f.name==='scenes/world/player.js'));
    const project=makeProject(listing.files.map(f=>f.name),listing.folders);assert.deepEqual(project.files,['scenes/world/player.js']);assert.deepEqual(project.references,['sample.js']);await saveProjectManifest(dir,project);assert.deepEqual(JSON.parse(await(await(await dir.getFileHandle('project.json')).getFile()).text()),project);
    for(const path of ['../escape.js','a/../../x.js','/absolute.js','bad//x.js'])assert.throws(()=>validateProgramPath(path));assert.throws(()=>validateFolderPath('../bad'));
});

test('visual comment text stays a comment and cannot turn into executable program code',()=>{
    const ws=new Blockly.Workspace();
    try{const source='whenStart(wait(1));';bridge.load(parseProgram(source,catalog),ws);ws.getTopBlocks(false)[0].setCommentText('A plain comment\nsetVar("Unexpected", 99);');const generated=generateProgram(bridge.read(ws));assert.deepEqual(syntax(generated),syntax(source));assert.ok(generated.includes('// A plain comment'));assert.ok(generated.includes('// setVar("Unexpected", 99);'));}finally{ws.dispose();}
});
