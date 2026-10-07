// back-process.js

const ENGINE={
    width:640,height:360,centerX:0,centerY:0,viewWidth:640,viewHeight:360,unitScale:1,
    background:"#000000",backgroundImage:null,backgroundLoaded:false,backgroundScale:1,backgroundCostume:"",
    backgroundEffects:{brightness:0,ghost:0,color:0},sprites:{},clones:[],sounds:{},variables:{},
    running:true,lastTime:0,deltaTime:0,camera:{x:0,y:0},scripts:[],program:[],broadcasts:{},blocks:{},
    mobile:false,buildingBlock:false,_blockId:0,audioContext:null,audioUnlocked:false,audioPending:[],
    masterGain:null,backgroundEffectCanvas:null,backgroundEffectCacheKey:null,fps:60,frameInterval:1000/60,
    lastRender:0,spriteOrderDirty:true,spriteOrder:[],resizeCanvas:null,resizeFrame:null,cloneId:0
};

const canvas=document.getElementById("game-canvas"),ctx=canvas.getContext("2d",{alpha:false});
ctx.imageSmoothingEnabled=true;
ctx.imageSmoothingQuality="high";
canvas.style.touchAction="none";
canvas.style.userSelect=canvas.style.webkitUserSelect="none";
canvas.addEventListener("wheel",event=>{if(event.ctrlKey)event.preventDefault();},{passive:false});
canvas.addEventListener("touchmove",event=>{if(event.touches.length>1)event.preventDefault();},{passive:false});

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const frame=c=>runtimeWait(0,c,true);


/* VALUES / BLOCKS */

function resolveValue(v,c=null){
    if(v==null)return"";
    if(typeof v!=="object")return v;
    switch(v.type){
        case"variable":
            return ENGINE.variables[String(resolveValue(v.name,c))]??"";
        case"privateVariable":
            return c?.privateVariables?.[String(resolveValue(v.name,c))]??"";
        case"spriteVariable":{
            const s=getContextSprite(v.spriteName,c);
            return s?.variables?.[String(resolveValue(v.varName,c))]??"";
        }
        case"cloneVariable":{
            const clone=c?.clone;
            return clone?.isClone?clone.variables?.[String(resolveValue(v.varName,c))]??"":"";
        }
        case"cloneName":
            return c?.clone?.isClone?c.clone.cloneName:"";
        case"cloneId":
            return c?.clone?.isClone?c.clone.cloneId:"";
        case"join":
            return(v.values||[]).map(x=>resolveValue(x,c)).join("");
        case"value":
            return resolveValue(v.value,c);
        case"operator":{
            const b=ENGINE.blocks[v.operator];
            return b?.reporter?b.reporter(v,c):typeof v.evaluate==="function"?v.evaluate(c):"";
        }
    }
    return v;
}

function resolveSpriteName(name,c=null){
    const v=resolveValue(name,c),n=String(v??"");
    if(c?.clone?.isClone){
        if(n.trim().toLowerCase()==="self")return c.clone;
        if(n===c.clone.cloneName)return c.clone;
    }
    return n;
}

function getContextSprite(name,c=null){
    const target=resolveSpriteName(name,c);
    if(target?.isClone)return target;
    return ENGINE.sprites[target]||null;
}

function getAllSprites(){
    return[
        ...Object.values(ENGINE.sprites),
        ...ENGINE.clones.filter(c=>!c.deleted)
    ];
}

function getSprites(){
    ENGINE.clones=ENGINE.clones.filter(c=>!c.deleted);
    return getAllSprites()
        .filter(s=>s.visible&&!s.deleted)
        .map(s=>s.isClone?s.cloneIdName:s.name);
}

function getFreeCloneId(){
    const used=new Set(ENGINE.clones.filter(c=>!c.deleted).map(c=>c.cloneId));
    let id=1;
    while(used.has(id))id++;
    ENGINE.cloneId=Math.max(ENGINE.cloneId,id);
    return id;
}

function registerBlock(type,handler,options={}){
    if(type)ENGINE.blocks[type]={
        execute:typeof handler==="function"?handler:null,
        reporter:typeof options.reporter==="function"?options.reporter:null
    };
}

const registerReporter=(type,fn)=>registerBlock(type,null,{reporter:fn});

function createBlock(type,data={}){
    return{type,_id:++ENGINE._blockId,_handled:false,...data};
}

const createReporter=(type,data={})=>({type:"operator",operator:type,...data});


