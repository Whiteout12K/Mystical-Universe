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
document.documentElement.style.touchAction=document.body.style.touchAction=canvas.style.touchAction="none";
document.documentElement.style.userSelect=document.body.style.userSelect=canvas.style.userSelect="none";
const prevent=e=>e.preventDefault();
["gesturestart","gesturechange","gestureend"].forEach(e=>document.addEventListener(e,prevent,{passive:false}));
document.addEventListener("wheel",e=>{if(e.ctrlKey)prevent(e)},{passive:false});
document.addEventListener("touchmove",e=>{if(e.touches.length>1)prevent(e)},{passive:false});

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const frame=()=>delay(0);


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

ENGINE.recordBlock=b=>{
    if(b&&typeof b==="object"&&!ENGINE.program.includes(b))ENGINE.program.push(b);
    return b;
};

ENGINE.removeTopLevelBlock=b=>{
    const i=ENGINE.program.indexOf(b);
    if(i>=0)ENGINE.program.splice(i,1);
};

ENGINE.absorbBlocks=bs=>{
    if(Array.isArray(bs))bs.forEach(ENGINE.absorbBlock);
};

ENGINE.absorbBlock=b=>{
    if(!b||typeof b!=="object")return;
    ENGINE.removeTopLevelBlock(b);
    absorbNested(b);
};

