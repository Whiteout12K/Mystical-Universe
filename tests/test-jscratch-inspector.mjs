import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectorSnapshot,inspectorId,previewValue} from '../JScratch/js/inspector-model.mjs';
import {previewWindows} from '../JScratch/editor/preview.mjs';
function sprite(name,extra={}){return {name,x:10,y:-20,width:160,height:90,scale:1,rotation:0,visible:true,variables:{Score:7},privateVariables:{Secret:42},isClone:false,deleted:false,...extra};}
function engine(){return {runId:4,running:true,paused:false,sprites:{Player:sprite('Player'),HUD:sprite('HUD',{isUI:true,uiType:'bar',uiBaseWidth:200,uiBaseHeight:20,scale:.5,visible:false})},clones:[sprite('Player',{isClone:true,cloneId:12,cloneIdName:'Player#12',cloneOf:'Player',variables:{Score:11},privateVariables:{Secret:'clone'}})]};}
test('live snapshots include hidden sprites, UI, originals and clones with distinct local values',()=>{
    const e=engine(),clone=e.clones[0],id=inspectorId(clone,e.runId),snapshot=inspectorSnapshot(e,id);
    assert.equal(snapshot.sprites.length,3);assert.equal(snapshot.sprites.find(s=>s.name==='HUD').visible,false);
    assert.equal(snapshot.selected.name,'Player#12');assert.equal(snapshot.selected.source,'Player');assert.equal(snapshot.selected.variables.Score,11);assert.equal(snapshot.selected.privateVariables.Secret,'clone');assert.equal(snapshot.selected.properties.x,10);assert.equal(snapshot.selected.properties.y,-20);
    const ui=inspectorSnapshot(e,inspectorId(e.sprites.HUD,e.runId)).selected;assert.equal(ui.properties.width,100);assert.equal(ui.properties.height,10);
    snapshot.selected.variables.Score=100;assert.equal(clone.variables.Score,11);
});
test('selected values update live and deleted/restarted objects do not leave stale selections',()=>{
    const e=engine(),id=inspectorId(e.sprites.Player,e.runId);e.sprites.Player.x=300;e.sprites.Player.privateVariables.Secret=99;
    assert.equal(inspectorSnapshot(e,id).selected.properties.x,300);assert.equal(inspectorSnapshot(e,id).selected.privateVariables.Secret,99);
    e.sprites.Player.deleted=true;assert.equal(inspectorSnapshot(e,id).selected,null);assert.equal(inspectorSnapshot(e,id).sprites.length,2);
    e.sprites.Player.deleted=false;e.runId++;assert.equal(inspectorSnapshot(e,id).selected,null);e.paused=true;assert.equal(inspectorSnapshot(e).state,'Paused');e.running=false;assert.equal(inspectorSnapshot(e).state,'Stopped');
});
test('inspecting variables does not call getters or execute functions and tolerates cycles and large values',()=>{
    const e=engine();let reads=0;e.sprites.Player.privateVariables={};Object.defineProperty(e.sprites.Player.privateVariables,'Unsafe',{enumerable:true,get(){reads++;throw new Error('must not run');}});
    const cycle={value:1};cycle.self=cycle;e.sprites.Player.variables={cycle,fn:()=>{reads++;},large:Array.from({length:500},(_,i)=>i),integer:123n,missing:undefined};
    const snap=inspectorSnapshot(e,inspectorId(e.sprites.Player,e.runId));assert.equal(reads,0);assert.equal(snap.selected.privateVariables.Unsafe,'[Getter]');assert.equal(snap.selected.variables.cycle.self,'[Circular]');assert.equal(snap.selected.variables.fn,'[Function]');assert.equal(snap.selected.variables.large.at(-1),'[300 more items]');assert.equal(snap.selected.variables.integer,'123n');assert.doesNotThrow(()=>structuredClone(snap));
    assert.deepEqual(previewValue(new Map([['Points',10]])),{type:'Map',entries:[['Points',10]]});
});
test('game and inspector request separate adjacent popup bounds on the available screen',()=>{
    const features=previewWindows({availWidth:1440,availHeight:900,availLeft:0,availTop:25});
    assert.match(features.game,/popup=yes/);assert.match(features.inspector,/popup=yes/);assert.match(features.game,/left=0/);assert.match(features.inspector,/left=965/);assert.match(features.game,/top=25/);
});