/* PROGRAM */

const programMembership=new Set(),removedProgramBlocks=new Set();
let trackedProgram=ENGINE.program;
function syncProgramMembership(){if(trackedProgram!==ENGINE.program){trackedProgram=ENGINE.program;programMembership.clear();removedProgramBlocks.clear();for(const block of ENGINE.program)programMembership.add(block);}}
ENGINE.recordBlock=b=>{
    syncProgramMembership();
    if(b&&typeof b==="object"&&!programMembership.has(b)){programMembership.add(b);ENGINE.program.push(b);}
    removedProgramBlocks.delete(b);return b;
};
ENGINE.removeTopLevelBlock=b=>{if(programMembership.has(b))removedProgramBlocks.add(b);};
function compactProgram(){if(removedProgramBlocks.size){ENGINE.program=ENGINE.program.filter(b=>!removedProgramBlocks.has(b));removedProgramBlocks.forEach(b=>programMembership.delete(b));removedProgramBlocks.clear();trackedProgram=ENGINE.program;}}
ENGINE.absorbBlocks=bs=>{if(Array.isArray(bs))bs.forEach(ENGINE.absorbBlock);while(removedProgramBlocks.has(ENGINE.program.at(-1))){const block=ENGINE.program.pop();removedProgramBlocks.delete(block);programMembership.delete(block);}};
ENGINE.absorbBlock=b=>{if(!b||typeof b!=="object")return;ENGINE.removeTopLevelBlock(b);absorbNested(b);};
function absorbNested(b){
    const pending=[b],visited=new Set();
    while(pending.length){const item=pending.pop();if(!item||typeof item!=="object"||visited.has(item))continue;visited.add(item);
        for(const value of Object.values(item)){const children=Array.isArray(value)?value:[value];for(const child of children)if(child?.type){ENGINE.removeTopLevelBlock(child);pending.push(child);}}
    }
}

function markBlockTreeHandled(b){
    if(!b||typeof b!=="object")return;
    b._handled=true;
    for(const v of Object.values(b))
        Array.isArray(v)?v.forEach(markBlockTreeHandled):v?.type&&markBlockTreeHandled(v);
}


/* AUDIO */

function initAudio(){
    if(ENGINE.audioContext)return ENGINE.audioContext;
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return null;
    try{
        const ac=ENGINE.audioContext=new C();
        ENGINE.audioUnlocked=ac.state==="running";
        ENGINE.masterGain=ac.createGain();
        ENGINE.masterGain.connect(ac.destination);
        return ac;
    }catch(e){
        console.warn("Could not initialize audio:",e);
        return null;
    }
}

async function unlockAudio(){
    const ac=initAudio();
    if(!ac)return;
    try{
        if(ac.state!=="running")await ac.resume();
        ENGINE.audioUnlocked=ac.state==="running";
        if(ENGINE.audioUnlocked)flushPendingSounds();
    }catch(e){console.warn("Could not unlock audio:",e);}
}

function flushPendingSounds(){
    const p=ENGINE.audioPending.splice(0);
    p.forEach(x=>playSoundInternal(x.sound));
}

["pointerdown","touchstart","mousedown","keydown"].forEach(e=>
    document.addEventListener(e,unlockAudio,{passive:true})
);

async function loadSoundBuffer(sound){
    const ac=ENGINE.audioContext;if(!ac||!sound?.path)return null;
    if(sound.buffer&&sound.bufferPath===sound.path)return sound.buffer;
    const path=sound.path;if(sound.loadingPath===path&&sound.loading)return sound.loading;
    sound.loadingPath=path;
    const loading=(async()=>{try{const response=await fetch(path);if(!response.ok)throw Error(`HTTP ${response.status}`);const buffer=await ac.decodeAudioData(await response.arrayBuffer());if(sound.path===path){sound.buffer=buffer;sound.bufferPath=path;}return buffer;}catch(error){console.warn('Could not load sound:',sound.name,path,error);return null;}})();
    sound.loading=loading;try{return await loading;}finally{if(sound.loading===loading){sound.loading=null;sound.loadingPath='';}}
}

function removeSoundInstance(sound,instance){
    const i=sound.instances.indexOf(instance);
    if(i>=0)sound.instances.splice(i,1);
}

function disconnectSound(instance){
    try{
        instance.source.disconnect();
        instance.gain.disconnect();
        instance.panner.disconnect();
    }catch{}
}

