import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function engine(overrides={}) {
    const stats={reads:0,resizes:0,draws:0},events=new Map();
    function makeCanvas(){
        const context=new Proxy({
            getImageData(_x,_y,w,h){stats.reads++;if(context._source?.testPixels)return {data:context._source.testPixels.slice()};const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){data[i]=255;data[i+3]=255;}return {data};},
            drawImage(source){context._source=source;stats.draws++;},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},measureText:()=>({width:20}),createLinearGradient:()=>({addColorStop(){}})
        },{get:(target,key)=>key in target?target[key]:()=>{}});
        return {style:{},_width:640,_height:360,get width(){return this._width;},set width(v){stats.resizes++;this._width=v;},get height(){return this._height;},set height(v){stats.resizes++;this._height=v;},getContext:()=>context,addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:640,height:360})};
    }
    const canvas=makeCanvas();
    const sandbox={console:{error(){},warn(){},log(){}},performance:{now:()=>0},setTimeout,clearTimeout,AbortController,
        URLSearchParams,Uint8ClampedArray,CustomEvent:class {constructor(type,{detail}){this.type=type;this.detail=detail;}},
        requestAnimationFrame:()=>1,Image:class {constructor(){this.complete=true;this.naturalWidth=10;this.naturalHeight=10;}set src(v){this.path=v;queueMicrotask(()=>this.onload?.());}addEventListener(){}},
        document:{getElementById:()=>canvas,createElement:makeCanvas,addEventListener(){}},
        addEventListener(type,fn){events.set(type,fn);},dispatchEvent(){},innerWidth:640,innerHeight:360,devicePixelRatio:1,...overrides};
    sandbox.window=sandbox;
    const context=vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(new URL('../JScratch/js/vendor/gifuct.js',import.meta.url),'utf8'),context);
    for(const file of ['back-process','media','ui','data','json','canvas','sensing','control','sprite','sound','motion','operator','clone'])
        vm.runInContext(fs.readFileSync(new URL(`../JScratch/js/${file}.js`,import.meta.url),'utf8'),context,{filename:file+'.js'});
    const run=source=>vm.runInContext(source,context);
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

test('World uses c1 costume and supports normalized WASD/arrow movement within the stage',async()=>{
    const e=engine();e.run(fs.readFileSync(new URL('../JScratch/program/world.js',import.meta.url),'utf8'));
    e.run('broadcastMessage("World")');await e.flush();for(let i=0;i<25;i++)await e.tick();
    assert.equal(e.run('ENGINE.sprites.Player.costume'),'/images/character_art/pixel_art/c1_costume/costume1_idle1.gif');assert.equal(e.run('Object.keys(ENGINE.sprites).length'),1);
    e.run(`SENSING.keys={d:true}`);for(let i=0;i<10;i++)await e.tick();const straight=e.run('ENGINE.sprites.Player.x');assert.ok(straight>0);
    e.run(`ENGINE.sprites.Player.x=0;ENGINE.sprites.Player.y=0;SENSING.keys={w:true,d:true}`);for(let i=0;i<10;i++)await e.tick();const diagonal=e.run('Math.hypot(ENGINE.sprites.Player.x,ENGINE.sprites.Player.y)');assert.ok(Math.abs(straight-diagonal)<.001);
    e.run(`SENSING.keys={a:true,d:true,w:true,s:true}`);const x=e.run('ENGINE.sprites.Player.x'),y=e.run('ENGINE.sprites.Player.y');for(let i=0;i<5;i++)await e.tick();assert.equal(e.run('ENGINE.sprites.Player.x'),x);assert.equal(e.run('ENGINE.sprites.Player.y'),y);
    e.run(`SENSING.keys={arrowleft:true,arrowdown:true}`);for(let i=0;i<10;i++)await e.tick();assert.ok(e.run('ENGINE.sprites.Player.x')<x);assert.ok(e.run('ENGINE.sprites.Player.y')<y);
    e.run(`SENSING.keys={arrowright:true}`);for(let i=0;i<150;i++)await e.tick();assert.ok(e.run('ENGINE.sprites.Player.x+ENGINE.sprites.Player.width/2<=ENGINE.width/2'));
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
