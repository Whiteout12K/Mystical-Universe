import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function engine(overrides={}) {
    const stats={reads:0,resizes:0,draws:0,measures:0},events=new Map();
    function makeCanvas(){
        const context=new Proxy({
            getImageData(_x,_y,w,h){stats.reads++;if(context._source?.testPixels)return {data:context._source.testPixels.slice()};const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){data[i]=255;data[i+3]=255;}return {data};},
            drawImage(source,...args){context._source=source;context.lastDraw=args;stats.draws++;},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},measureText:()=>{stats.measures++;return {width:20};},createLinearGradient:()=>({addColorStop(){}})
        },{get:(target,key)=>key in target?target[key]:()=>{}});
        return {style:{},_width:640,_height:360,get width(){return this._width;},set width(v){stats.resizes++;this._width=v;},get height(){return this._height;},set height(v){stats.resizes++;this._height=v;},getContext:()=>context,addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:640,height:360})};
    }
    const canvas=makeCanvas();
    const sandbox={console:{error(){},warn(){},log(){}},performance:{now:()=>0},setTimeout,clearTimeout,AbortController,
        URLSearchParams,Uint8ClampedArray,CustomEvent:class {constructor(type,{detail}){this.type=type;this.detail=detail;}},
        requestAnimationFrame:()=>1,Image:class {constructor(){this.complete=true;this.naturalWidth=10;this.naturalHeight=10;}set src(v){this.path=v;queueMicrotask(()=>this.onload?.());}addEventListener(){}},
        document:{getElementById:()=>canvas,createElement:makeCanvas,addEventListener(){}},
        addEventListener(type,fn){events.set(type,fn);},dispatchEvent(){},innerWidth:640,innerHeight:360,devicePixelRatio:1,...overrides};
    canvas.parentElement={getBoundingClientRect:()=>sandbox.canvasRect??{left:0,top:0,width:sandbox.innerWidth,height:sandbox.innerHeight}};
    canvas.getBoundingClientRect=()=>{const p=canvas.parentElement.getBoundingClientRect(),w=parseFloat(canvas.style.width)||p.width,h=parseFloat(canvas.style.height)||p.height;return {left:p.left+(p.width-w)/2,top:p.top+(p.height-h)/2,width:w,height:h};};
    sandbox.window=sandbox;
    const context=vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(new URL('../JScratch/js/vendor/gifuct.js',import.meta.url),'utf8'),context);
    for(const file of ['block-api','back-process','media','camera','ui','data','json','canvas','sensing','lists','solid','control','sprite','sound','motion','operator','clone','extensions'])
        vm.runInContext(fs.readFileSync(new URL(`../JScratch/js/${file}.js`,import.meta.url),'utf8'),context,{filename:file+'.js'});
    const run=source=>vm.runInContext(source,context);
    // Historical fixtures explicitly use 640x360; production startup defaults to 480x360.
    run(`setCanvasDimensions(${overrides.logicalWidth??640},${overrides.logicalHeight??360})`);
    let timestamp=0;
    const flush=()=>new Promise(resolve=>setImmediate(resolve));
    async function tick(ms=16){timestamp+=ms;run(`gameLoop(${timestamp})`);await flush();}
    async function settle(promise,maxFrames=500){
        let done=false,result,error;Promise.resolve(promise).then(v=>{done=true;result=v;},e=>{done=true;error=e;});
        await flush();for(let i=0;i<maxFrames&&!done;i++)await tick();
        assert.ok(done,'script must finish within test frame budget');if(error)throw error;return result;
    }
    return {run,tick,settle,flush,stats,events,sandbox};
}

test('nested repeats, live reporters, branches, and endScript execute in order',async()=>{
    const e=engine();
    e.run(`setVar('count',0);repeat(2,repeat(3,changeVarBy('count',1)));ifBlock(equal(getVar('count'),6),setVar('branch',1),'else',setVar('branch',2));repeatUntil(gEqThan(getVar('count'),9),changeVarBy('count',1));repeat(5,ifBlock(true,endScript()),setVar('bad',1));setVar('bad',2);`);
    await e.settle(e.run('startRuntime()'));
    assert.equal(e.run('ENGINE.variables.count'),9);assert.equal(e.run('ENGINE.variables.branch'),1);assert.equal(e.run('ENGINE.variables.bad'),undefined);
    assert.equal(e.run('ENGINE.errors.length'),0);
});

test('same-name listeners and repeated broadcast invocations run concurrently',async()=>{
    const e=engine();
    e.run(`whenBroadcast('play',changeVarBy('started',1),wait(.1),changeVarBy('finished',1));whenBroadcast('play',changeVarBy('started',1),wait(.1),changeVarBy('finished',1));`);
    const tasks=e.run('broadcastMessage("play").concat(broadcastMessage("play"))');await e.flush();
    assert.equal(e.run('ENGINE.variables.started'),4);assert.equal(e.run('ENGINE.variables.finished'),undefined);
    assert.equal(e.run('ENGINE.activeScripts.size'),4);
    await e.settle(Promise.all(tasks));assert.equal(e.run('ENGINE.variables.finished'),4);assert.equal(e.run('ENGINE.activeScripts.size'),0);
});

test('broadcastAndWait awaits all listeners, ordinary broadcast continues',async()=>{
    const e=engine();e.run(`whenBroadcast('x',wait(.05),setVar('a',1));whenBroadcast('x',wait(.1),setVar('b',1));broadcastAndWait('x');setVar('after',1);`);
    const promise=e.run('startRuntime()');await e.flush();assert.equal(e.run('ENGINE.variables.after'),undefined);
    await e.settle(promise);assert.equal(e.run('ENGINE.variables.a+ENGINE.variables.b+ENGINE.variables.after'),3);
    e.run(`ENGINE.program=[];broadcast('x');setVar('continued',1);`);await e.flush();await e.settle(e.run('executeProgram()'));assert.equal(e.run('ENGINE.variables.continued'),1);
});

test('recursive broadcasts yield and can be stopped without a script cap',async()=>{
    const e=engine();e.run(`ENGINE.budgetLimit=20;whenBroadcast('again',changeVarBy('spawned',1),broadcast('again'));broadcastMessage('again');`);
    await e.flush();assert.ok(e.run('ENGINE.variables.spawned')>0);assert.ok(e.run('ENGINE.waiters.size')>0);
    e.run('stopRuntime()');await e.flush();assert.equal(e.run('ENGINE.activeScripts.size'),0);assert.equal(e.run('ENGINE.waiters.size'),0);
});

test('deep command nesting uses an explicit execution stack',async()=>{
    const e=engine();e.run(`let deep=createBlock('setVar',{name:'deep',value:1});for(let i=0;i<1500;i++)deep=createBlock('if',{condition:true,thenBlocks:[deep],elseBlocks:[]});ENGINE.program=[deep];`);
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.variables.deep'),1);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('break and continue affect only the nearest enclosing loop',async()=>{
    const e=engine();e.run(`setVar('outer',0);setVar('inner',0);repeat(3,changeVarBy('outer',1),repeat(5,changeVarBy('inner',1),ifBlock(true,breakLoop()),setVar('bad',1)));repeat(3,changeVarBy('continued',1),continueLoop(),setVar('bad',2));`);
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.variables.outer'),3);assert.equal(e.run('ENGINE.variables.inner'),3);assert.equal(e.run('ENGINE.variables.continued'),3);assert.equal(e.run('ENGINE.variables.bad'),undefined);
});

test('malformed trees and unknown or cyclic reporters produce useful errors',async()=>{
    const e=engine();assert.match(e.run(`validateBlocks([{type:'repeat',times:1,blocks:[[{}]]}]).join(' ')`),/expected a command/);
    assert.match(e.run(`const cycle={type:'if',condition:true,thenBlocks:[],elseBlocks:[]};cycle.thenBlocks.push(cycle);validateBlocks([cycle]).join(' ')`),/cyclic/);
    e.run(`ENGINE.program=[{type:'setVar',name:'x',value:createReporter('missing')}];`);await e.settle(e.run('startRuntime()'));assert.match(e.run('ENGINE.errors[0].message'),/unknown reporter/);
    assert.throws(()=>e.run(`const r={type:'value'};r.value=r;resolveValue(r)`),/Cyclic reporter/);
});

test('UI commands are deferred, conditional, repeatable, and rendered once',async()=>{
    const e=engine();e.run(`ifBlock(false,uiText('hidden','bad'));uiText('score',0);repeat(3,changeVarBy('n',1),uiSetText('score',getVar('n')));`);
    assert.equal(e.run('Object.keys(ML_UI.elements).length'),0);
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ML_UI.elements.hidden'),undefined);assert.equal(e.run('ML_UI.elements.score.text'),3);
    e.run(`let uiPaints=0;ENGINE.renderUI=()=>uiPaints++;render()`);assert.equal(e.run('uiPaints'),1);
});

test('dynamic variable names and clone-scoped JSON, sound and UI arguments stay live',async()=>{
    const e=engine();e.run(`const dynamic=getVar(getVar('key'));ENGINE.variables.key='a';ENGINE.variables.a=7;`);assert.equal(e.run('resolveValue(dynamic)'),7);e.run(`ENGINE.variables.key='b';ENGINE.variables.b=9`);assert.equal(e.run('resolveValue(dynamic)'),9);
    await e.settle(e.run(`(async()=>{const clone=new Sprite('c',true);clone.variables.path='field';clone.variables.pitch=12;clone.variables.label='hello';const c=createScriptContext(clone);JSON_DATA.test={field:42};ENGINE.variables.jsonResult=resolveValue(jsonValue('test',getSpriteVar('self','path')),c);await executeBlocks([createBlock('makeSound',{name:'s',path:'sound'}),createBlock('setPitch',{name:'s',value:getSpriteVar('self','pitch')}),createBlock('uiText',{id:'label',text:getSpriteVar('self','label')})],c);})()`));
    assert.equal(e.run('ENGINE.variables.jsonResult'),42);assert.equal(e.run('ENGINE.sounds.s.pitch'),12);assert.equal(e.run('ML_UI.elements.label.text'),'hello');
});

test('single stepping completes waits, glides, fades and then parks at next command',async()=>{
    const e=engine();e.run(`ENGINE.sprites.s=new Sprite('s');ENGINE.paused=true;const context=createScriptContext();const stepping=executeBlocks([createBlock('wait',{time:2}),createBlock('glideTo',{name:'s',x:20,y:30,time:2}),createBlock('phaseOut',{time:2}),createBlock('setVar',{name:'done',value:1})],context);`);
    await e.flush();
    e.run('stepRuntime()');await e.tick();assert.equal(e.run('context.lastBlock.type'),'wait');assert.equal(e.run('ENGINE.variables.done'),undefined);
    e.run('stepRuntime()');await e.tick();assert.equal(e.run('ENGINE.sprites.s.x'),20);
    e.run('stepRuntime()');await e.tick();assert.equal(e.run('ENGINE.sprites.s.effects.ghost'),100);assert.equal(e.run('ENGINE.variables.done'),undefined);
    e.run('stepRuntime()');await e.tick();await e.settle(e.run('stepping'));assert.equal(e.run('ENGINE.variables.done'),1);assert.equal(e.run('ENGINE.clock'),0);
});

test('stepping an already pending wait and nested loop does not hang',async()=>{
    const e=engine();e.run(`const context=createScriptContext();const pending=executeBlocks([createBlock('wait',{time:10}),createBlock('repeat',{times:2,blocks:[createBlock('changeVarBy',{name:'x',value:1})]})],context);`);await e.flush();
    e.run('stepRuntime()');await e.tick();assert.equal(e.run('ENGINE.variables.x'),undefined);
    for(let i=0;i<8&&e.run('ENGINE.variables.x!==2');i++){e.run('stepRuntime()');await e.tick();}
    assert.equal(e.run('ENGINE.variables.x'),2);e.run('resumeRuntime()');await e.settle(e.run('pending'));
});