async function playSoundInternal(sound){
    const runId=ENGINE.runId;
    const ac=initAudio();
    if(!ac)return;
    if(ac.state!=="running"){
        ENGINE.audioPending.push({sound});
        return;
    }
    const buffer=await loadSoundBuffer(sound);
    if(runId!==ENGINE.runId||!ENGINE.running)return;
    if(!buffer||!ENGINE.running)return;
    const source=ac.createBufferSource(),gain=ac.createGain(),panner=ac.createStereoPanner();
    source.buffer=buffer;
    source.detune.value=clamp(Number(sound.pitch)||0,-100,100)*12;
    source.playbackRate.value=Math.max(0,Number(sound.speed)||100)/100;
    gain.gain.value=clamp(Number(sound.volume)||0,0,100)/100;
    panner.pan.value=clamp(Number(sound.pan)||0,-100,100)/100;
    source.connect(gain);
    gain.connect(panner);
    panner.connect(ENGINE.masterGain);
    const instance={source,gain,panner,stopped:false};
    sound.instances.push(instance);
    const cleanup=()=>{
        if(instance.stopped)return;
        instance.stopped=true;
        removeSoundInstance(sound,instance);
        disconnectSound(instance);
    };
    source.onended=cleanup;
    try{source.start()}catch(e){
        cleanup();
        console.warn("Could not play sound:",sound.name,e);
    }
}

function stopSoundInstance(instance){
    if(!instance||instance.stopped)return;
    instance.stopped=true;
    try{instance.source.stop()}catch{}
    disconnectSound(instance);
}


/* COLOR / EFFECTS */

function rgbToHsl(r,g,b){
    r/=255;g/=255;b/=255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
    if(max===min)return[0,0,l];
    const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);
    let h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;
    return[h/6,s,l];
}

function hueToRgb(p,q,t){
    if(t<0)t++;
    if(t>1)t--;
    return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;
}

function hslToRgb(h,s,l){
    if(!s)return[l*255,l*255,l*255];
    const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
    return[
        Math.round(hueToRgb(p,q,h+1/3)*255),
        Math.round(hueToRgb(p,q,h)*255),
        Math.round(hueToRgb(p,q,h-1/3)*255)
    ];
}

function applyImageEffects(image,effects,cache,getKey,setKey,key){
    if(!image?.naturalWidth)return null;

    const br=clamp(Number(effects.brightness)||0,-100,100);
    const color=clamp(Number(effects.color)||0,0,100);
    const ghost=clamp(Number(effects.ghost)||0,0,100);

    if(!br&&!color)return{source:image,ghost};

    const w=Math.max(1,Math.ceil(image.naturalWidth));
    const h=Math.max(1,Math.ceil(image.naturalHeight));

    if(cache.width!==w||cache.height!==h){
        cache.width=w;
        cache.height=h;
        setKey(null);
    }

    const cacheKey=`${key}|${w}|${h}|${br}|${color}`;
    if(getKey()===cacheKey)return{source:cache,ghost};

    const c=cache.getContext("2d",{willReadFrequently:true});
    c.clearRect(0,0,w,h);
    c.drawImage(image,0,0,w,h);

    let img;
    try{img=c.getImageData(0,0,w,h)}
    catch{
        setKey(null);
        return{source:image,ghost};
    }

    const d=img.data;
    const m=1+br/100;
    const hs=color/100;

    for(let i=0;i<d.length;i+=4){
        if(!d[i+3])continue;

        let r=d[i],g=d[i+1],b=d[i+2];

        if(br!==0){
            r=clamp(Math.round(r*m),0,255);
            g=clamp(Math.round(g*m),0,255);
            b=clamp(Math.round(b*m),0,255);
        }

        if(color){
            const hsl=rgbToHsl(r,g,b);
            [r,g,b]=hslToRgb((hsl[0]+hs)%1,hsl[1],hsl[2]);
        }

        d[i]=r;
        d[i+1]=g;
        d[i+2]=b;
    }

    c.putImageData(img,0,0);
    setKey(cacheKey);
    return{source:cache,ghost};
}

function createEffectCanvas(sprite){
    const c=sprite.effectCanvas||=document.createElement("canvas");
    const w=Math.max(1,Math.ceil(sprite.width)),h=Math.max(1,Math.ceil(sprite.height));

    if(c.width!==w||c.height!==h){
        c.width=w;
        c.height=h;
        sprite.effectCacheKey=null;
    }

    return c;
}

