import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {installBlocks} from '../JScratch/editor/blocks.mjs';
import {parseProgram} from '../JScratch/editor/model.mjs';
import {capturePositions,statePositions,restorePositions,restoreView} from '../JScratch/editor/layout.mjs';
import {saveEditorLayouts,readEditorLayouts} from '../JScratch/editor/storage.mjs';
const require=createRequire(import.meta.url),Blockly=require('../JScratch/editor/vendor/blockly_compressed.js'),catalog=JSON.parse(fs.readFileSync(new URL('../JScratch/editor/catalog.json',import.meta.url)));
const point=block=>{const {x,y}=block.getRelativeToSurfaceXY();return {x,y};};
test('source rebuilds preserve exact script positions while new scripts get unused space',()=>{
    const bridge=installBlocks(Blockly,catalog),ws=new Blockly.Workspace();try{
        bridge.load(parseProgram('whenBroadcast("Same",wait(1));whenBroadcast("Same",wait(2));whenStart(setVar("Score",0));',catalog),ws);
        ws.getTopBlocks(false).forEach((b,i)=>{const p=point(b);b.moveBy(-250.5+i*730.25-p.x,180.75+i*360.5-p.y);});
        const positions=capturePositions(ws,bridge);
        bridge.load(parseProgram('whenBroadcast("Same",wait(3));whenBroadcast("Same",wait(1));whenBroadcast("Same",wait(2));whenStart(setVar("Score",0));',catalog),ws);restorePositions(ws,bridge,positions);
        const blocks=ws.getTopBlocks(false);for(let i=0;i<3;i++)assert.deepEqual(point(blocks[i+1]),{x:positions[i].x,y:positions[i].y});assert.ok(!positions.some(p=>p.x===point(blocks[0]).x));
    }finally{ws.dispose();}
});
test('renaming and editing hats preserves anchors, and old workspace snapshots migrate positions',()=>{
    const bridge=installBlocks(Blockly,catalog),ws=new Blockly.Workspace();try{
        bridge.load(parseProgram('whenStart(wait(1));whenBroadcast("Before",wait(1));',catalog),ws);ws.getTopBlocks(false).forEach((b,i)=>{const p=point(b);b.moveBy(900*i-p.x,-250*i-p.y);});const positions=capturePositions(ws,bridge),legacy=statePositions(Blockly.serialization.workspaces.save(ws));
        bridge.load(parseProgram('whenStart(wait(2));whenBroadcast("After",wait(2));',catalog),ws);restorePositions(ws,bridge,positions);assert.deepEqual(ws.getTopBlocks(false).map(point),positions.map(({x,y})=>({x,y})));
        assert.deepEqual(legacy.map(({x,y})=>({x,y})),positions.map(({x,y})=>({x,y})));assert.deepEqual(statePositions({blocks:{blocks:'bad'}}),[]);
    }finally{ws.dispose();}
});
test('saved canvas views restore scale and scroll without focusing or fitting',()=>{
    const calls=[],workspace={setScale:s=>calls.push(['scale',s]),scroll:(x,y)=>calls.push(['scroll',x,y])};assert.equal(restoreView(workspace,{scale:1.12,scrollX:-351.5,scrollY:-194.25}),true);assert.deepEqual(calls,[['scale',1.12],['scroll',-351.5,-194.25]]);assert.equal(restoreView(workspace,{scale:NaN,scrollX:0,scrollY:0}),false);assert.equal(calls.length,2);
});
test('folder layout backups use separate metadata and retain per-file coordinates',async()=>{
    const files=new Map([['begin.js','whenStart();']]),directory={async getFileHandle(name,{create=false}={}){if(!files.has(name)&&!create)throw Object.assign(new Error('Missing'),{name:'NotFoundError'});return {getFile:async()=>({text:async()=>files.get(name)}),createWritable:async()=>{let text;return {write:async value=>{text=value;},close:async()=>{files.set(name,text);}};}};}};
    assert.equal(await readEditorLayouts(directory),null);const data={version:1,files:{'begin.js':{positions:[{type:'js_whenStart',x:-40.5,y:300}],view:{scale:.8,scrollX:0,scrollY:10}}}};await saveEditorLayouts(directory,data);assert.deepEqual(await readEditorLayouts(directory),data);assert.equal(files.get('begin.js'),'whenStart();');
});