test('paused scripts cannot all consume the same step token',async()=>{
    const e=engine();e.run(`whenBroadcast('x',changeVarBy('count',1));whenBroadcast('x',changeVarBy('count',1));ENGINE.paused=true;broadcastMessage('x')`);await e.flush();
    e.run('stepRuntime()');await e.tick();assert.equal(e.run('ENGINE.variables.count'),1);
    e.run('stepRuntime()');await e.tick();assert.equal(e.run('ENGINE.variables.count'),2);
});

test('phaseOut(0) hides sprites and fades follow elapsed runtime time',async()=>{
    const e=engine();e.run(`ENGINE.sprites.s=new Sprite('s');`);await e.settle(e.run(`executeBlock(createBlock('phaseOut',{time:0}),createScriptContext())`));assert.equal(e.run('ENGINE.sprites.s.effects.ghost'),100);
    const p=e.run(`executeBlock(createBlock('phaseIn',{time:.3}),createScriptContext())`);await e.flush();await e.tick(100);await e.tick(100);await e.tick(100);await e.tick(100);await e.settle(p);assert.equal(e.run('ENGINE.sprites.s.effects.ghost'),0);
});

test('effect pixels are reused across rendering, resizing, ghost changes and unchanged values',async()=>{
    const e=engine();e.run(`const s=new Sprite('s');s.image={naturalWidth:8,naturalHeight:8};s.loaded=true;s.effects.brightness=20;ENGINE.sprites.s=s;applySpriteEffects(s);`);const reads=e.stats.reads,resizes=e.stats.resizes;
    await e.settle(e.run(`executeBlocks([createBlock('spriteEffect',{name:'s',effect:'brightness',value:20}),createBlock('spriteEffect',{name:'s',effect:'ghost',value:50}),createBlock('spriteSetSize',{name:'s',scale:2})],createScriptContext())`));
    e.run('applySpriteEffects(s);applySpriteEffects(s)');assert.equal(e.stats.reads,reads);assert.equal(e.stats.resizes,resizes);
});

test('rotated hit tests ignore hidden and untouchable sprites; image color scans are cached',()=>{
    const e=engine();e.run(`const a=new Sprite('a'),b=new Sprite('b');for(const s of [a,b]){s.loaded=true;s.image={naturalWidth:4,naturalHeight:4};s.width=100;s.height=10;}a.rotation=90;b.x=60;ENGINE.sprites.a=a;ENGINE.sprites.b=b;`);
    assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),false);e.run('b.x=0');assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),true);
    e.run(`a.visible=false`);assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),false);e.run('a.visible=true;a.touchable=false');assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),false);
    e.run('a.touchable=true');assert.equal(e.run(`resolveValue(touchingColor('a','#ff0000'))`),true);const reads=e.stats.reads;e.run(`resolveValue(touchingColor('a','#ff0000'))`);assert.equal(e.stats.reads,reads);
});

test('JSON requests abort on stop and stale completions cannot modify a new run',async()=>{
    let complete,signal;const e=engine({fetch:async(_url,options)=>{signal=options.signal;return {ok:true,json:()=>new Promise(r=>complete=r)};}});
    const p=e.run(`loadJsonFile('old','/data',createScriptContext())`);await e.flush();e.run('stopRuntime();ENGINE.running=true');assert.equal(signal.aborted,true);complete({field:1});await e.settle(p);assert.equal(e.run(`Object.hasOwn(JSON_DATA,'old')`),false);
});

test('player-data load snapshots cannot overwrite restarted state',async()=>{
    let complete;const e=engine({fetch:async()=>({ok:true,json:()=>new Promise(r=>complete=r)})});
    const p=e.run('_loadPlayerData(createScriptContext())');await e.flush();e.run(`stopRuntime();ENGINE.running=true;PLAYER.username='new';`);complete({authenticated:true,user:{username:'old',data:{score:1}}});await e.settle(p);assert.equal(e.run('PLAYER.username'),'new');
});

test('stopping sound during buffer loading prevents delayed playback',async()=>{
    let complete,starts=0;const audio={state:'running',createBufferSource(){starts++;return {};}};
    const e=engine();e.sandbox.audioStub=audio;e.sandbox.loadBuffer=()=>new Promise(r=>complete=r);
    e.run(`ENGINE.audioContext=audioStub;loadSoundBuffer=loadBuffer;ENGINE.sounds.s={name:'s',path:'s',instances:[]};const soundPending=playSoundInternal(ENGINE.sounds.s);`);await e.flush();
    await e.settle(e.run(`executeBlock(createBlock('stopSound',{name:'s'}),createScriptContext())`));complete({});await e.settle(e.run('soundPending'));assert.equal(starts,0);
});

test('named cancellation interrupts nested waits and leaves other scripts running',async()=>{
    const e=engine();e.run(`whenBroadcast('scene',repeat(10,wait(10),changeVarBy('bad',1)));whenBroadcast('other',wait(.1),setVar('ok',1));broadcastMessage('scene');broadcastMessage('other');`);await e.flush();e.run(`cancelScripts('scene')`);await e.flush();await e.tick(100);await e.tick(100);assert.equal(e.run('ENGINE.variables.bad'),undefined);assert.equal(e.run('ENGINE.variables.ok'),1);
});

test('clone IDs scale without reuse; deleting a clone ends all its waiting scripts',async()=>{
    const e=engine();e.run(`whenClone('source',wait(10),setVar('bad',1));const source=new Sprite('source');ENGINE.sprites.source=source;for(let i=0;i<11000;i++)createClone(source);`);await e.flush();assert.equal(e.run('ENGINE.clones.length'),11000);assert.equal(e.run('ENGINE.clones.at(-1).cloneId'),11000);
    await e.settle(e.run(`executeBlock(createBlock('deleteClonesOf',{name:'all'}),createScriptContext())`));await e.flush();assert.equal(e.run('ENGINE.activeScripts.size'),0);assert.equal(e.run('ENGINE.variables.bad'),undefined);
});

test('ready concurrent scripts share the per-frame execution budget fairly',async()=>{
    const e=engine();e.run(`ENGINE.budgetLimit=5;whenBroadcast('many',changeVarBy('count',1));let many=[];for(let i=0;i<30;i++)many.push(...broadcastMessage('many'));`);await e.flush();assert.ok(e.run('ENGINE.variables.count')<=5);
    await e.tick();assert.ok(e.run('ENGINE.variables.count')<=10);
    await e.settle(Promise.all(e.run('many')));assert.equal(e.run('ENGINE.variables.count'),30);
});

test('waitUntil stays responsive while stepping and completes when its reporter changes',async()=>{
    const e=engine();e.run(`ENGINE.paused=true;const conditional=executeBlocks([createBlock('waitUntil',{condition:getVar('ready')}),createBlock('setVar',{name:'afterWait',value:1})],createScriptContext());`);await e.flush();
    e.run('stepRuntime()');await e.tick();assert.equal(e.run('ENGINE.variables.afterWait'),undefined);
    e.run(`ENGINE.variables.ready=true;stepRuntime()`);await e.tick();assert.equal(e.run('ENGINE.variables.afterWait'),undefined);
    e.run('stepRuntime()');await e.tick();await e.settle(e.run('conditional'));assert.equal(e.run('ENGINE.variables.afterWait'),1);
});

test('pause freezes game time and resume preserves wait duration',async()=>{
    const e=engine();e.run(`const timing=executeBlocks([createBlock('wait',{time:.1}),createBlock('setVar',{name:'finished',value:1})],createScriptContext());`);await e.flush();await e.tick(16);e.run('pauseRuntime()');const clock=e.run('ENGINE.clock');await e.tick(100);assert.equal(e.run('ENGINE.clock'),clock);assert.equal(e.run('ENGINE.variables.finished'),undefined);e.run('resumeRuntime()');await e.settle(e.run('timing'));assert.equal(e.run('ENGINE.variables.finished'),1);
});

test('JSON loading has a configurable timeout covering the response body',async()=>{
    const e=engine({fetch:async(_url,{signal})=>({ok:true,json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))})});
    e.run('ENGINE.requestTimeout=5');assert.equal(await e.run(`loadJsonFile('timeout','/slow',createScriptContext())`),false);assert.equal(e.run('ENGINE.requests.size'),0);
});

test('reserved JavaScript property names are usable as broadcast and variable names',async()=>{
    const e=engine();e.run(`whenBroadcast('__proto__',setVar('constructor',7));whenBroadcast('constructor',setVar('__proto__',9));`);await e.settle(e.run(`Promise.all([broadcastAndWaitMessage('__proto__'),broadcastAndWaitMessage('constructor')])`));assert.equal(e.run(`ENGINE.variables.constructor`),7);assert.equal(e.run(`ENGINE.variables.__proto__`),9);
});