function applySpriteEffects(sprite){
    const c=createEffectCanvas(sprite);

    return applyImageEffects(
        sprite.image,sprite.effects||{},c,
        ()=>sprite.effectCacheKey,
        v=>sprite.effectCacheKey=v,
        `${sprite.costume}|${sprite.width}|${sprite.height}`
    );
}

function applyCanvasEffects(){
    const image=ENGINE.backgroundImage;
    if(!image?.naturalWidth)return null;

    const c=ENGINE.backgroundEffectCanvas||=document.createElement("canvas");

    return applyImageEffects(
        image,ENGINE.backgroundEffects||{},c,
        ()=>ENGINE.backgroundEffectCacheKey,
        v=>ENGINE.backgroundEffectCacheKey=v,
        ENGINE.backgroundCostume
    );
}


/* SPRITE */

class Sprite{
    constructor(name,clone=false){
        const cloneId=clone?getFreeCloneId():0;
        Object.assign(this,{
            name,x:0,y:0,visible:true,costume:null,image:null,scale:1,width:160,height:160,
            loaded:false,opacity:1,rotation:0,flipX:1,flipY:1,
            effects:{brightness:0,ghost:0,color:0},layer:0,variables:{},
            privateVariables:Object.create(null),velocityX:0,velocityY:0,edgeLock:null,
            imageCache:{},costumeCacheOrder:[],effectCanvas:null,effectCacheKey:null,
            touchable:true,isClone:clone,cloneName:clone?name:"",cloneId,
            cloneIdName:clone?`${name}#${cloneId}`:"",cloneOf:clone?name:null,
            cloneContext:null,deleted:false
        });
    }

    setCostume(path,scale=1){
        path=String(path??"");
        scale=Number(scale);
        if(!Number.isFinite(scale)||scale<=0)scale=1;

        if(!path){
            this.costume="";
            this.image=null;
            this.loaded=false;
            this.effectCacheKey=null;
            return;
        }

        this.costume=path;
        this.scale=scale;
        this.effectCacheKey=null;

        const cached=this.imageCache[path];

        if(cached){
            this.image=cached;
            this.loaded=cached.complete&&cached.naturalWidth>0;

            if(this.loaded){
                this.updateSize();
                updateEdgeSprite(this);
            }

            return;
        }

        const asset=loadImageAsset(path),image=asset.image;
        this.imageCache[path]=image;
        this.costumeCacheOrder.push(path);
        if(this.costumeCacheOrder.length>4){const old=this.costumeCacheOrder.shift();if(old!==path)delete this.imageCache[old];}
        this.image=image;this.loaded=image.complete&&image.naturalWidth>0;
        if(this.loaded){this.updateSize();updateEdgeSprite(this);}
        asset.ready.then(()=>{
            if(this.image===image&&this.costume===path){this.loaded=true;this.effectCacheKey=null;this.updateSize();updateEdgeSprite(this);}
        }).catch(()=>console.warn("Could not load costume:",path));
    }

    updateSize(){
        if(!this.image?.naturalWidth)return;

        const width=160*this.scale;
        const height=width*this.image.naturalHeight/this.image.naturalWidth;

        /*
         * x/y are always the sprite CENTER.
         * Width and height change around that center.
         * No position correction is performed here.
         */
        this.width=width;
        this.height=height;
        this.effectCacheKey=null;
    }

    setScale(scale){
        scale=Number(scale);
        if(!Number.isFinite(scale)||scale<=0)scale=1;

        /*
         * Preserve the exact center while resizing.
         */
        const x=this.x,y=this.y;

        this.scale=scale;
        this.updateSize();

        this.x=x;
        this.y=y;
        this.effectCacheKey=null;
    }

    draw(){
        if(this.deleted||!this.visible||!this.image)return;

        if(!this.loaded&&this.image.naturalWidth>0){
            this.loaded=true;
            this.updateSize();
        }

        if(!this.loaded)return;

        const effect=applySpriteEffects(this);
        if(!effect)return;

        const s=ENGINE.unitScale;

        ctx.save();
        ctx.globalAlpha=clamp(Number(this.opacity)||0,0,1)*(1-effect.ghost/100);

        /*
         * x/y are the exact visual center of the costume.
         * The costume expands equally in every direction.
         */
        ctx.translate(
            (this.x-ENGINE.camera.x)*s+canvas.width/2,
            -(this.y-ENGINE.camera.y)*s+canvas.height/2
        );

        ctx.rotate(this.rotation*Math.PI/180);
        ctx.scale(this.flipX,this.flipY);

        ctx.drawImage(
            effect.source,
            -this.width*s/2,
            -this.height*s/2,
            this.width*s,
            this.height*s
        );

        ctx.restore();
    }
}