function absorbNested(b){
    if(!b||typeof b!=="object")return;
    for(const v of Object.values(b))
        if(Array.isArray(v))
            for(const x of v)
                if(x?.type){
                    ENGINE.removeTopLevelBlock(x);
                    absorbNested(x);
                }
        else if(v?.type){
            ENGINE.removeTopLevelBlock(v);
            absorbNested(v);
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
    const ac=ENGINE.audioContext;
    if(!ac||!sound?.path)return null;
    if(sound.buffer&&sound.bufferPath===sound.path)return sound.buffer;
    try{
        const r=await fetch(sound.path);
        if(!r.ok)throw Error(`HTTP ${r.status}`);
        sound.buffer=await ac.decodeAudioData(await r.arrayBuffer());
        sound.bufferPath=sound.path;
        return sound.buffer;
    }catch(e){
        console.warn("Could not load sound:",sound.name,sound.path,e);
        return null;
    }
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
    const ac=initAudio();
    if(!ac)return;
    if(ac.state!=="running"){
        ENGINE.audioPending.push({sound});
        return;
    }
    const buffer=await loadSoundBuffer(sound);
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

        const image=new Image();
        this.imageCache[path]=image;
        this.costumeCacheOrder.push(path);

        if(this.costumeCacheOrder.length>4){
            const old=this.costumeCacheOrder.shift();
            if(old!==path)delete this.imageCache[old];
        }

        this.image=image;
        this.loaded=false;

        image.onload=()=>{
            if(this.imageCache[path]!==image)return;

            if(this.costume===path){
                this.loaded=true;
                this.effectCacheKey=null;
                this.updateSize();
                updateEdgeSprite(this);
            }
        };

        image.onerror=()=>{
            if(this.imageCache[path]===image)
                console.warn("Could not load costume:",path);
        };

        image.src=path;
    }

    updateSize(){
        if(!this.image?.naturalWidth)return;
        this.width=160*this.scale;
        this.height=this.width*this.image.naturalHeight/this.image.naturalWidth;
        this.effectCacheKey=null;
    }

    setScale(scale){
        scale=Number(scale);
        if(!Number.isFinite(scale)||scale<=0)scale=1;
        this.scale=scale;
        this.updateSize();
        updateEdgeSprite(this);
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

    const hw=sprite.width/2,hh=sprite.height/2,{x:cx,y:cy}=ENGINE.camera;
    const vw=ENGINE.viewWidth/2,vh=ENGINE.viewHeight/2;
    const left=cx-vw,right=cx+vw,bottom=cy-vh,top=cy+vh;

    if(lock.horizontal==="left")
        sprite.x=left+lock.horizontalDistance+hw;
    else if(lock.horizontal==="right")
        sprite.x=right-lock.horizontalDistance-hw;

    if(lock.vertical==="top")
        sprite.y=top-lock.verticalDistance-hh;
    else if(lock.vertical==="bottom")
        sprite.y=bottom+lock.verticalDistance+hh;

    const minX=left+hw,maxX=right-hw,minY=bottom+hh,maxY=top-hh;

    sprite.x=minX<=maxX?clamp(sprite.x,minX,maxX):cx;
    sprite.y=minY<=maxY?clamp(sprite.y,minY,maxY):cy;
}

function updateEdgeSprites(){
    getAllSprites().forEach(updateEdgeSprite);
}


/* BROADCASTS */

function createScriptContext(clone=null){
    return{
        ended:false,
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
    if(!block||typeof block!=="object"||!ENGINE.running||context.ended)return;

    if(block.type==="endScript"){
        context.ended=true;
        return;
    }

    const handler=ENGINE.blocks[block.type]?.execute;
    if(handler)await handler(block,context);
}

async function executeBlocks(blocks,context){
    if(!Array.isArray(blocks))return;

    for(const block of blocks){
        if(!ENGINE.running||context.ended)break;
        await executeBlock(block,context);
    }
}


/* CONTROL */

registerBlock("repeat",async(b,c)=>{
    const n=Math.max(0,Math.floor(Number(resolveValue(b.times,c))||0));

    for(let i=0;i<n&&ENGINE.running&&!c.ended;i++)
        await executeBlocks(b.blocks,c);
});

registerBlock("forever",async(b,c)=>{
    while(ENGINE.running&&!c.ended){
        await executeBlocks(b.blocks,c);
        await frame();
    }
});

registerBlock("if",async(b,c)=>{
    await executeBlocks(
        resolveValue(b.condition,c)?b.thenBlocks:b.elseBlocks,
        c
    );
});

async function conditionalLoop(b,c,test,yieldFn){
    while(ENGINE.running&&!c.ended&&test(b,c)){
        await executeBlocks(b.blocks,c);
        await yieldFn();
    }
}

registerBlock("repeatUntil",(b,c)=>
    conditionalLoop(b,c,(b,c)=>!resolveValue(b.condition,c),frame)
);

registerBlock("while",(b,c)=>
    conditionalLoop(b,c,(b,c)=>!!resolveValue(b.condition,c),frame)
);

registerBlock("wait",async(b,c)=>
    delay(Math.max(0,Number(resolveValue(b.time,c))||0)*1000)
);

registerBlock("waitUntil",(b,c)=>
    conditionalLoop(
        b,c,
        (b,c)=>!resolveValue(b.condition,c),
        ()=>delay(16)
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
    if(ENGINE.running)await executeProgram();
}


/* CANVAS */

function getViewHeight(width){
    return 360-54*clamp((1000-width)/500,0,1);
}

function resizeGame(){
    const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);

    ENGINE.mobile=w<700;

    const pw=Math.ceil(w),ph=Math.ceil(h);

    canvas.style.width=w+"px";
    canvas.style.height=h+"px";

    if(canvas.width!==pw||canvas.height!==ph){
        canvas.width=pw;
        canvas.height=ph;
    }

    ENGINE.viewHeight=getViewHeight(w);
    ENGINE.unitScale=h/ENGINE.viewHeight;
    ENGINE.viewWidth=w/ENGINE.unitScale;
    ENGINE.centerX=ENGINE.centerY=0;
    ENGINE.width=ENGINE.viewWidth;
    ENGINE.height=ENGINE.viewHeight;

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

function gameLoop(timestamp){
    if(!ENGINE.running)return;

    if(!ENGINE.lastTime)ENGINE.lastTime=timestamp;

    const elapsed=timestamp-ENGINE.lastRender;

    if(elapsed>=ENGINE.frameInterval){
        ENGINE.deltaTime=(timestamp-ENGINE.lastTime)/1000;
        ENGINE.lastTime=timestamp;
        ENGINE.lastRender=timestamp-elapsed%ENGINE.frameInterval;
        render();
    }

    requestAnimationFrame(gameLoop);
}


/* EVENTS */

window.addEventListener("resize",requestResize);

window.addEventListener("load",()=>{
    ENGINE.resizeCanvas=document.createElement("canvas");
    resizeGame();
    initAudio();
    runScripts();
    ENGINE.lastRender=performance.now();
    requestAnimationFrame(gameLoop);
});


/* PUBLIC API */

window.MLGame={
    ENGINE,canvas,ctx,
    broadcast:broadcastMessage,
    broadcastAndWait:broadcastAndWaitMessage,
    registerBlock,registerReporter,createBlock,createReporter,
    executeBlock,executeBlocks,createScriptContext,
    resolveValue,resolveSpriteName,getContextSprite,
    getSprites,getAllSprites
};