test('withoutScreenRefresh accelerates computation while sharing the frame budget',async()=>{
    const e=engine();e.run(`ENGINE.budgetLimit=50;withoutScreenRefresh(repeat(1000,changeVarBy('fast',1)));`);
    await e.settle(e.run('startRuntime()'),100);assert.equal(e.run('ENGINE.variables.fast'),1000);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('concurrent player increments are saved in order without serializing other scripts',async()=>{
    const saved=[];const e=engine({fetch:async url=>{const value=Number(new URL('http://example.test'+url).searchParams.get('coins'));saved.push(value);return {ok:true,json:async()=>({success:true})};}});
    e.run(`PLAYER={loaded:true,loggedIn:true,username:'test',password:'test',data:{coins:0}};`);
    await e.settle(e.run(`Promise.all([executeBlock(createBlock('changeDataBy',{data:'coins',amount:1}),createScriptContext()),executeBlock(createBlock('changeDataBy',{data:'coins',amount:1}),createScriptContext())])`));assert.deepEqual(saved,[1,2]);assert.equal(e.run('PLAYER.data.coins'),2);
});

test('validation permits ordinary data objects with block-like field names',async()=>{
    const e=engine();e.run(`setVar('object',{blocks:42,thenBlocks:'data',elseBlocks:99});`);await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.variables.object.blocks'),42);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('a debugger step across loop-frame boundaries still runs only one command',async()=>{
    const e=engine();e.run(`ENGINE.paused=true;const loopSteps=executeBlocks([createBlock('repeat',{times:2,blocks:[createBlock('changeVarBy',{name:'steps',value:1})]}),createBlock('changeVarBy',{name:'steps',value:1}),createBlock('changeVarBy',{name:'steps',value:1})],createScriptContext());`);await e.flush();
    let before=0;
    for(let i=0;i<10&&before<4;i++){
        e.run('stepRuntime()');await e.tick();const after=e.run('ENGINE.variables.steps||0');assert.ok(after-before<=1,'one step must not execute two commands');before=after;
    }
    assert.equal(before,4);await e.settle(e.run('loopSteps'));
});

test('World uses c1 costume and supports normalized WASD/arrow movement off stage',async()=>{
    const e=engine();e.run(fs.readFileSync(new URL('../JScratch/program/world.js',import.meta.url),'utf8'));
    e.run('broadcastMessage("World")');await e.flush();for(let i=0;i<25;i++)await e.tick();
    assert.equal(e.run('ENGINE.sprites.Player.costume'),'/images/character_art/pixel_art/c1_costume/costume1_idle1.gif');assert.equal(e.run('Object.keys(ENGINE.sprites).length'),1);
    e.run(`SENSING.keys={d:true}`);for(let i=0;i<10;i++)await e.tick();const straight=e.run('ENGINE.sprites.Player.x');assert.ok(straight>0);
    e.run(`ENGINE.sprites.Player.x=0;ENGINE.sprites.Player.y=0;SENSING.keys={w:true,d:true}`);for(let i=0;i<10;i++)await e.tick();const diagonal=e.run('Math.hypot(ENGINE.sprites.Player.x,ENGINE.sprites.Player.y)');assert.ok(Math.abs(straight-diagonal)<.001);
    e.run(`SENSING.keys={a:true,d:true,w:true,s:true}`);const x=e.run('ENGINE.sprites.Player.x'),y=e.run('ENGINE.sprites.Player.y');for(let i=0;i<5;i++)await e.tick();assert.equal(e.run('ENGINE.sprites.Player.x'),x);assert.equal(e.run('ENGINE.sprites.Player.y'),y);
    e.run(`SENSING.keys={arrowleft:true,arrowdown:true}`);for(let i=0;i<10;i++)await e.tick();assert.ok(e.run('ENGINE.sprites.Player.x')<x);assert.ok(e.run('ENGINE.sprites.Player.y')<y);
    e.run(`SENSING.keys={arrowright:true}`);for(let i=0;i<150;i++)await e.tick();assert.ok(e.run('ENGINE.sprites.Player.x-ENGINE.sprites.Player.width/2>ENGINE.width/2'));
    e.run(`SENSING.keys={arrowup:true}`);for(let i=0;i<150;i++)await e.tick();assert.ok(e.run('ENGINE.sprites.Player.y-ENGINE.sprites.Player.height/2>ENGINE.height/2'));
    const offstageX=e.run('ENGINE.sprites.Player.x'),offstageY=e.run('ENGINE.sprites.Player.y');e.run('resizeGame()');assert.equal(e.run('ENGINE.sprites.Player.x'),offstageX);assert.equal(e.run('ENGINE.sprites.Player.y'),offstageY);
    e.run(`SENSING.keys={arrowleft:true}`);for(let i=0;i<300;i++)await e.tick();assert.ok(e.run('ENGINE.sprites.Player.x+ENGINE.sprites.Player.width/2<-ENGINE.width/2'));
    e.run(`SENSING.keys={arrowdown:true}`);for(let i=0;i<300;i++)await e.tick();assert.ok(e.run('ENGINE.sprites.Player.y+ENGINE.sprites.Player.height/2<-ENGINE.height/2'));
    e.run(`ENGINE.variables.Scene='Elsewhere'`);await e.tick();await e.tick();assert.equal(e.run('ENGINE.activeScripts.size'),0);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('crisp pixels and GIF autoplay stay enabled through legacy settings, resize, and restart',async()=>{
    const e=engine();assert.equal(e.run('ENGINE.pixelCrisp'),true);assert.equal(e.run('ENGINE.gifAutoPlay'),true);
    e.run('MLGame.configure({pixelCrisp:false,gifAutoPlay:false});resizeGame();render()');
    assert.equal(e.run('ctx.imageSmoothingEnabled'),false);assert.equal(e.run('canvas.style.imageRendering'),'pixelated');
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.pixelCrisp'),true);assert.equal(e.run('ENGINE.gifAutoPlay'),true);
    e.run('ENGINE.program=[];setPixelCrisp(false);setGifAutoPlay(false)');await e.settle(e.run('executeProgram()'));
    assert.equal(e.run('ctx.imageSmoothingEnabled'),false);assert.equal(e.run('ENGINE.gifAutoPlay'),true);
    const html=fs.readFileSync(new URL('../JScratch/canvas.html',import.meta.url),'utf8');
    assert.ok(!html.includes('game-settings'));assert.ok(!html.includes('jscratch-media-settings'));
});

test('GIF clock freezes only while paused and resumes automatically',async()=>{
    const e=engine();await e.tick();await e.tick();const start=e.run('ENGINE.animationClock');assert.ok(start>0);
    e.run('pauseRuntime()');await e.tick(100);assert.equal(e.run('ENGINE.animationClock'),start);
    e.run('resumeRuntime();MLGame.configure({gifAutoPlay:false})');await e.tick(100);assert.equal(e.run('ENGINE.animationClock'),start+100);
});

test('mouse collision uses source alpha, including partially opaque pixels, rotation, flips and full ghost',()=>{
    const e=engine();e.run(`const maskedSprite=new Sprite('masked');maskedSprite.width=maskedSprite.height=4;maskedSprite.loaded=true;const pixels=new Uint8ClampedArray(4*4*4);pixels[3]=255;pixels[63]=1;maskedSprite.image={naturalWidth:4,naturalHeight:4,testPixels:pixels};ENGINE.sprites.masked=maskedSprite;function pointAt(x,y){SENSING.mouseX=x+canvas.width/2;SENSING.mouseY=-y+canvas.height/2;return resolveValue(touchingMouse('masked'));}`);
    assert.equal(e.run('pointAt(-1.5,1.5)'),true);assert.equal(e.run('pointAt(.5,.5)'),false);assert.equal(e.run('pointAt(1.5,-1.5)'),true);
    e.run('maskedSprite.effects.ghost=100');assert.equal(e.run('pointAt(-1.5,1.5)'),true);assert.equal(e.run('pointAt(.5,.5)'),false);
    e.run('maskedSprite.rotation=90');assert.equal(e.run('pointAt(1.5,1.5)'),true);assert.equal(e.run('pointAt(-1.5,1.5)'),false);
    e.run('maskedSprite.rotation=0;maskedSprite.flipX=-1');assert.equal(e.run('pointAt(1.5,1.5)'),true);
});

test('sprite collision rejects transparent margins and holes, and ignores ghost effects',()=>{
    const e=engine();e.run(`const a=new Sprite('a'),b=new Sprite('b');for(const s of [a,b]){s.width=s.height=4;s.loaded=true;}const pa=new Uint8ClampedArray(64),pb=new Uint8ClampedArray(64);pa[3]=255;pb[15]=1;a.image={naturalWidth:4,naturalHeight:4,testPixels:pa};b.image={naturalWidth:4,naturalHeight:4,testPixels:pb};ENGINE.sprites.a=a;ENGINE.sprites.b=b;`);
    assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),false);
    e.run('b.x=-3');assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),true);
    e.run('a.effects.ghost=b.effects.ghost=100');assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),true);
    const reads=e.stats.reads;e.run(`resolveValue(touchingSprite('a','b'))`);assert.equal(e.stats.reads,reads);
    e.run('b.visible=false');assert.equal(e.run(`resolveValue(touchingSprite('a','b'))`),false);
});

test('GIF frame timing, looping and restart use the decoded costume timeline',()=>{
    const e=engine(),bytes=fs.readFileSync(new URL('../images/character_art/pixel_art/c1_costume/costume1_idle1.gif',import.meta.url));
    e.sandbox.gifBytes=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    e.run(`const animation=createGifAnimation(JScratchGIF.parseGIF(gifBytes));animation.frame(0)`);assert.equal(e.run('animation.index'),0);
    e.run('animation.frame(499)');assert.equal(e.run('animation.index'),0);e.run('animation.frame(500)');assert.equal(e.run('animation.index'),1);e.run('animation.frame(3000)');assert.equal(e.run('animation.index'),0);
    e.run('animation.frame(3500)');assert.equal(e.run('animation.index'),1);e.run('ENGINE.animationEpoch++;animation.frame(3500)');assert.equal(e.run('animation.index'),0);
});

test('animated alpha masks and effects refresh only when the decoded frame changes',()=>{
    const e=engine();e.run(`const actor=new Sprite('animated');actor.width=actor.height=4;actor.loaded=true;actor.image={naturalWidth:4,naturalHeight:4};ENGINE.sprites.animated=actor;const leftPixels=new Uint8ClampedArray(64),rightPixels=new Uint8ClampedArray(64);leftPixels[3]=255;rightPixels[15]=255;const leftFrame={naturalWidth:4,naturalHeight:4,testPixels:leftPixels},rightFrame={naturalWidth:4,naturalHeight:4,testPixels:rightPixels};imageMedia.set(actor.image,{animation:{frame(clock){return {source:clock<50?leftFrame:rightFrame,width:4,height:4,version:clock<50?1:2};}}});SENSING.mouseX=canvas.width/2-1.5;SENSING.mouseY=canvas.height/2-1.5;`);
    assert.equal(e.run(`resolveValue(touchingMouse('animated'))`),true);const reads=e.stats.reads;
    assert.equal(e.run(`resolveValue(touchingMouse('animated'))`),true);assert.equal(e.stats.reads,reads);
    e.run('ENGINE.animationClock=50');assert.equal(e.run(`resolveValue(touchingMouse('animated'))`),false);assert.equal(e.stats.reads,reads+1);
    e.run('SENSING.mouseX=canvas.width/2+1.5');assert.equal(e.run(`resolveValue(touchingMouse('animated'))`),true);
    e.run('actor.effects.brightness=20;applySpriteEffects(actor)');const effectReads=e.stats.reads;e.run('applySpriteEffects(actor)');assert.equal(e.stats.reads,effectReads);
    e.run('ENGINE.animationClock=0;applySpriteEffects(actor)');assert.equal(e.stats.reads,effectReads+1);
});

test('GIF frame boundaries tolerate fractional game-clock values',()=>{
    const e=engine(),bytes=fs.readFileSync(new URL('../images/character_art/pixel_art/c1_costume/costume1_idle1.gif',import.meta.url));
    e.sandbox.gifBytes=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    e.run(`ENGINE.animationClock=56.400000000000006;const parsed=JScratchGIF.parseGIF(gifBytes);for(const f of parsed.frames)if(f.gce)f.gce.delay=10;const timed=createGifAnimation(parsed);timed.frame(ENGINE.animationClock+200)`);assert.equal(e.run('timed.index'),2);
});

test('camera blocks accept live coordinates and zoom without changing sprite size or HUD scale',async()=>{
    const e=engine();e.run(`const target=new Sprite('target');target.x=120;target.y=-40;target.scale=.3;target.width=48;target.height=96;ENGINE.sprites.target=target;`);
    await e.settle(e.run(`executeBlocks([cameraTo(spriteX('target'),spriteY('target')),cameraZoom(2)],createScriptContext())`));
    assert.equal(e.run('ENGINE.camera.x'),120);assert.equal(e.run('ENGINE.camera.y'),-40);assert.equal(e.run('resolveValue(cameraZoom())'),2);
    assert.equal(e.run('ENGINE.unitScale'),2);assert.equal(e.run('ENGINE.viewWidth'),320);assert.equal(e.run('ENGINE.sprites.target.width'),48);assert.equal(e.run('ENGINE.sprites.target.scale'),.3);assert.equal(e.run('uiScale()'),1);
    e.run('SENSING.mouseX=canvas.width/2+40;SENSING.mouseY=canvas.height/2-20');assert.equal(e.run('getCanvasPoint().x'),140);assert.equal(e.run('getCanvasPoint().y'),-30);
    await e.settle(e.run(`executeBlock(cameraBy(5,6),createScriptContext())`));assert.equal(e.run('ENGINE.camera.x'),125);assert.equal(e.run('ENGINE.camera.y'),-34);
});