/* SPRITE EDGE LOCKING */

function updateEdgeSprite(sprite){
    if(!sprite?.edgeLock||sprite.deleted)return;

    const lock=sprite.edgeLock;
    if(lock.mobile&&!ENGINE.mobile)return;

    const cx=ENGINE.camera.x,cy=ENGINE.camera.y;

    const canvasHalfWidth=ENGINE.width/2;
    const canvasHalfHeight=ENGINE.height/2;

    const canvasLeft=cx-canvasHalfWidth;
    const canvasRight=cx+canvasHalfWidth;
    const canvasBottom=cy-canvasHalfHeight;
    const canvasTop=cy+canvasHalfHeight;

    const viewHalfWidth=ENGINE.viewWidth/2;
    const viewHalfHeight=ENGINE.viewHeight/2;

    const screenLeft=cx-viewHalfWidth;
    const screenRight=cx+viewHalfWidth;
    const screenBottom=cy-viewHalfHeight;
    const screenTop=cy+viewHalfHeight;

    const left=Math.max(canvasLeft,screenLeft);
    const right=Math.min(canvasRight,screenRight);
    const bottom=Math.max(canvasBottom,screenBottom);
    const top=Math.min(canvasTop,screenTop);

    if(lock.horizontal==="left")
        sprite.x=left+lock.horizontalDistance;
    else if(lock.horizontal==="right")
        sprite.x=right-lock.horizontalDistance;

    if(lock.vertical==="top")
        sprite.y=top-lock.verticalDistance;
    else if(lock.vertical==="bottom")
        sprite.y=bottom+lock.verticalDistance;

    if(!lock.horizontal){
        const hw=Math.max(0,sprite.width/2);
        const minX=left+hw,maxX=right-hw;
        if(minX<=maxX)sprite.x=clamp(sprite.x,minX,maxX);
        else sprite.x=cx;
    }

    if(!lock.vertical){
        const hh=Math.max(0,sprite.height/2);
        const minY=bottom+hh,maxY=top-hh;
        if(minY<=maxY)sprite.y=clamp(sprite.y,minY,maxY);
        else sprite.y=cy;
    }
}

function updateEdgeSprites(){
    getAllSprites().forEach(updateEdgeSprite);
}


/* BROADCASTS */

function createScriptContext(clone=null){
    return{
        ended:false,runId:ENGINE.runId,
        clone:clone||null,
        privateVariables:clone?.privateVariables||Object.create(null)
    };
}

function registerBroadcast(message,blocks){
    const key=String(resolveValue(message)),script={
        blocks:Array.isArray(blocks)?blocks:[],
        registered:true
    };

    ENGINE.broadcasts[key]??=[];
    ENGINE.absorbBlocks(script.blocks);
    ENGINE.broadcasts[key].push(script);

    return script;
}

function broadcastMessage(message){
    const listeners=ENGINE.broadcasts[String(resolveValue(message))];
    if(!listeners?.length)return;

    for(const{blocks}of listeners)
        Promise.resolve()
            .then(()=>executeBlocks(blocks,createScriptContext()))
            .catch(e=>console.error("Broadcast script error:",e));
}

async function broadcastAndWaitMessage(message){
    const listeners=ENGINE.broadcasts[String(resolveValue(message))];

    if(listeners?.length)
        await Promise.all(listeners.map(({blocks})=>
            executeBlocks(blocks,createScriptContext())
        ));
}


/* EXECUTION */

async function executeBlock(block,context){
    if(!block||typeof block!=="object"||!contextActive(context))return;
    await executionTurn(context);
    while(contextActive(context)&&ENGINE.paused&&ENGINE.stepBudget===0)await executionTurn(context);
    if(!contextActive(context))return;

    if(block.type==="endScript"){
        context.ended=true;
        return;
    }

    const handler=ENGINE.blocks[block.type]?.execute;
    if(!handler){reportRuntimeError(new Error("Unknown block type: "+block.type),block,context);context.ended=true;return;}
    const container=Array.isArray(block.blocks)||Array.isArray(block.thenBlocks);
    if(ENGINE.paused&&ENGINE.stepBudget>0&&!container)ENGINE.stepBudget--;
    ENGINE.lastBlock=block;ENGINE.executedBlocks++;
    try{await handler(block,context);}catch(error){reportRuntimeError(error,block,context);context.ended=true;}


}