test('camera follows sprites and clones with offsets, can stop, and can jump once',async()=>{
    const e=engine();e.run(`ENGINE.sprites.player=new Sprite('player');ENGINE.sprites.player.x=100;ENGINE.sprites.player.y=20;`);
    await e.settle(e.run(`executeBlock(cameraFollow('player',10,-5),createScriptContext())`));e.run('ENGINE.sprites.player.x=200;render()');assert.equal(e.run('ENGINE.camera.x'),210);assert.equal(e.run('ENGINE.camera.y'),15);
    await e.settle(e.run(`executeBlock(cameraStopFollowing(),createScriptContext())`));e.run('ENGINE.sprites.player.x=300;render()');assert.equal(e.run('ENGINE.camera.x'),210);
    await e.settle(e.run(`executeBlock(cameraToSprite('player'),createScriptContext())`));assert.equal(e.run('ENGINE.camera.x'),300);e.run('ENGINE.sprites.player.x=400;render()');assert.equal(e.run('ENGINE.camera.x'),300);
    e.run(`const followedClone=new Sprite('player',true);followedClone.x=55;followedClone.y=66;const cloneCamera=createScriptContext(followedClone);`);
    await e.settle(e.run(`executeBlock(cameraFollow('self'),cloneCamera)`));assert.equal(e.run('ENGINE.camera.x'),55);e.run('followedClone.deleted=true;render()');assert.equal(e.run('ENGINE.camera.follow'),null);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('camera JSON loads defaults for startup and reset, with safe fallback for invalid input',async()=>{
    const config={x:35,y:-60,zoom:1.5,follow:null,offsetX:0,offsetY:0,offscreenCulling:true};let url;
    const e=engine({fetch:async path=>{url=path;return {ok:true,json:async()=>config};}});
    await e.settle(e.run('startRuntime()'));assert.equal(url,'camera.json');assert.equal(e.run('ENGINE.camera.x'),35);assert.equal(e.run('ENGINE.camera.zoom'),1.5);
    await e.settle(e.run(`executeBlocks([cameraTo(800,900),cameraZoom(.5),cameraReset()],createScriptContext())`));assert.equal(e.run('ENGINE.camera.x'),35);assert.equal(e.run('ENGINE.camera.zoom'),1.5);
    assert.throws(()=>e.run('validateCameraConfig({zoom:0})'),/Invalid/);assert.throws(()=>e.run('validateCameraConfig({x:Infinity})'),/Invalid/);
    const bad=engine({fetch:async()=>({ok:true,json:async()=>({zoom:-1})})});await bad.settle(bad.run('startRuntime()'));assert.equal(bad.run('ENGINE.camera.x'),0);assert.equal(bad.run('ENGINE.camera.zoom'),1);
});

test('camera zoom persists through resize and rejects invalid values',async()=>{
    const e=engine();await e.settle(e.run(`executeBlock(cameraZoom(2),createScriptContext())`));e.run('resizeGame()');assert.equal(e.run('ENGINE.unitScale'),e.run('ENGINE.baseUnitScale*2'));assert.equal(e.run('ENGINE.viewWidth'),e.run('ENGINE.baseViewWidth/2'));
    await e.settle(e.run(`executeBlock(cameraZoom(0),createScriptContext())`));assert.equal(e.run('ENGINE.camera.zoom'),2);assert.match(e.run('ENGINE.errors.at(-1).message'),/greater than zero/);
});

test('offscreen culling skips effects and draw calls while leaving scripts and collisions active',async()=>{
    const e=engine();e.run(`const off=new Sprite('off');off.image={naturalWidth:10,naturalHeight:10};off.loaded=true;off.x=10000;off.effects.brightness=20;ENGINE.sprites.off=off;ENGINE.spriteOrderDirty=true;render()`);
    assert.equal(e.run('ENGINE.renderStats.culled'),1);assert.equal(e.run('ENGINE.renderStats.drawn'),0);assert.equal(e.stats.reads,0);assert.equal(e.stats.draws,0);
    await e.settle(e.run(`executeBlock(changeSpriteVarBy('off','ticks',1),createScriptContext())`));assert.equal(e.run('ENGINE.sprites.off.variables.ticks'),1);
    e.run(`const other=new Sprite('other');other.image=off.image;other.loaded=true;other.x=10000;ENGINE.sprites.other=other;`);assert.equal(e.run(`resolveValue(touchingSprite('off','other'))`),true);
    await e.settle(e.run(`executeBlock(cameraTo(10000,0),createScriptContext())`));e.run('ENGINE.spriteOrderDirty=true;render()');assert.equal(e.run('ENGINE.renderStats.drawn'),2);assert.equal(e.run('ENGINE.renderStats.culled'),0);
});

test('culling includes rotated edge-visible sprites and responds to zoom and camera changes',async()=>{
    const e=engine();e.run(`const edge=new Sprite('edge');edge.image={naturalWidth:10,naturalHeight:10};edge.loaded=true;edge.width=10;edge.height=100;edge.rotation=90;edge.x=350;ENGINE.sprites.edge=edge;ENGINE.spriteOrderDirty=true;render()`);assert.equal(e.run('ENGINE.renderStats.drawn'),1);
    await e.settle(e.run(`executeBlock(cameraZoom(2),createScriptContext())`));e.run('render()');assert.equal(e.run('ENGINE.renderStats.culled'),1);
    await e.settle(e.run(`executeBlock(cameraTo(350,0),createScriptContext())`));e.run('render()');assert.equal(e.run('ENGINE.renderStats.drawn'),1);
    e.run('ENGINE.camera.offscreenCulling=false;edge.x=10000;render()');assert.equal(e.run('ENGINE.renderStats.drawn'),1);
});

test('stopping during camera-config loading cannot start a stale program',async()=>{
    let complete;const e=engine({fetch:async()=>({ok:true,json:()=>new Promise(resolve=>complete=resolve)})});
    const pending=e.run('startRuntime()');await e.flush();e.run('stopRuntime()');complete({x:0,y:0,zoom:1});await e.settle(pending);
    assert.equal(e.run('ENGINE.running'),false);assert.equal(e.run('ENGINE.executedBlocks'),0);
});

test('background costumes pan and zoom in world space, and are culled offscreen',async()=>{
    const e=engine();e.run(`ENGINE.backgroundImage={naturalWidth:640,naturalHeight:360};ENGINE.backgroundLoaded=true;`);
    await e.settle(e.run(`executeBlock(cameraTo(100,50),createScriptContext())`));e.run('render()');assert.equal(e.run('ctx.lastDraw[0]'),-100);assert.equal(e.run('ctx.lastDraw[1]'),50);
    await e.settle(e.run(`executeBlock(cameraZoom(2),createScriptContext())`));e.run('render()');assert.equal(e.run('ctx.lastDraw[0]'),-520);assert.equal(e.run('ctx.lastDraw[1]'),-80);assert.equal(e.run('ctx.lastDraw[2]'),1280);
    await e.settle(e.run(`executeBlock(cameraTo(10000,10000),createScriptContext())`));const before=e.stats.draws;e.run('render()');assert.equal(e.stats.draws,before);
});

function solidFixture(){
    const e=engine();e.run(`const actor=new Sprite('Actor'),wall=new Sprite('Wall');actor.width=actor.height=2;wall.width=2;wall.height=100;wall.x=10;for(const body of [actor,wall]){body.image={naturalWidth:2,naturalHeight:2};body.loaded=true;ENGINE.sprites[body.name]=body;}`);return e;
}

test('lists use one-based indexes and can be modified through nested blocks',async()=>{
    const e=engine();e.run(`makeList('names',['A']);repeat(2,addToList('names','B'));insertInList('names',2,'C');replaceInList('names','last','D');deleteFromList('names',1);`);await e.settle(e.run('executeProgram()'));
    assert.equal(e.run(`resolveValue(listLength('names'))`),3);assert.equal(e.run(`resolveValue(listItem('names',1))`),'C');assert.equal(e.run(`resolveValue(listItem('names','last'))`),'D');assert.equal(e.run(`resolveValue(listContains('names','B'))`),true);
    await e.settle(e.run(`executeBlocks([setList('copy',getList('names')),deleteFromList('names','all')],createScriptContext())`));assert.equal(e.run(`resolveValue(listLength('names'))`),0);assert.equal(e.run(`resolveValue(listLength('copy'))`),3);
    await e.settle(e.run(`executeBlocks([clearList('copy'),deleteList('copy')],createScriptContext())`));assert.equal(e.run(`Object.hasOwn(ENGINE.lists,'copy')`),false);
});

test('solid movement is directional, opt-in, and sweeps through large distances without tunneling',async()=>{
    const e=solidFixture();await e.settle(e.run(`executeBlocks([spriteCollisionTargets('Actor',['Wall']),spriteSolid('Actor',true),moveBy('Actor',100,0)],createScriptContext())`));
    assert.ok(e.run('actor.x')<8);assert.ok(e.run('actor.x')>7.99999);assert.equal(e.run(`resolveValue(solidBlocked('Actor'))`),true);assert.equal(e.run(`resolveValue(solidContacts('Actor'))[0]`),'Wall');assert.equal(e.run(`resolveValue(touchingSprite('Actor','Wall'))`),false);
    await e.settle(e.run(`executeBlocks([spriteSolid('Wall',true),spriteCollisionTargets('Wall',['Someone Else']),moveBy('Wall',-20,0)],createScriptContext())`));assert.equal(e.run('wall.x'),-10);assert.equal(e.run(`resolveValue(solidBlocked('Wall'))`),false);
    await e.settle(e.run(`executeBlocks([spriteSolid('Actor',false),moveTo('Actor',-20,0)],createScriptContext())`));assert.equal(e.run('actor.x'),-20);assert.equal(e.run(`resolveValue(solidBlocked('Actor'))`),false);
});

test('collision targets can be stored in a live list and changed without reassigning the sprite',async()=>{
    const e=solidFixture();await e.settle(e.run(`executeBlocks([makeList('walls',['Wall']),spriteCollisionTargets('Actor',getList('walls')),spriteSolid('Actor',true),moveBy('Actor',100,0)],createScriptContext())`));assert.ok(e.run('actor.x')<8);
    await e.settle(e.run(`executeBlocks([clearList('walls'),moveBy('Actor',100,0)],createScriptContext())`));assert.ok(e.run('actor.x')>100);
    await e.settle(e.run(`executeBlocks([setList('walls',['Wall']),moveTo('Actor',0,0)],createScriptContext())`));assert.ok(e.run('actor.x')>12);assert.equal(e.run(`resolveValue(solidTargets('Actor'))[0]`),'Wall');
});

test('solid motion slides along walls and stops safely at a second wall',async()=>{
    const e=solidFixture();await e.settle(e.run(`executeBlocks([spriteSolid('Actor',true),spriteCollisionTargets('Actor',['Wall']),moveBy('Actor',20,20)],createScriptContext())`));assert.ok(Math.abs(e.run('actor.x')-8)<1e-5);assert.ok(Math.abs(e.run('actor.y')-20)<1e-5);
    e.run(`actor.x=actor.y=0;const ceiling=new Sprite('Ceiling');ceiling.width=100;ceiling.height=2;ceiling.y=15;ceiling.image={naturalWidth:2,naturalHeight:2};ceiling.loaded=true;ENGINE.sprites.Ceiling=ceiling;`);
    await e.settle(e.run(`executeBlocks([spriteCollisionTargets('Actor',['Wall','Ceiling']),moveBy('Actor',20,20)],createScriptContext())`));assert.ok(e.run('actor.y')<13);assert.ok(e.run('actor.y')>12.99999);assert.equal(e.run('actor.solidCollision.contacts.length'),2);
});

test('solids use costume alpha including ghosted sprites and let movement pass through holes',async()=>{
    const e=solidFixture();e.run(`const pixels=new Uint8ClampedArray(4*4*4);for(let y=0;y<4;y++)pixels[(y*4)*4+3]=255;wall.image={naturalWidth:4,naturalHeight:4,testPixels:pixels};wall.width=wall.height=4;wall.effects.ghost=100;`);
    await e.settle(e.run(`executeBlocks([spriteSolid('Actor',true),spriteCollisionTargets('Actor',['Wall']),moveBy('Actor',100,0)],createScriptContext())`));assert.ok(Math.abs(e.run('actor.x')-7)<1e-5);
    e.run(`actor.x=actor.y=0;const hole=new Uint8ClampedArray(4*4*4);for(let x=0;x<4;x++){hole[x*4+3]=255;hole[(12+x)*4+3]=255;}wall.image={naturalWidth:4,naturalHeight:4,testPixels:hole};wall.width=4;wall.height=10;`);
    await e.settle(e.run(`executeBlock(moveBy('Actor',100,0),createScriptContext())`));assert.equal(e.run('actor.x'),100);assert.equal(e.run(`resolveValue(solidBlocked('Actor'))`),false);
});

test('glides, target moves and off-stage motion respect solids; existing overlaps can escape',async()=>{
    const e=solidFixture();await e.settle(e.run(`executeBlocks([spriteSolid('Actor',true),spriteCollisionTargets('Actor',['Wall']),glideTo('Actor',100,0,.1)],createScriptContext())`));assert.ok(e.run('actor.x')<8);assert.ok(e.run('actor.x')>7.99999);
    e.run('actor.x=9');await e.settle(e.run(`executeBlock(moveTo('Actor',0,0),createScriptContext())`));assert.equal(e.run('actor.x'),0);
    await e.settle(e.run(`executeBlock(moveToSprite('Actor','Wall'),createScriptContext())`));assert.ok(Math.abs(e.run('actor.x')-8)<1e-5);
    e.run('actor.x=10000;wall.x=10010');await e.settle(e.run(`executeBlock(glideToSprite('Actor','Wall',0),createScriptContext())`));assert.ok(Math.abs(e.run('actor.x')-10008)<1e-5);
});

test('clones inherit solid settings and target lists can select clone families or individual IDs',async()=>{
    const e=solidFixture();await e.settle(e.run(`executeBlocks([spriteSolid('Actor',true),spriteCollisionTargets('Actor',['Wall'])],createScriptContext())`));
    e.run(`actor.costume='actor-test.png';wall.costume='wall-test.png';actor.image.complete=wall.image.complete=true;actor.scale=wall.scale=2/160;const copy=createClone(actor);copy.x=0;const obstacle=createClone(wall);obstacle.x=20;wall.x=1000;`);assert.equal(e.run('copy.solidCollision.enabled'),true);
    await e.settle(e.run(`executeBlock(moveBy('Actor',100,0),createScriptContext(copy))`));assert.ok(Math.abs(e.run('copy.x')-18)<1e-5);
    e.run('copy.x=0');await e.settle(e.run(`executeBlocks([spriteCollisionTargets('self',[obstacle.cloneIdName]),moveBy('self',100,0)],createScriptContext(copy))`));assert.ok(Math.abs(e.run('copy.x')-18)<1e-5);
    assert.equal(e.run('actor.solidCollision.targets[0]'),'Wall');
});

test('rotated solid surfaces slide without overlap and camera zoom does not change physics',async()=>{
    const e=solidFixture();e.run('wall.width=2;wall.height=20;wall.rotation=45');await e.settle(e.run(`executeBlocks([spriteSolid('Actor',true),spriteCollisionTargets('Actor',['Wall']),cameraZoom(3),moveBy('Actor',20,0)],createScriptContext())`));assert.ok(e.run('actor.y')>0);assert.equal(e.run(`resolveValue(touchingSprite('Actor','Wall'))`),false);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('flat sample.js constructs examples for every registered command and reporter',()=>{
    const e=engine(),source=fs.readFileSync(new URL('../JScratch/program/sample.js',import.meta.url),'utf8');
    assert.ok(!source.includes('JSCRATCH_SAMPLES'));assert.ok(source.includes('// <----- Solid Collision Blocks ----->'));
    e.run(`const sampleExpected=Object.entries(ENGINE.blocks).map(([type,block])=>({type,command:!!block.execute,reporter:!!block.reporter}));
        const sampleCommands=new Set(),sampleReporters=new Set(),sampleOriginalCreate=createBlock;
        createBlock=(type,data)=>{sampleCommands.add(type);return sampleOriginalCreate(type,data);};
        for(const {type,reporter} of sampleExpected){
            if(!reporter)continue;
            const name=({spriteVariable:'getSpriteVar',cameraZoomValue:'cameraZoom'})[type]||type,original=window[name];
            if(typeof original!=='function')continue;
            window[name]=(...args)=>{const value=original(...args);if(value?.type==='operator')sampleReporters.add(value.operator);else if(value?.type)sampleReporters.add(value.type);return value;};
        }`);
    e.run(source);
    const missing=e.run(`sampleExpected.flatMap(({type,command,reporter})=>[...(command&&!sampleCommands.has(type)?['command '+type]:[]),...(reporter&&!sampleReporters.has(type)?['reporter '+type]:[])]).join(', ')`);
    assert.equal(missing,'');assert.equal(e.run('validateBlocks(ENGINE.program).join("\\n")'),'');
    assert.equal(e.run('ENGINE.executedBlocks'),0);assert.equal(e.run('Object.keys(ENGINE.variables).length'),0);
});

test('existing overlaps cannot be used to move deeper through an obstacle',async()=>{
    const e=solidFixture();e.run('actor.x=8.2');await e.settle(e.run(`executeBlocks([spriteSolid('Actor',true),spriteCollisionTargets('Actor',['Wall']),moveBy('Actor',100,0)],createScriptContext())`));assert.equal(e.run('actor.x'),8.2);assert.equal(e.run('actor.solidCollision.blocked'),true);
    await e.settle(e.run(`executeBlock(moveBy('Actor',-5,0),createScriptContext())`));assert.ok(Math.abs(e.run('actor.x')-3.2)<1e-10);
});

test('UI elements share Sprite identity, transforms, variables, effects and layer ordering',async()=>{
    const e=engine();await e.settle(e.run(`executeBlocks([uiBox('HUD',0,0,100,20,'#f00'),moveBy('HUD',30,40),setSpriteVar('HUD','Health',75),spriteSetSize('HUD',2),direction('HUD',30),facing('HUD','left'),spriteEffect('HUD','ghost',50),spriteLayer('HUD',8)],createScriptContext())`));
    assert.equal(e.run('ENGINE.sprites.HUD instanceof Sprite'),true);assert.equal(e.run('ENGINE.sprites.HUD'),e.run('ML_UI.elements.HUD'));
    assert.equal(e.run('ENGINE.sprites.HUD.x'),30);assert.equal(e.run('ENGINE.sprites.HUD.y'),40);assert.equal(e.run('ENGINE.sprites.HUD.width'),200);assert.equal(e.run('ENGINE.sprites.HUD.height'),40);assert.equal(e.run('ENGINE.sprites.HUD.rotation'),30);assert.equal(e.run('ENGINE.sprites.HUD.flipX'),-1);assert.equal(e.run('ENGINE.sprites.HUD.effects.ghost'),50);assert.equal(e.run('ENGINE.sprites.HUD.variables.Health'),75);assert.equal(e.run('ENGINE.sprites.HUD.layer'),8);assert.equal(e.run('ENGINE.sprites.HUD.costume'),'');
    e.run('render()');assert.equal(e.run('ENGINE.renderStats.drawn'),1);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('score text and health bars stay bound to live values without rebuilding costumes',async()=>{
    const e=engine();await e.settle(e.run(`executeBlocks([setVar('Score',10),setVar('HP',80),setVar('MaxHP',100),uiText('Scoreboard',join('Score: ',getVar('Score'))),uiProgressBar('HP Bar',0,0,200,20,getVar('HP'),getVar('MaxHP'))],createScriptContext())`));
    e.run('render()');assert.equal(e.run('ENGINE.sprites.Scoreboard.text'),'Score: 10');assert.equal(e.run('ENGINE.sprites["HP Bar"].progress'),.8);const version=e.run('ENGINE.sprites["HP Bar"].uiRevision');e.run('render()');assert.equal(e.run('ENGINE.sprites["HP Bar"].uiRevision'),version);
    await e.settle(e.run(`executeBlocks([setVar('Score',25),setVar('HP',30)],createScriptContext())`));e.run('render()');assert.equal(e.run('ENGINE.sprites.Scoreboard.text'),'Score: 25');assert.equal(e.run('ENGINE.sprites["HP Bar"].progress'),.3);assert.equal(e.run('ENGINE.sprites["HP Bar"].uiRevision'),version+1);
    await e.settle(e.run(`executeBlocks([uiSetValue('HP Bar',15),uiSetMax('HP Bar',50),uiSet('Scoreboard','weight','bold')],createScriptContext())`));assert.equal(e.run('ENGINE.sprites["HP Bar"].progress'),.3);assert.equal(e.run('ENGINE.sprites.Scoreboard.weight'),'bold');
});

test('UI bindings preserve clone contexts and explicit transform bindings can be released',async()=>{
    const e=engine();await e.settle(e.run(`executeBlocks([uiText('counter',getSpriteVar('counter','Points')),setSpriteVar('counter','Points',10)],createScriptContext())`));
    e.run(`const uiClone=createClone(ENGINE.sprites.counter);const uiCloneContext=createScriptContext(uiClone);`);
    await e.settle(e.run(`executeBlocks([setSpriteVar('self','Points',20),uiSetText('self',getSpriteVar('self','Points'))],uiCloneContext)`));assert.equal(e.run('uiClone instanceof UISprite'),true);assert.equal(e.run('uiClone.text'),20);assert.equal(e.run('ENGINE.sprites.counter.text'),10);
    await e.settle(e.run(`executeBlocks([setVar('UI X',30),uiBind('counter','x',getVar('UI X'))],createScriptContext())`));e.run('ENGINE.variables["UI X"]=50;render()');assert.equal(e.run('ENGINE.sprites.counter.x'),50);
    await e.settle(e.run(`executeBlocks([uiUnbind('counter','x'),moveBy('counter',5,0)],createScriptContext())`));e.run('ENGINE.variables["UI X"]=100;render()');assert.equal(e.run('ENGINE.sprites.counter.x'),55);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('UI deletes, clears and clones use shared sprite lifecycle without stale registry entries',async()=>{
    const e=engine();await e.settle(e.run(`executeBlocks([createSprite('World'),uiBox('A'),uiText('B','text')],createScriptContext())`));e.run(`const deletedUI=ENGINE.sprites.A;const orphanUI=createClone(deletedUI);`);
    await e.settle(e.run(`executeBlock(deleteSprite('A'),createScriptContext())`));assert.equal(e.run('ML_UI.elements.A'),undefined);assert.equal(e.run('deletedUI.deleted'),true);assert.equal(e.run('orphanUI.deleted'),false);
    await e.settle(e.run(`executeBlock(uiClear(),createScriptContext())`));assert.equal(e.run('ENGINE.clones.length'),0);assert.equal(e.run('Object.keys(ML_UI.elements).length'),0);assert.equal(e.run('Object.keys(ENGINE.sprites).join()'),'World');
    await e.settle(e.run(`executeBlocks([uiBox('C'),deleteAllSprites()],createScriptContext())`));assert.equal(e.run('Object.keys(ML_UI.elements).length'),0);assert.equal(e.run('Object.keys(ENGINE.sprites).length'),0);
});

test('canvas coordinate mode pins ordinary sprites to stage units across camera, zoom and DPI changes',async()=>{
    const e=engine();e.run(`const button=new Sprite('Button');button.image={naturalWidth:4,naturalHeight:4};button.width=button.height=4;button.loaded=true;button.x=100;button.y=50;ENGINE.sprites.Button=button;ENGINE.spriteOrderDirty=true;const translations=[];ctx.translate=(x,y)=>translations.push([x,y]);`);
    await e.settle(e.run(`executeBlocks([spriteCoordinateMode('Button',true),cameraTo(200,300),cameraZoom(2)],createScriptContext())`));e.run('render()');assert.equal(e.run('translations.at(-1).join()'),'100,50');assert.equal(e.run(`resolveValue(coordinateModeOfSprite('Button'))`),'canvas');
    e.sandbox.devicePixelRatio=2;e.run('resizeGame();render()');assert.equal(e.run('translations.at(-1).join()'),'200,100');
    await e.settle(e.run(`executeBlocks([spriteCoordinateMode('Button',false),cameraTo(20,30),cameraZoom(1)],createScriptContext())`));assert.equal(e.run('button.x'),100);assert.equal(e.run('button.y'),50);assert.equal(e.run(`resolveValue(coordinateModeOfSprite('Button'))`),'world');
});

test('canvas hit tests use browser coordinates and mixed-mode collision stays aligned with the display',async()=>{
    const e=engine();e.run(`const pin=new Sprite('Pin'),worldBody=new Sprite('World Body');for(const s of [pin,worldBody]){s.image={naturalWidth:4,naturalHeight:4};s.loaded=true;s.width=s.height=2;}pin.x=100;pin.y=50;pin.width=pin.height=4;ENGINE.sprites.Pin=pin;ENGINE.sprites['World Body']=worldBody;`);
    await e.settle(e.run(`executeBlocks([spriteCoordinateMode('Pin','canvas'),cameraTo(100,50),cameraZoom(2)],createScriptContext())`));
    e.run('worldBody.x=-10;worldBody.y=115;SENSING.mouseX=100;SENSING.mouseY=50');assert.equal(e.run(`resolveValue(touchingMouse('Pin'))`),true);assert.equal(e.run(`resolveValue(touchingSprite('Pin','World Body'))`),true);
    await e.settle(e.run(`executeBlock(cameraTo(200,50),createScriptContext())`));assert.equal(e.run(`resolveValue(touchingMouse('Pin'))`),true);assert.equal(e.run(`resolveValue(touchingSprite('Pin','World Body'))`),false);
});

test('canvas-coordinate sprites obey directional solids in logical stage units with camera zoom',async()=>{
    const e=engine();e.run(`const canvasActor=new Sprite('A'),canvasWall=new Sprite('B');for(const s of [canvasActor,canvasWall]){s.image={naturalWidth:2,naturalHeight:2};s.loaded=true;s.width=2;s.height=20;ENGINE.sprites[s.name]=s;}canvasActor.height=2;canvasActor.x=10;canvasActor.y=10;canvasWall.x=40;canvasWall.y=10;`);
    await e.settle(e.run(`executeBlocks([spriteCoordinateMode('A','canvas'),spriteCoordinateMode('B','canvas'),cameraZoom(3),cameraTo(300,-200),spriteSolid('A',true),spriteCollisionTargets('A',['B']),moveBy('A',100,0)],createScriptContext())`));assert.ok(Math.abs(e.run('canvasActor.x')-38)<1e-5);assert.equal(e.run('canvasActor.y'),10);assert.equal(e.run(`resolveValue(touchingSprite('A','B'))`),false);
});

test('UI defaults to world space and can opt into a fixed canvas mode',async()=>{
    const e=engine();await e.settle(e.run(`executeBlocks([uiButton('Button',100,50,120,40,'Go'),uiProgressBar('HP',0,0,200,20,75,100),cameraZoom(2)],createScriptContext())`));assert.equal(e.run('ENGINE.sprites.Button.coordinateMode'),'world');
    const width=e.run('ENGINE.sprites.Button.width');await e.settle(e.run(`executeBlocks([coordinatePlane('Button','right','top'),moveTo('Button',70,30)],createScriptContext())`));assert.equal(e.run('ENGINE.sprites.Button.x'),70);assert.equal(e.run('ENGINE.sprites.Button.y'),30);assert.equal(e.run('ENGINE.sprites.Button.width'),width);
});

test('UI caches unchanged text measurement and supports direct shared dimensions',async()=>{
    const e=engine();await e.settle(e.run(`executeBlocks([setVar('Score',5),uiText('Score',getVar('Score')),uiBox('Box',0,0,100,20)],createScriptContext())`));e.run('render()');const count=e.stats.measures;
    e.run('render();render();render()');assert.equal(e.stats.measures,count);
    e.run('ENGINE.sprites.Box.width=250;ENGINE.sprites.Box.height=40;render()');assert.equal(e.run('ENGINE.sprites.Box.width'),250);assert.equal(e.run('ENGINE.sprites.Box.height'),40);
    await e.settle(e.run(`executeBlock(spriteSetSize('Box',2),createScriptContext())`));assert.equal(e.run('ENGINE.sprites.Box.width'),500);assert.equal(e.run('ENGINE.sprites.Box.height'),80);
});

test('coordinate planes retain inward offsets across resize, camera changes, movement and clones',async()=>{
    const e=engine();
    await e.settle(e.run(`executeBlocks([uiButton('Pin',0,0,20,20,'Go'),coordinatePlane('Pin','right','bottom'),moveTo('Pin',30,40),cameraTo(800,-500),cameraZoom(3)],createScriptContext())`));
    assert.equal(e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.sprites.Pin))`),'{"x":610,"y":320}');
    e.sandbox.innerWidth=390;e.sandbox.innerHeight=844;e.run('setCanvasDimensions(390,844)');
    assert.equal(e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.sprites.Pin))`),'{"x":360,"y":804}');
    await e.settle(e.run(`executeBlocks([moveBy('Pin',5,-10),makeClone('Pin')],createScriptContext())`));
    assert.equal(e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.sprites.Pin))`),'{"x":355,"y":814}');
    assert.equal(e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.clones[0]))`),'{"x":355,"y":814}');
    assert.equal(e.run(`resolveValue(spriteX('Pin'))`),35);
    assert.equal(e.run(`resolveValue(spriteY('Pin'))`),30);
    for(const horizontal of ['left','right'])for(const vertical of ['top','bottom']){
        await e.settle(e.run(`executeBlocks([coordinatePlane('Pin','${horizontal}','${vertical}'),moveTo('Pin',30,40)],createScriptContext())`));
        assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites.Pin).x`),horizontal==='right'?360:30);
        assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites.Pin).y`),vertical==='bottom'?804:40);
        assert.equal(e.run(`(()=>{const s=ENGINE.sprites.Pin,p=getSpriteWorldGeometry(s),v=worldPointForSprite(s,p.x,p.y);return Math.abs(v.x-30)<1e-9&&Math.abs(v.y-40)<1e-9})()`),true);
    }
    assert.equal(e.run('typeof moveToEdge'),'undefined');
});