async function executeBlocks(blocks,context){
    if(!Array.isArray(blocks))return;

    for(const block of blocks){
        if(!contextActive(context))break;
        await executeBlock(block,context);
    }
}


/* CONTROL */

registerBlock("repeat",async(b,c)=>{
    const n=Math.max(0,Math.floor(Number(resolveValue(b.times,c))||0));

    for(let i=0;i<n&&contextActive(c);i++){
        await executionTurn(c);
        if(contextActive(c))await executeBlocks(b.blocks,c);
    }
});

registerBlock("forever",async(b,c)=>{
    while(contextActive(c)){
        await executeBlocks(b.blocks,c);
        await frame(c);
    }
});

registerBlock("if",async(b,c)=>{
    await executeBlocks(
        resolveValue(b.condition,c)?b.thenBlocks:b.elseBlocks,
        c
    );
});

async function conditionalLoop(b,c,test,yieldFn){
    while(contextActive(c)&&test(b,c)){
        await executeBlocks(b.blocks,c);
        await yieldFn(c);
    }
}

registerBlock("repeatUntil",(b,c)=>
    conditionalLoop(b,c,(b,c)=>!resolveValue(b.condition,c),frame)
);

registerBlock("while",(b,c)=>
    conditionalLoop(b,c,(b,c)=>!!resolveValue(b.condition,c),frame)
);

registerBlock("wait",async(b,c)=>
    runtimeWait(Math.max(0,Number(resolveValue(b.time,c))||0)*1000,c)
);

registerBlock("waitUntil",(b,c)=>
    conditionalLoop(
        b,c,
        (b,c)=>!resolveValue(b.condition,c),
        c=>runtimeWait(16,c)
    )
);

registerBlock("broadcast",(b,c)=>
    broadcastMessage(resolveValue(b.message,c))
);

registerBlock("broadcastWait",(b,c)=>
    broadcastAndWaitMessage(resolveValue(b.message,c))
);

registerBlock("broadcastScript",(b,c)=>
    executeBlocks(b.blocks,c)
);


/* PROGRAM */

const START_DELAY=200;

async function executeProgram(){
    compactProgram();
    const c=createScriptContext();
    ENGINE.scripts=ENGINE.program.slice();

    try{
        await executeBlocks(ENGINE.program,c)
    }catch(e){
        console.error("Main program error:",e)
    }
}

async function runScripts(){
    await delay(START_DELAY);
    if(ENGINE.running&&ENGINE.runId===0)await startRuntime();
}


/* CANVAS */

function getViewHeight(width){
    return 360-54*clamp((1000-width)/500,0,1);
}

function resizeGame(){
    const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);

    ENGINE.mobile=w<700;

    const pixelRatio=Math.min(3,window.devicePixelRatio||1);
    const pw=Math.ceil(w*pixelRatio),ph=Math.ceil(h*pixelRatio);

    canvas.style.width=w+"px";
    canvas.style.height=h+"px";

    if(canvas.width!==pw||canvas.height!==ph){
        canvas.width=pw;
        canvas.height=ph;
    }

    ENGINE.viewHeight=getViewHeight(w);
    ENGINE.unitScale=h*pixelRatio/ENGINE.viewHeight;
    ENGINE.viewWidth=w*pixelRatio/ENGINE.unitScale;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ENGINE.centerX=ENGINE.centerY=0;

    updateEdgeSprites();
}

function requestResize(){
    if(ENGINE.resizeFrame)return;

    ENGINE.resizeFrame=requestAnimationFrame(()=>{
        ENGINE.resizeFrame=null;
        resizeGame();
    });
}

function drawBackground(){
    const image=ENGINE.backgroundImage;

    if(!ENGINE.backgroundLoaded||!image){
        ctx.fillStyle=ENGINE.background;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        return;
    }

    const unit=ENGINE.unitScale;
    const width=640*(Number(ENGINE.backgroundScale)||1);
    const height=width*image.naturalHeight/image.naturalWidth;
    const effect=applyCanvasEffects();

    if(!effect)return;

    ctx.globalAlpha=1-effect.ghost/100;

    ctx.drawImage(
        effect.source,
        canvas.width/2-width*unit/2,
        canvas.height/2-height*unit/2,
        width*unit,
        height*unit
    );
}