test('right-bottom plane solid movement respects inward coordinate directions',async()=>{
    const e=engine();
    await e.settle(e.run(`executeBlocks([uiBox('A',10,10,2,2),uiBox('B',40,10,2,20),coordinatePlane('A','right','bottom'),coordinatePlane('B','right','bottom'),cameraZoom(3),spriteSolid('A',true),spriteCollisionTargets('A',['B']),moveBy('A',100,0)],createScriptContext())`));
    assert.ok(Math.abs(e.run('ENGINE.sprites.A.x')-38)<1e-5);
});

test('whenStart absorbs startup commands, runs hats concurrently, and replays on restart',async()=>{
    const e=engine();
    e.run(`whenStart(changeVarBy('started',1),wait(.1),changeVarBy('finished',1));whenStart(changeVarBy('started',1),wait(.1),changeVarBy('finished',1));`);
    assert.equal(e.run('ENGINE.program.length'),0);
    const pending=e.run('startRuntime()');await e.flush();
    assert.equal(e.run('ENGINE.variables.started'),2);assert.equal(e.run('ENGINE.variables.finished'),undefined);
    await e.settle(pending);assert.equal(e.run('ENGINE.variables.finished'),2);
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.variables.started'),2);assert.equal(e.run('ENGINE.variables.finished'),2);
});

test('declarative block definitions supply commands, reporters, containers and defaults',async()=>{
    const e=engine();
    e.run(`defineJScratchBlock({name:'gainPoints',kind:'command',category:'custom',params:[{name:'amount',default:2}]},(b,c)=>{ENGINE.variables.Points=(ENGINE.variables.Points||0)+Number(resolveValue(b.amount,c));});defineJScratchBlock({name:'pointsValue',kind:'reporter',params:[]},()=>ENGINE.variables.Points||0);defineJScratchBlock({name:'runGroup',kind:'container',params:[]},(b,c)=>executeBlocks(b.blocks,c));whenStart(runGroup(gainPoints(),gainPoints(3)),setVar('Result',pointsValue()));`);
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.variables.Result'),5);assert.equal(e.run('ENGINE.errors.length'),0);
    assert.throws(()=>e.run(`defineJScratchBlock({name:'gainPoints',kind:'command'},()=>{})`),/already exists/);
    assert.throws(()=>e.run(`defineJScratchBlock({name:'brokenBlock',kind:'command',params:[{name:'blocks'}]},()=>{})`),/Reserved/);
});
test('startup waits for program registration and stopping while loading cancels startup',async()=>{
    const e=engine();e.run(`let finishLoading;ENGINE.programReady=new Promise(resolve=>finishLoading=resolve);whenStart(setVar('Started',true));`);
    const pending=e.run('startRuntime()');await e.flush();assert.equal(e.run('ENGINE.variables.Started'),undefined);
    e.run(`whenBroadcast('Late',setVar('Late Registered',true));finishLoading();`);await e.settle(pending);assert.equal(e.run('ENGINE.variables.Started'),true);
    e.run(`ENGINE.programReady=new Promise(resolve=>finishLoading=resolve);`);const stopped=e.run('startRuntime()');e.run('stopRuntime();ENGINE.variables.Started=false;finishLoading()');await e.settle(stopped);assert.equal(e.run('ENGINE.variables.Started'),false);
});