function updateSpriteOrder(){
    if(!ENGINE.spriteOrderDirty)return;

    ENGINE.spriteOrder=getAllSprites().filter(s=>!s.deleted);

    ENGINE.spriteOrder.sort((a,b)=>
        a.layer-b.layer||
        a.isClone-b.isClone||
        a.cloneId-b.cloneId
    );

    ENGINE.spriteOrderDirty=false;
}

function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha=1;

    drawBackground();
    updateEdgeSprites();
    updateSpriteOrder();

    ENGINE.spriteOrder.forEach(sprite=>sprite.draw());

    ctx.globalAlpha=1;
}

Object.assign(ENGINE,{runId:0,paused:false,clock:0,frameNumber:0,stepBudget:0,executedBlocks:0,lastBlock:null,errors:[],waiters:new Set(),budgetStarted:0,budgetBlocks:0,loopHandle:null,maxClones:10000});
// Shared decoded images avoid repeated loading for sprites and clones.
const imageAssets=new Map();
function loadImageAsset(path){
    if(imageAssets.has(path)){const asset=imageAssets.get(path);imageAssets.delete(path);imageAssets.set(path,asset);return asset;}
    const image=new Image();
    const ready=new Promise((resolve,reject)=>{image.onload=()=>resolve(image);image.onerror=()=>{imageAssets.delete(path);reject(new Error('Could not load image: '+path));};});
    const asset={image,ready};imageAssets.set(path,asset);image.src=path;
    while(imageAssets.size>128)imageAssets.delete(imageAssets.keys().next().value);
    return asset;
}
async function preloadAssets(paths){
    const queue=[...new Set(paths)].filter(path=>typeof path==='string'&&path),results=[];
    let index=0;
    await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(index<queue.length){const path=queue[index++];try{await loadImageAsset(path).ready;results.push({path,loaded:true});}catch(error){results.push({path,loaded:false,error:error.message});}}}));
    return results;
}
function contextActive(c){return ENGINE.running&&!c?.ended&&(c?.runId===undefined||c.runId===ENGINE.runId)&&!c?.clone?.deleted;}
function runtimeWait(ms,c,nextFrame=false){
    if(!contextActive(c))return Promise.resolve();
    return new Promise(resolve=>ENGINE.waiters.add({resolve,c,deadline:ENGINE.clock+Math.max(0,ms),frame:ENGINE.frameNumber+(nextFrame?1:0),gate:false}));
}
async function executionTurn(c){
    if(ENGINE.paused&&ENGINE.stepBudget===0)await new Promise(resolve=>ENGINE.waiters.add({resolve,c,gate:true}));
    if(!contextActive(c))return;
    if(++ENGINE.budgetBlocks>=500||performance.now()-ENGINE.budgetStarted>=6)await runtimeWait(0,c,true);
}
function reportRuntimeError(error,block,c){
    const entry={message:error?.message||String(error),blockId:block?._id,blockType:block?.type,script:c?.scriptName||'Main program'};
    ENGINE.errors.push(entry);if(ENGINE.errors.length>100)ENGINE.errors.shift();
    window.dispatchEvent(new CustomEvent('mlgame-error',{detail:entry}));console.error(entry.script+': '+entry.message);
}
function stopRuntime(){
    ENGINE.running=false;ENGINE.paused=false;ENGINE.stepBudget=0;ENGINE.runId++;if(ENGINE.audioPaused){ENGINE.audioPaused=false;ENGINE.audioContext?.resume().catch(()=>{});}
    for(const waiter of ENGINE.waiters)waiter.resolve();ENGINE.waiters.clear();
    ENGINE.audioPending.length=0;for(const sound of Object.values(ENGINE.sounds))for(const instance of [...(sound.instances||[])])stopSoundInstance(instance);
    window.dispatchEvent(new CustomEvent('mlgame-state',{detail:'stopped'}));
}
function resetRuntime(){
    if(typeof ML_UI!=='undefined'){ML_UI.elements={};ML_UI.order=[];ML_UI.nextId=1;}
    if(typeof SENSING!=='undefined'){SENSING.keys={};SENSING.leftClick=false;SENSING.rightClick=false;}
    ENGINE.variables={};ENGINE.sprites={};ENGINE.clones=[];ENGINE.sounds={};ENGINE.spriteOrder=[];ENGINE.spriteOrderDirty=true;ENGINE.cloneId=0;
    ENGINE.background='#000000';ENGINE.backgroundImage=null;ENGINE.backgroundLoaded=false;ENGINE.backgroundScale=1;ENGINE.backgroundCostume='';ENGINE.backgroundEffects={brightness:0,ghost:0,color:0};ENGINE.backgroundEffectCacheKey=null;ENGINE.camera={x:0,y:0};
}
async function startRuntime(){
    stopRuntime();resetRuntime();ENGINE.running=true;ENGINE.clock=0;ENGINE.executedBlocks=0;ENGINE.errors=[];ENGINE.lastBlock=null;ENGINE.lastTime=0;ENGINE.budgetStarted=performance.now();ENGINE.budgetBlocks=0;
    if(ENGINE.loopHandle===null)ENGINE.loopHandle=requestAnimationFrame(gameLoop);
    window.dispatchEvent(new CustomEvent('mlgame-state',{detail:'running'}));return executeProgram();
}
function pauseRuntime(){if(ENGINE.running){ENGINE.paused=true;if(ENGINE.audioContext?.state==='running'){ENGINE.audioPaused=true;ENGINE.audioContext.suspend().catch(error=>console.warn('Could not pause audio:',error));}window.dispatchEvent(new CustomEvent('mlgame-state',{detail:'paused'}));}}
function resumeRuntime(){if(ENGINE.running){ENGINE.paused=false;if(ENGINE.audioPaused){ENGINE.audioPaused=false;ENGINE.audioContext?.resume().catch(error=>console.warn('Could not resume audio:',error));}ENGINE.stepBudget=0;window.dispatchEvent(new CustomEvent('mlgame-state',{detail:'running'}));}}
function stepRuntime(){if(ENGINE.running){pauseRuntime();ENGINE.stepBudget=1;}}
function gameLoop(timestamp){
    ENGINE.loopHandle=null;
    if(!ENGINE.lastTime)ENGINE.lastTime=timestamp;
    const dt=Math.min(100,Math.max(0,timestamp-ENGINE.lastTime));ENGINE.lastTime=timestamp;
    if(ENGINE.running&&!ENGINE.paused)ENGINE.clock+=dt;
    ENGINE.frameNumber++;ENGINE.budgetStarted=performance.now();ENGINE.budgetBlocks=0;
    for(const waiter of ENGINE.waiters){if(!contextActive(waiter.c)||(waiter.gate?(!ENGINE.paused||ENGINE.stepBudget>0):ENGINE.running&&!ENGINE.paused&&ENGINE.clock>=waiter.deadline&&ENGINE.frameNumber>=waiter.frame)){ENGINE.waiters.delete(waiter);waiter.resolve();}}
    if(timestamp-ENGINE.lastRender>=ENGINE.frameInterval){ENGINE.deltaTime=ENGINE.running&&!ENGINE.paused?dt/1000:0;ENGINE.lastRender=timestamp;render();}
    if(ENGINE.running)ENGINE.loopHandle=requestAnimationFrame(gameLoop);
}