test('custom blocks register across file order, pass live values, return early and isolate locals',async()=>{
    const e=engine();e.run(`whenStart(callFunction('sum',2,3),setVar('answer',functionResult()),setVar('outside',functionValue('a')));defineFunction('sum',['a','b'],setFunctionValue('total',add(functionValue('a'),functionValue('b'))),repeat(3,returnFunction(functionValue('total')),setVar('bad',1)),setVar('bad',2));`);
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.variables.answer'),5);assert.equal(e.run('ENGINE.variables.outside'),'');assert.equal(e.run('ENGINE.variables.bad'),undefined);assert.equal(e.run('ENGINE.errors.length'),0);
});
test('recursive and concurrent custom calls retain their own parameters and return values',async()=>{
    const e=engine();e.run(`defineFunction('factorial',['n'],ifBlock(lEqThan(functionValue('n'),1),returnFunction(1)),callFunction('factorial',sub(functionValue('n'),1)),returnFunction(mult(functionValue('n'),functionResult())));whenStart(callFunction('factorial',5),setVar('five',functionResult()));whenStart(callFunction('factorial',6),setVar('six',functionResult()));`);
    await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.variables.five'),120);assert.equal(e.run('ENGINE.variables.six'),720);assert.equal(e.run('ENGINE.errors.length'),0);
});
test('deep recursive custom blocks yield without a JavaScript stack limit and respect stop',async()=>{
    const e=engine();e.run(`ENGINE.budgetLimit=20;defineFunction('again',[],callFunction('again'));whenStart(callFunction('again'));`);const task=e.run('startRuntime()');await e.flush();assert.ok(e.run('ENGINE.activeScripts.size')>0);await e.tick();e.run('stopRuntime()');await e.settle(task);assert.equal(e.run('ENGINE.errors.length'),0);
});
test('custom blocks preserve clone context and cannot break a caller loop',async()=>{
    const e=engine();e.run(`defineFunction('mark',[],setSpriteVar('self','HP',7));whenClone('Actor',callFunction('mark'));whenStart(createSprite('Actor'),makeClone('Actor'));`);await e.settle(e.run('startRuntime()'));await e.flush();assert.equal(e.run('ENGINE.clones[0].variables.HP'),7);
    const b=engine();b.run(`defineFunction('bad',[],breakLoop());whenStart(repeat(2,callFunction('bad')));`);await b.settle(b.run('startRuntime()'));assert.match(b.run('ENGINE.errors[0].message'),/outside a loop/);
});
test('custom block duplicate definitions and incorrect arguments give runtime errors',async()=>{
    const e=engine();e.run(`defineFunction('same',[]);defineFunction('same',[]);whenStart(setVar('bad',1));`);await e.settle(e.run('startRuntime()'));assert.match(e.run('ENGINE.errors[0].message'),/Duplicate/);assert.equal(e.run('ENGINE.variables.bad'),undefined);
    const b=engine();b.run(`defineFunction('one',['x']);whenStart(callFunction('one'));`);await b.settle(b.run('startRuntime()'));assert.match(b.run('ENGINE.errors[0].message'),/expected 1 arguments/);
});
test('start at broadcast resets state, suppresses startup broadcasts and then restores concurrency',async()=>{
    const e=engine();e.run(`whenStart(setVar('ready',true),createSprite('Player'),broadcast('Menu'),broadcastAndWait('World'));whenBroadcast('Menu',setVar('menu',true));whenBroadcast('World',changeVarBy('world',1),broadcast('Child'));whenBroadcast('World',changeVarBy('world',1));whenBroadcast('Child',changeVarBy('children',1));ENGINE.variables.stale=1;`);
    await e.settle(e.run(`MLGame.startAtBroadcast('World')`));await e.flush();assert.equal(e.run('ENGINE.variables.stale'),undefined);assert.equal(e.run('ENGINE.variables.ready'),true);assert.equal(e.run('!!ENGINE.sprites.Player'),true);assert.equal(e.run('ENGINE.variables.menu'),undefined);assert.equal(e.run('ENGINE.variables.world'),2);assert.equal(e.run('ENGINE.variables.children'),1);assert.equal(e.run('ENGINE.suppressBroadcasts'),false);
    await e.settle(e.run('startRuntime()'));await e.flush();assert.equal(e.run('ENGINE.variables.menu'),true);assert.equal(e.run('ENGINE.variables.world'),2);
});
test('stop during start-at-broadcast initialization never launches the selected scene',async()=>{
    const e=engine();e.run(`whenStart(wait(1));whenBroadcast('World',setVar('bad',1));`);const task=e.run(`startRuntime({broadcast:'World'})`);await e.flush();e.run('stopRuntime()');await e.settle(task);assert.equal(e.run('ENGINE.variables.bad'),undefined);
});
test('restart-at-broadcast blocks in startup do not recursively reboot initialization',async()=>{
    const e=engine();e.run(`whenStart(setVar('ready',1),beginGameAtBroadcast('World'));whenBroadcast('World',setVar('world',1));`);await e.settle(e.run(`startRuntime({broadcast:'World'})`));await e.flush();assert.equal(e.run('ENGINE.variables.world'),1);assert.equal(e.run('ENGINE.errors.length'),0);
});
test('a startup error prevents launching the development entry',async()=>{
    const e=engine();e.run(`whenStart(callFunction('missing'));whenBroadcast('World',setVar('bad',1));`);await e.settle(e.run(`startRuntime({broadcast:'World'})`));await e.flush();assert.equal(e.run('ENGINE.variables.bad'),undefined);assert.match(e.run('ENGINE.errors[0].message'),/Unknown custom block/);
});

test('inset canvas fits declared logical size and camera/pointer coordinates share that region',async()=>{
    const e=engine({logicalWidth:480,innerWidth:1200,innerHeight:900,devicePixelRatio:2,canvasRect:{left:150,top:90,width:480,height:270}});
    assert.equal(e.run('canvas.width'),960);assert.equal(e.run('canvas.height'),540);assert.equal(e.run('ENGINE.displayWidth'),480);assert.equal(e.run('ENGINE.displayHeight'),270);assert.equal(e.run('canvas.style.width'),'480px');
    await e.settle(e.run(`executeBlocks([uiButton('HUD',0,0,80,30,'Go'),coordinatePlane('HUD','right','bottom'),moveTo('HUD',50,25),cameraTo(321,-123),cameraZoom(2)],createScriptContext())`));
    assert.equal(e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.sprites.HUD))`),'{"x":510,"y":335}');e.run('getMousePosition({clientX:390,clientY:225})');assert.ok(Math.abs(e.run('getCanvasPoint().x')-321)<1e-8);assert.ok(Math.abs(e.run('getCanvasPoint().y')+123)<1e-8);
    e.run('getMousePosition({clientX:532.5,clientY:341.25})');assert.equal(e.run(`resolveValue(touchingMouse('HUD'))`),true);
    e.sandbox.canvasRect={left:80,top:50,width:600,height:320};e.run('resizeGame()');assert.equal(e.run('ENGINE.displayWidth'),600);assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites.HUD).x`),527.5);assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites.HUD).y`),335);assert.equal(e.run('ENGINE.camera.x'),321);assert.equal(e.run('ENGINE.camera.zoom'),2);assert.ok(e.run('Math.abs(SENSING.mouseX-(532.5-canvas.getBoundingClientRect().left)*canvas.width/canvas.getBoundingClientRect().width)<1e-8'));
});
test('hidden canvases retain their fixed logical dimensions and recover fitting when shown',()=>{
    const e=engine({logicalWidth:480,canvasRect:{left:0,top:0,width:400,height:240}}),scale=e.run('ENGINE.unitScale');assert.equal(e.run('ENGINE.displayWidth'),400);e.sandbox.canvasRect={width:0,height:0,left:0,top:0};e.run('resizeGame()');assert.equal(e.run('canvas.width'),400);assert.equal(e.run('ENGINE.unitScale'),scale);e.sandbox.canvasRect={width:500,height:300,left:0,top:0};e.run('resizeGame()');assert.equal(e.run('canvas.width'),500);assert.equal(e.run('ENGINE.displayWidth'),500);
});
test('canvas offsets measure rotated and scaled sprite centers on every plane, including clones',async()=>{
    const e=engine({logicalWidth:500,logicalHeight:300,canvasRect:{left:100,top:50,width:500,height:300},devicePixelRatio:2});e.run('resizeGame()');await e.settle(e.run(`executeBlocks([uiBox('Pin',0,0,80,30),coordinatePlane('Pin','right','bottom'),moveTo('Pin',10,12),cameraTo(800,-700),cameraZoom(3)],createScriptContext())`));
    for(const rotation of [0,35,90,180])for(const horizontal of ['left','right'])for(const vertical of ['top','bottom']){
        await e.settle(e.run(`executeBlocks([uiSetRotation('Pin',${rotation}),uiSetScale('Pin',1.5),coordinatePlane('Pin','${horizontal}','${vertical}'),makeClone('Pin')],createScriptContext())`));
        assert.ok(e.run(`(()=>{const s=ENGINE.sprites.Pin,p=spriteCanvasPosition(s),half=spriteCanvasHalfExtents(s),right=${JSON.stringify(horizontal)}==='right',bottom=${JSON.stringify(vertical)}==='bottom';return Math.abs((right?500-p.x:p.x)-10)<1e-8&&Math.abs((bottom?300-p.y:p.y)-12)<1e-8;})()`));
        assert.equal(e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.clones.at(-1)))===JSON.stringify(spriteCanvasPosition(ENGINE.sprites.Pin))`),true);
        assert.ok(e.run(`(()=>{const s=ENGINE.sprites.Pin,p=getSpriteWorldGeometry(s),back=worldPointForSprite(s,p.x,p.y);return Math.abs(back.x-10)<1e-8&&Math.abs(back.y-12)<1e-8;})()`));
    }
    e.sandbox.canvasRect={left:0,top:0,width:700,height:400};e.run('resizeGame()');assert.ok(e.run(`(()=>{const s=ENGINE.sprites.Pin,p=spriteCanvasPosition(s),half=spriteCanvasHalfExtents(s);const area=spriteCanvasArea(s);return Math.abs(area.left+area.width-p.x-10)<1e-8&&Math.abs(300-p.y-12)<1e-8;})()`));
});
test('pointer hits outside an inset canvas do not activate an off-stage sprite',async()=>{
    const e=engine({canvasRect:{left:100,top:50,width:400,height:240}});e.run('resizeGame()');await e.settle(e.run(`executeBlocks([uiBox('Overhang',0,0,80,40),coordinatePlane('Overhang','left','top'),moveTo('Overhang',0,20)],createScriptContext())`));e.run('getMousePosition({clientX:90,clientY:70})');assert.equal(e.run(`resolveValue(touchingMouse('Overhang'))`),false);e.run('getMousePosition({clientX:110,clientY:70})');assert.equal(e.run(`resolveValue(touchingMouse('Overhang'))`),true);
});
test('canvas size blocks declare a fixed logical viewport, scale edge gaps with display, and reject invalid sizes',async()=>{
    const e=engine({logicalWidth:480,innerWidth:960,innerHeight:720});assert.equal(e.run('ENGINE.width'),480);assert.equal(e.run('ENGINE.viewWidth'),480);assert.equal(e.run('ENGINE.viewHeight'),360);assert.equal(e.run('ENGINE.displayScale'),2);
    await e.settle(e.run(`executeBlocks([uiBox('HUD',0,0,80,30),coordinatePlane('HUD','right','bottom'),moveTo('HUD',10,12)],createScriptContext())`));
    const center=e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.sprites.HUD))`);e.sandbox.innerWidth=240;e.sandbox.innerHeight=180;e.run('resizeGame()');assert.equal(e.run('ENGINE.displayScale'),.5);assert.equal(e.run('ENGINE.sprites.HUD.width'),80);assert.equal(e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.sprites.HUD))`),center);assert.equal(e.run('ENGINE.viewWidth'),480);
    await e.settle(e.run(`executeBlocks([canvasSize(800,600),cameraTo(100,200),cameraZoom(2)],createScriptContext())`));assert.equal(e.run('resolveValue(canvasWidth())'),800);assert.equal(e.run('resolveValue(canvasHeight())'),600);assert.equal(e.run('ENGINE.viewWidth'),400);assert.equal(e.run('ENGINE.viewHeight'),300);assert.equal(e.run('ENGINE.camera.x'),100);
    await e.settle(e.run(`executeBlock(canvasSize(0,360),createScriptContext())`));assert.match(e.run('ENGINE.errors.at(-1).message'),/positive finite/);assert.equal(e.run('ENGINE.width'),800);
});
test('declared startup dimensions replay on clean restarts',async()=>{
    const e=engine();e.run(`whenStart(canvasSize(720,480));`);await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.width'),720);e.run('setCanvasDimensions(100,100)');await e.settle(e.run('startRuntime()'));assert.equal(e.run('ENGINE.width'),720);assert.equal(e.run('ENGINE.height'),480);
});
test('height-fit portrait crop preserves declared box and distinguishes screen from canvas edge anchors',async()=>{
    const e=engine({logicalWidth:540,innerWidth:1080,innerHeight:720});
    await e.settle(e.run(`executeBlocks([uiBox('Box HUD',0,0,40,20),uiBox('Screen HUD',0,0,40,20),coordinatePlane('Box HUD','right','bottom'),coordinatePlane('Screen HUD','right','bottom'),spriteCoordinateMode('Screen HUD','screen'),moveTo('Box HUD',10,12),moveTo('Screen HUD',10,12)],createScriptContext())`));
    assert.equal(e.run('ENGINE.displayScale'),2);assert.equal(e.run('ENGINE.baseViewWidth'),540);assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites['Box HUD']).x`),530);assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites['Screen HUD']).x`),530);
    e.sandbox.innerWidth=360;e.sandbox.innerHeight=720;e.run('resizeGame()');assert.equal(e.run('ENGINE.width'),540);assert.equal(e.run('ENGINE.height'),360);assert.equal(e.run('ENGINE.baseViewWidth'),180);assert.equal(e.run('ENGINE.baseViewHeight'),360);assert.equal(e.run('ENGINE.camera.x'),0);
    assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites['Box HUD']).x`),350);assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites['Screen HUD']).x`),170);assert.equal(e.run(`resolveValue(coordinateModeOfSprite('Screen HUD'))`),'screen');
    for(const name of ['Box HUD','Screen HUD'])assert.ok(e.run(`(()=>{const s=ENGINE.sprites[${JSON.stringify(name)}],p=getSpriteWorldGeometry(s),back=worldPointForSprite(s,p.x,p.y);return Math.abs(back.x-10)<1e-8&&Math.abs(back.y-12)<1e-8;})()`));
    await e.settle(e.run(`executeBlocks([cameraTo(100,-50),cameraZoom(3),coordinatePlane('Screen HUD','left','top'),makeClone('Screen HUD')],createScriptContext())`));assert.equal(e.run(`ENGINE.sprites['Screen HUD'].coordinateMode`),'screen');assert.equal(e.run('ENGINE.clones.at(-1).coordinateMode'),'screen');assert.equal(e.run(`spriteCanvasPosition(ENGINE.sprites['Screen HUD']).x`),10);assert.equal(e.run('resolveValue(screenWidth())'),180);assert.equal(e.run('resolveValue(canvasWidth())'),540);
    e.sandbox.innerWidth=1440;e.run('resizeGame()');assert.equal(e.run('ENGINE.baseViewWidth'),720);assert.equal(e.run('ENGINE.width'),540);assert.equal(e.run('ENGINE.camera.x'),100);assert.equal(e.run('ENGINE.camera.zoom'),3);
});
test('screen anchors share pixel hit testing and solid motion on a cropped portrait viewport',async()=>{
    const e=engine({logicalWidth:540,innerWidth:360,innerHeight:720});await e.settle(e.run(`executeBlocks([uiBox('A',0,0,10,10),uiBox('Wall',0,0,10,30),coordinatePlane('A','left','top'),coordinatePlane('Wall','left','top'),spriteCoordinateMode('A','screen'),spriteCoordinateMode('Wall','screen'),moveTo('A',10,20),moveTo('Wall',40,10),cameraTo(500,600),cameraZoom(3),spriteSolid('A',true),spriteCollisionTargets('A',['Wall']),moveBy('A',100,0)],createScriptContext())`));assert.ok(Math.abs(e.run('ENGINE.sprites.A.x')-30)<1e-5);e.run('getMousePosition({clientX:60,clientY:40})');assert.equal(e.run(`resolveValue(touchingMouse('A'))`),true);assert.equal(e.run(`resolveValue(touchingSprite('A','Wall'))`),false);assert.equal(e.run('ENGINE.errors.length'),0);
});