/* EVENTS */

window.addEventListener("resize",requestResize);

window.addEventListener("load",()=>{
    ENGINE.resizeCanvas=document.createElement("canvas");
    resizeGame();
    initAudio();
    runScripts();
    ENGINE.lastRender=performance.now();
    if(ENGINE.loopHandle===null)ENGINE.loopHandle=requestAnimationFrame(gameLoop);
});


/* PUBLIC API */

window.MLGame={
    ENGINE,canvas,ctx,
    broadcast:broadcastMessage,
    broadcastAndWait:broadcastAndWaitMessage,
    registerBlock,registerReporter,createBlock,createReporter,
    executeBlock,executeBlocks,createScriptContext,
    resolveValue,resolveSpriteName,getContextSprite,
    getSprites,getAllSprites,
    start:startRuntime,restart:startRuntime,stop:stopRuntime,pause:pauseRuntime,resume:resumeRuntime,step:stepRuntime,
    reportError:reportRuntimeError,contextActive,runtimeWait,preloadAssets,
    inspect:()=>({running:ENGINE.running,paused:ENGINE.paused,executedBlocks:ENGINE.executedBlocks,blockId:ENGINE.lastBlock?._id,blockType:ENGINE.lastBlock?.type,variables:{...ENGINE.variables},sprites:Object.keys(ENGINE.sprites),clones:ENGINE.clones.length,errors:ENGINE.errors.slice()})
};