test('sprite rendering uses display/device resolution independently of declared canvas pixels',async()=>{
    const e=engine({logicalWidth:540,innerWidth:1080,innerHeight:720,devicePixelRatio:2});assert.equal(e.run('canvas.width'),2160);assert.equal(e.run('canvas.height'),1440);assert.equal(e.run('ENGINE.baseUnitScale'),4);
    await e.settle(e.run(`executeBlocks([uiBox('HUD',0,0,80,30),coordinatePlane('HUD','right','bottom'),spriteCoordinateMode('HUD','screen'),moveTo('HUD',10,12),cameraZoom(3)],createScriptContext())`));
    const before=e.run(`JSON.stringify(spriteCanvasPosition(ENGINE.sprites.HUD))`);e.run('const drawSizes=[];ctx.drawImage=(_image,_x,_y,w,h)=>drawSizes.push([w,h]);render()');assert.equal(e.run('drawSizes.at(-1)[0]'),320);
    await e.settle(e.run(`executeBlock(canvasSize(1080,720),createScriptContext())`));assert.equal(e.run('canvas.width'),2160);assert.equal(e.run('canvas.height'),1440);assert.equal(e.run('ENGINE.baseUnitScale'),2);
    e.sandbox.devicePixelRatio=4;e.run('resizeGame()');assert.equal(e.run('canvas.width'),4320);assert.equal(e.run('canvas.height'),2880);assert.equal(e.run('ENGINE.width'),1080);assert.equal(e.run('ctx.imageSmoothingEnabled'),false);
});

test('screen HUD anchor margins are bounded by both visible screen and declared canvas on every side',async()=>{
    const e=engine({logicalWidth:540,innerWidth:1080,innerHeight:720});await e.settle(e.run(`executeBlocks([uiBox('HUD',0,0,40,20),spriteCoordinateMode('HUD','screen'),moveTo('HUD',10,12),uiSetRotation('HUD',35),uiSetScale('HUD',1.5),cameraTo(800,-500),cameraZoom(3)],createScriptContext())`));
    for(const width of [360,1080,1440,1920]){
        e.sandbox.innerWidth=width;e.run('resizeGame()');
        for(const horizontal of ['left','right'])for(const vertical of ['top','bottom']){
            await e.settle(e.run(`executeBlock(coordinatePlane('HUD','${horizontal}','${vertical}'),createScriptContext())`));
            assert.ok(e.run(`(()=>{const s=ENGINE.sprites.HUD,p=spriteCanvasPosition(s),half=spriteCanvasHalfExtents(s),visible=ENGINE.baseViewWidth,anchorWidth=Math.min(visible,540),left=(visible-anchorWidth)/2;return Math.abs((${JSON.stringify(horizontal)}==='right'?left+anchorWidth-p.x:p.x-left)-10)<1e-8&&Math.abs((${JSON.stringify(vertical)}==='bottom'?360-p.y:p.y)-12)<1e-8;})()`));
            assert.ok(e.run(`(()=>{const s=ENGINE.sprites.HUD,p=getSpriteWorldGeometry(s),native=worldPointForSprite(s,p.x,p.y);return Math.abs(native.x-10)<1e-8&&Math.abs(native.y-12)<1e-8;})()`));
        }
    }
    assert.equal(e.run('resolveValue(screenWidth())'),960);assert.equal(e.run('resolveValue(canvasWidth())'),540);assert.equal(e.run('spriteCanvasArea(ENGINE.sprites.HUD).width'),540);assert.equal(e.run('ENGINE.sprites.HUD.coordinateMode'),'screen');
});

test('resizing and rotating image/UI sprites preserves their centers in every coordinate mode and plane',async()=>{
    const e=engine({logicalWidth:540,innerWidth:360,innerHeight:720});
    e.run(`const imageSprite=new Sprite('Image');imageSprite.image={naturalWidth:80,naturalHeight:40};imageSprite.loaded=true;imageSprite.updateSize();ENGINE.sprites.Image=imageSprite;`);
    await e.settle(e.run(`executeBlock(uiBox('UI',0,0,80,40),createScriptContext())`));
    for(const mode of ['world','canvas','screen'])for(const horizontal of ['left','right'])for(const vertical of ['top','bottom'])for(const name of ['Image','UI']){
        await e.settle(e.run(`executeBlocks([coordinatePlane('${name}','${horizontal}','${vertical}'),spriteCoordinateMode('${name}','${mode}'),moveTo('${name}',70,80),spriteSetSize('${name}',1)],createScriptContext())`));
        const before=e.run(`(()=>{const p=getSpriteWorldGeometry(ENGINE.sprites['${name}']);return JSON.stringify({x:p.x,y:p.y});})()`);
        await e.settle(e.run(`executeBlocks([spriteSetSize('${name}',2),turn('${name}',35)],createScriptContext())`));
        assert.equal(e.run(`(()=>{const p=getSpriteWorldGeometry(ENGINE.sprites['${name}']);return JSON.stringify({x:p.x,y:p.y});})()`),before);
        await e.settle(e.run(`executeBlock(spriteSetSize('${name}',.5),createScriptContext())`));assert.equal(e.run(`(()=>{const p=getSpriteWorldGeometry(ENGINE.sprites['${name}']);return JSON.stringify({x:p.x,y:p.y});})()`),before);
    }
});
test('go-to and distance reporters use centers across different sizes and modes',async()=>{
    const e=engine({logicalWidth:540,innerWidth:360,innerHeight:720});await e.settle(e.run(`executeBlocks([uiBox('A',0,0,20,10),uiBox('B',0,0,100,60),coordinatePlane('A','right','bottom'),spriteCoordinateMode('A','screen'),moveTo('A',40,50),cameraTo(200,-100),cameraZoom(2),moveToSprite('B','A')],createScriptContext())`));assert.ok(Math.abs(e.run(`resolveValue(distanceSprite('A','B'))`))<1e-8);assert.ok(Math.abs(e.run(`resolveValue(distanceSprite('B','A'))`))<1e-8);
    await e.settle(e.run(`executeBlocks([spriteSetSize('A',2),spriteSetSize('B',.5)],createScriptContext())`));assert.ok(Math.abs(e.run(`resolveValue(distanceSprite('A','B'))`))<1e-8);
    e.run(`const s=ENGINE.sprites.A,p=spriteCanvasPosition(s),r=canvas.getBoundingClientRect();getMousePosition({clientX:r.left+p.x*ENGINE.displayScale,clientY:r.top+p.y*ENGINE.displayScale});`);assert.ok(Math.abs(e.run(`resolveValue(distanceMouse('A'))`))<1e-8);
    await e.settle(e.run(`executeBlock(moveTo('A',50,50),createScriptContext())`));assert.ok(Math.abs(e.run(`resolveValue(distanceSprite('A','B'))`)-10)<1e-8);
});

test('declared box clipping and screen center offsets share exactly the same logical edges',async()=>{
    const e=engine({logicalWidth:540,innerWidth:2000,innerHeight:720,devicePixelRatio:1.25});await e.settle(e.run(`executeBlocks([uiBox('HUD',0,0,10,10),coordinatePlane('HUD','left','top'),spriteCoordinateMode('HUD','screen'),moveTo('HUD',50,50)],createScriptContext())`));
    e.run('let clipRectangle;ctx.rect=(...values)=>{clipRectangle=values;};render()');assert.ok(e.run(`(()=>{const p=spriteCanvasPosition(ENGINE.sprites.HUD),s=ENGINE.baseUnitScale;return Math.abs(p.x-clipRectangle[0]/s-50)<1e-9&&Math.abs(p.y-clipRectangle[1]/s-50)<1e-9;})()`));assert.equal(e.run('ENGINE.viewWidth'),540);assert.equal(e.run('resolveValue(screenWidth())'),1000);assert.equal(e.run('resolveValue(canvasWidth())'),540);
    e.sandbox.innerWidth=360;e.run('resizeGame();render()');assert.equal(e.run('clipRectangle[0]'),0);assert.equal(e.run('ENGINE.viewWidth'),180);assert.equal(e.run('spriteCanvasPosition(ENGINE.sprites.HUD).x'),50);assert.equal(e.run('spriteCanvasPosition(ENGINE.sprites.HUD).y'),50);
});
test('black bars outside the declared box cannot hit hidden off-box sprites',async()=>{
    const e=engine({logicalWidth:540,innerWidth:2000,innerHeight:720});await e.settle(e.run(`executeBlock(uiBox('Outside',-400,0,40,40),createScriptContext())`));e.run('getMousePosition({clientX:200,clientY:360})');assert.equal(e.run(`resolveValue(touchingMouse('Outside'))`),false);assert.equal(e.run('spriteInCameraView(ENGINE.sprites.Outside)'),false);
});
