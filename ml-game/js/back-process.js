// back-process.js

const ENGINE={
    width:640,height:360,centerX:0,centerY:0,viewWidth:640,viewHeight:360,unitScale:1,
    background:"#000000",backgroundImage:null,backgroundLoaded:false,backgroundScale:1,backgroundCostume:"",
    backgroundEffects:{brightness:0,ghost:0,color:0},
    sprites:{},sounds:{},variables:{},running:true,lastTime:0,deltaTime:0,camera:{x:0,y:0},
    scripts:[],program:[],broadcasts:{},blocks:{},mobile:false,buildingBlock:false,_blockId:0,
    audioContext:null,audioUnlocked:false,audioPending:[],masterGain:null,
    backgroundEffectCanvas:null,backgroundEffectCacheKey:null,
    fps:60,frameInterval:1000/60,lastRender:0,spriteOrderDirty:true,spriteOrder:[],
    resizeCanvas:null,resizeFrame:null
};

const canvas=document.getElementById("game-canvas");
const ctx=canvas.getContext("2d",{alpha:false});

ctx.imageSmoothingEnabled=true;
ctx.imageSmoothingQuality="high";

document.documentElement.style.touchAction=
document.body.style.touchAction=
canvas.style.touchAction="none";

document.documentElement.style.userSelect=
document.body.style.userSelect=
canvas.style.userSelect="none";

["gesturestart","gesturechange","gestureend"].forEach(event=>{
    document.addEventListener(event,e=>e.preventDefault(),{passive:false});
});

document.addEventListener("wheel",e=>{
    if(e.ctrlKey)e.preventDefault();
},{passive:false});

document.addEventListener("touchmove",e=>{
    if(e.touches.length>1)e.preventDefault();
},{passive:false});


function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
}


/* AUDIO */

function initAudio(){
    if(ENGINE.audioContext)return ENGINE.audioContext;

    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return null;

    try{
        ENGINE.audioContext=new AudioContextClass();
        ENGINE.audioUnlocked=ENGINE.audioContext.state==="running";
        ENGINE.masterGain=ENGINE.audioContext.createGain();
        ENGINE.masterGain.gain.value=1;
        ENGINE.masterGain.connect(ENGINE.audioContext.destination);
        return ENGINE.audioContext;
    }catch(error){
        console.warn("Could not initialize audio:",error);
        return null;
    }
}


async function unlockAudio(){
    const audioContext=initAudio();
    if(!audioContext)return;

    try{
        if(audioContext.state!=="running")
            await audioContext.resume();

        ENGINE.audioUnlocked=audioContext.state==="running";

        if(ENGINE.audioUnlocked)
            flushPendingSounds();
    }catch(error){
        console.warn("Could not unlock audio:",error);
    }
}


function flushPendingSounds(){
    if(!ENGINE.audioPending.length)return;

    const pending=ENGINE.audioPending.splice(0);
    for(const item of pending)
        playSoundInternal(item.sound);
}


["pointerdown","touchstart","mousedown","keydown"].forEach(event=>{
    document.addEventListener(event,unlockAudio,{passive:true});
});


async function loadSoundBuffer(sound){
    const audioContext=ENGINE.audioContext;
    if(!audioContext||!sound?.path)
        return null;

    if(sound.buffer&&sound.bufferPath===sound.path)
        return sound.buffer;

    try{
        const response=await fetch(sound.path);

        if(!response.ok)
            throw new Error(`HTTP ${response.status}`);

        const data=await response.arrayBuffer();
        const buffer=await audioContext.decodeAudioData(data);

        sound.buffer=buffer;
        sound.bufferPath=sound.path;

        return buffer;
    }catch(error){
        console.warn("Could not load sound:",sound.name,sound.path,error);
        return null;
    }
}


function removeSoundInstance(sound,instance){
    const index=sound.instances.indexOf(instance);
    if(index!==-1)sound.instances.splice(index,1);
}


async function playSoundInternal(sound){
    const audioContext=initAudio();
    if(!audioContext)return;

    if(audioContext.state!=="running"){
        ENGINE.audioPending.push({sound});
        return;
    }

    const buffer=await loadSoundBuffer(sound);

    if(!buffer||!ENGINE.running)
        return;

    if(audioContext.state!=="running")
        return;

    const source=audioContext.createBufferSource();
    const gain=audioContext.createGain();
    const panner=audioContext.createStereoPanner();

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

        try{
            source.disconnect();
            gain.disconnect();
            panner.disconnect();
        }catch(error){}
    };

    source.onended=cleanup;

    try{
        source.start(0);
    }catch(error){
        cleanup();
        console.warn("Could not play sound:",sound.name,error);
    }
}


function stopSoundInstance(instance){
    if(!instance||instance.stopped)return;

    instance.stopped=true;

    try{
        instance.source.stop(0);
    }catch(error){}

    try{
        instance.source.disconnect();
        instance.gain.disconnect();
        instance.panner.disconnect();
    }catch(error){}
}


/* COLOR / EFFECTS */

function rgbToHsl(r,g,b){
    r/=255;
    g/=255;
    b/=255;

    const max=Math.max(r,g,b);
    const min=Math.min(r,g,b);
    const l=(max+min)/2;

    if(max===min)return[0,0,l];

    const d=max-min;
    const s=l>0.5?d/(2-max-min):d/(max+min);
    let h;

    switch(max){
        case r:h=(g-b)/d+(g<b?6:0);break;
        case g:h=(b-r)/d+2;break;
        default:h=(r-g)/d+4;
    }

    return[h/6,s,l];
}


function hueToRgb(p,q,t){
    if(t<0)t+=1;
    if(t>1)t-=1;
    if(t<1/6)return p+(q-p)*6*t;
    if(t<1/2)return q;
    if(t<2/3)return p+(q-p)*(2/3-t)*6;
    return p;
}


function hslToRgb(h,s,l){
    if(s===0)return[l*255,l*255,l*255];

    const q=l<0.5?l*(1+s):l+s-l*s;
    const p=2*l-q;

    return[
        Math.round(hueToRgb(p,q,h+1/3)*255),
        Math.round(hueToRgb(p,q,h)*255),
        Math.round(hueToRgb(p,q,h-1/3)*255)
    ];
}


function applyImageEffects(image,effects,cacheCanvas,cacheKeyGetter,cacheKeySetter,key){
    if(!image?.naturalWidth)return null;

    const brightness=clamp(Number(effects.brightness)||0,0,100);
    const color=clamp(Number(effects.color)||0,0,100);
    const ghost=clamp(Number(effects.ghost)||0,0,100);

    if(brightness===0&&color===0)
        return{source:image,ghost};

    const width=Math.max(1,Math.ceil(image.naturalWidth));
    const height=Math.max(1,Math.ceil(image.naturalHeight));

    if(cacheCanvas.width!==width||cacheCanvas.height!==height){
        cacheCanvas.width=width;
        cacheCanvas.height=height;
        cacheKeySetter(null);
    }

    const cacheKey=`${key}|${width}|${height}|${brightness}|${color}`;

    if(cacheKeyGetter()!==cacheKey){
        const effectCtx=cacheCanvas.getContext("2d",{willReadFrequently:true});

        effectCtx.clearRect(0,0,width,height);
        effectCtx.drawImage(image,0,0,width,height);

        let imageData;

        try{
            imageData=effectCtx.getImageData(0,0,width,height);
        }catch(error){
            console.warn("Unable to process image effects:",error);
            cacheKeySetter(null);
            return{source:image,ghost};
        }

        const data=imageData.data;
        const brightnessMultiplier=1+brightness/100;
        const hueShift=color/100;

        for(let i=0;i<data.length;i+=4){
            if(data[i+3]===0)continue;

            let r=data[i],g=data[i+1],b=data[i+2];

            if(brightness>0){
                r=clamp(Math.round(r*brightnessMultiplier),0,255);
                g=clamp(Math.round(g*brightnessMultiplier),0,255);
                b=clamp(Math.round(b*brightnessMultiplier),0,255);
            }

            if(color>0){
                const hsl=rgbToHsl(r,g,b);
                const rgb=hslToRgb((hsl[0]+hueShift)%1,hsl[1],hsl[2]);
                r=rgb[0];
                g=rgb[1];
                b=rgb[2];
            }

            data[i]=r;
            data[i+1]=g;
            data[i+2]=b;
        }

        effectCtx.putImageData(imageData,0,0);
        cacheKeySetter(cacheKey);
    }

    return{source:cacheCanvas,ghost};
}


function createEffectCanvas(sprite){
    if(!sprite.effectCanvas)
        sprite.effectCanvas=document.createElement("canvas");

    const width=Math.max(1,Math.ceil(sprite.width));
    const height=Math.max(1,Math.ceil(sprite.height));

    if(sprite.effectCanvas.width!==width||sprite.effectCanvas.height!==height){
        sprite.effectCanvas.width=width;
        sprite.effectCanvas.height=height;
        sprite.effectCacheKey=null;
    }

    return sprite.effectCanvas;
}


function applySpriteEffects(sprite){
    const effects=sprite.effects||{};
    const canvas=createEffectCanvas(sprite);

    return applyImageEffects(
        sprite.image,
        effects,
        canvas,
        ()=>sprite.effectCacheKey,
        value=>sprite.effectCacheKey=value,
        `${sprite.costume}|${sprite.width}|${sprite.height}`
    );
}


function createCanvasEffectCanvas(){
    if(!ENGINE.backgroundEffectCanvas)
        ENGINE.backgroundEffectCanvas=document.createElement("canvas");

    return ENGINE.backgroundEffectCanvas;
}


function applyCanvasEffects(){
    const image=ENGINE.backgroundImage;
    if(!image?.naturalWidth)return null;

    const canvas=createCanvasEffectCanvas();
    const effects=ENGINE.backgroundEffects||{};

    return applyImageEffects(
        image,
        effects,
        canvas,
        ()=>ENGINE.backgroundEffectCacheKey,
        value=>ENGINE.backgroundEffectCacheKey=value,
        ENGINE.backgroundCostume
    );
}


/* SPRITE */

class Sprite{
    constructor(name){
        Object.assign(this,{
            name,x:0,y:0,visible:true,costume:null,image:null,scale:1,
            width:160,height:160,loaded:false,opacity:1,rotation:0,
            flipX:1,flipY:1,
            effects:{brightness:0,ghost:0,color:0},
            layer:0,variables:{},velocityX:0,velocityY:0,edgeLock:null,
            imageCache:{},costumeCacheOrder:[],effectCanvas:null,effectCacheKey:null,
            touchable:true
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

        let cached=this.imageCache[path];

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
            const oldPath=this.costumeCacheOrder.shift();

            if(oldPath!==path)
                delete this.imageCache[oldPath];
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

            if(this.costume===path)
                this.loaded=false;
        };

        image.src=path;
    }

    updateSize(){
        if(!this.image?.naturalWidth)return;

        this.width=160*this.scale;
        this.height=this.width*(this.image.naturalHeight/this.image.naturalWidth);
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
        if(!this.visible||!this.loaded)return;

        const effect=applySpriteEffects(this);
        if(!effect)return;

        ctx.globalAlpha=clamp(Number(this.opacity)||0,0,1)*(1-effect.ghost/100);

        ctx.save();

        ctx.translate(
            (this.x-ENGINE.camera.x)*ENGINE.unitScale+canvas.width/2,
            -(this.y-ENGINE.camera.y)*ENGINE.unitScale+canvas.height/2
        );

        ctx.rotate(this.rotation*Math.PI/180);
        ctx.scale(this.flipX,this.flipY);

        ctx.drawImage(
            effect.source,
            -this.width*ENGINE.unitScale/2,
            -this.height*ENGINE.unitScale/2,
            this.width*ENGINE.unitScale,
            this.height*ENGINE.unitScale
        );

        ctx.restore();
    }
}


/* VALUES / BLOCKS */

function resolveValue(value){
    if(value===null||value===undefined)return"";

    if(typeof value==="object"){
        switch(value.type){
            case"variable":
                return ENGINE.variables[value.name]??"";

            case"join":
                return(value.values||[]).map(resolveValue).join("");

            case"value":
                return resolveValue(value.value);

            case"operator":{
                const block=ENGINE.blocks[value.operator];

                if(block?.reporter)
                    return block.reporter(value);

                if(typeof value.evaluate==="function")
                    return value.evaluate();
            }
        }
    }

    return value;
}


function registerBlock(type,handler,options={}){
    if(!type)return;

    ENGINE.blocks[type]={
        execute:typeof handler==="function"?handler:null,
        reporter:typeof options.reporter==="function"?options.reporter:null
    };
}


function registerReporter(type,evaluate){
    registerBlock(type,null,{reporter:evaluate});
}


function createBlock(type,data={}){
    return{
        type,
        _id:++ENGINE._blockId,
        _handled:false,
        ...data
    };
}


function createReporter(type,data={}){
    return{
        type:"operator",
        operator:type,
        ...data
    };
}


/* PROGRAM */

ENGINE.recordBlock=block=>{
    if(block&&typeof block==="object"&&!ENGINE.program.includes(block))
        ENGINE.program.push(block);

    return block;
};


ENGINE.removeTopLevelBlock=block=>{
    const index=ENGINE.program.indexOf(block);
    if(index!==-1)ENGINE.program.splice(index,1);
};


ENGINE.absorbBlocks=blocks=>{
    if(Array.isArray(blocks))
        blocks.forEach(ENGINE.absorbBlock);
};


ENGINE.absorbBlock=block=>{
    if(!block||typeof block!=="object")return;

    ENGINE.removeTopLevelBlock(block);
    absorbNested(block);
};


function absorbNested(block){
    if(!block||typeof block!=="object")return;

    Object.values(block).forEach(value=>{
        if(Array.isArray(value)){
            value.forEach(child=>{
                if(child?.type){
                    ENGINE.removeTopLevelBlock(child);
                    absorbNested(child);
                }
            });
        }else if(value?.type){
            ENGINE.removeTopLevelBlock(value);
            absorbNested(value);
        }
    });
}


function markBlockTreeHandled(block){
    if(!block||typeof block!=="object")return;

    block._handled=true;

    Object.values(block).forEach(value=>{
        if(Array.isArray(value))
            value.forEach(markBlockTreeHandled);
        else if(value?.type)
            markBlockTreeHandled(value);
    });
}


/* SPRITE EDGE LOCKING */

function updateEdgeSprite(sprite){
    if(!sprite?.edgeLock)return;

    const lock=sprite.edgeLock;
    const halfWidth=sprite.width/2;
    const halfHeight=sprite.height/2;

    const left=ENGINE.camera.x-ENGINE.viewWidth/2;
    const right=ENGINE.camera.x+ENGINE.viewWidth/2;
    const top=ENGINE.camera.y+ENGINE.viewHeight/2;
    const bottom=ENGINE.camera.y-ENGINE.viewHeight/2;

    if(lock.horizontal==="left")
        sprite.x=left+lock.horizontalDistance+halfWidth;
    else if(lock.horizontal==="right")
        sprite.x=right-lock.horizontalDistance-halfWidth;

    if(lock.vertical==="top")
        sprite.y=top-lock.verticalDistance-halfHeight;
    else if(lock.vertical==="bottom")
        sprite.y=bottom+lock.verticalDistance+halfHeight;

    const minX=left+halfWidth;
    const maxX=right-halfWidth;
    const minY=bottom+halfHeight;
    const maxY=top-halfHeight;

    sprite.x=minX<=maxX?Math.max(minX,Math.min(maxX,sprite.x)):ENGINE.camera.x;
    sprite.y=minY<=maxY?Math.max(minY,Math.min(maxY,sprite.y)):ENGINE.camera.y;
}


function updateEdgeSprites(){
    const sprites=Object.values(ENGINE.sprites);

    for(let i=0;i<sprites.length;i++)
        updateEdgeSprite(sprites[i]);
}


/* BROADCASTS */

function createScriptContext(){
    return{ended:false};
}


function registerBroadcast(message,blocks){
    const key=String(resolveValue(message));

    if(!ENGINE.broadcasts[key])
        ENGINE.broadcasts[key]=[];

    const script={
        blocks:Array.isArray(blocks)?blocks:[],
        registered:true
    };

    ENGINE.broadcasts[key].push(script);
    return script;
}


function broadcastMessage(message){
    const listeners=ENGINE.broadcasts[String(resolveValue(message))];
    if(!listeners?.length)return;

    for(const listener of listeners){
        const context=createScriptContext();

        Promise.resolve()
            .then(()=>executeBlocks(listener.blocks,context))
            .catch(error=>console.error("Broadcast script error:",error));
    }
}


async function broadcastAndWaitMessage(message){
    const listeners=ENGINE.broadcasts[String(resolveValue(message))];
    if(!listeners?.length)return;

    await Promise.all(
        listeners.map(listener=>
            executeBlocks(listener.blocks,createScriptContext())
        )
    );
}


async function executeBlock(block,context){
    if(!block||typeof block!=="object"||!ENGINE.running||context.ended)
        return;

    if(block.type==="endScript"){
        context.ended=true;
        return;
    }

    const registered=ENGINE.blocks[block.type];

    if(registered?.execute)
        await registered.execute(block,context);
}


async function executeBlocks(blocks,context){
    if(!Array.isArray(blocks))return;

    for(const block of blocks){
        if(!ENGINE.running||context.ended)break;
        await executeBlock(block,context);
    }
}


/* CONTROL */

registerBlock("repeat",async(block,context)=>{
    const times=Math.max(0,Math.floor(Number(resolveValue(block.times))||0));

    for(let i=0;i<times&&ENGINE.running&&!context.ended;i++)
        await executeBlocks(block.blocks,context);
});


registerBlock("forever",async(block,context)=>{
    while(ENGINE.running&&!context.ended){
        await executeBlocks(block.blocks,context);
        await new Promise(resolve=>setTimeout(resolve,0));
    }
});


registerBlock("if",async(block,context)=>{
    await executeBlocks(
        resolveValue(block.condition)?block.thenBlocks:block.elseBlocks,
        context
    );
});


registerBlock("repeatUntil",async(block,context)=>{
    while(
        ENGINE.running&&
        !context.ended&&
        !resolveValue(block.condition)
    ){
        await executeBlocks(block.blocks,context);
        await new Promise(resolve=>setTimeout(resolve,0));
    }
});


registerBlock("while",async(block,context)=>{
    while(
        ENGINE.running&&
        !context.ended&&
        resolveValue(block.condition)
    ){
        await executeBlocks(block.blocks,context);
        await new Promise(resolve=>setTimeout(resolve,0));
    }
});


registerBlock("wait",async block=>{
    const seconds=Math.max(0,Number(resolveValue(block.time))||0);

    await new Promise(resolve=>
        setTimeout(resolve,seconds*1000)
    );
});


registerBlock("waitUntil",async(block,context)=>{
    while(
        ENGINE.running&&
        !context.ended&&
        !resolveValue(block.condition)
    )
        await new Promise(resolve=>setTimeout(resolve,16));
});


registerBlock("broadcast",async block=>{
    broadcastMessage(block.message);
});


registerBlock("broadcastWait",async block=>{
    await broadcastAndWaitMessage(block.message);
});


registerBlock("broadcastScript",async(block,context)=>{
    await executeBlocks(block.blocks,context);
});


/* PROGRAM START */

async function executeProgram(){
    const context=createScriptContext();
    ENGINE.scripts=ENGINE.program.slice();

    try{
        await executeBlocks(ENGINE.program,context);
    }catch(error){
        console.error("Main program error:",error);
    }
}


function runScripts(){
    executeProgram();
}


function startStandaloneBlock(block){
    return block?ENGINE.recordBlock(block):block;
}


/* CANVAS */

function resizeGame(){
    const width=Math.max(1,window.innerWidth);
    const height=Math.max(1,window.innerHeight);

    ENGINE.mobile=width<700;

    if(canvas.style.width!==width+"px")
        canvas.style.width=width+"px";

    if(canvas.style.height!==height+"px")
        canvas.style.height=height+"px";

    if(ENGINE.resizeCanvas&&
       (ENGINE.resizeCanvas.width!==width||ENGINE.resizeCanvas.height!==height)){
        const oldWidth=canvas.width;
        const oldHeight=canvas.height;

        ENGINE.resizeCanvas.width=oldWidth;
        ENGINE.resizeCanvas.height=oldHeight;

        const resizeCtx=ENGINE.resizeCanvas.getContext("2d");
        resizeCtx.clearRect(0,0,oldWidth,oldHeight);
        resizeCtx.drawImage(canvas,0,0);

        canvas.width=Math.ceil(width);
        canvas.height=Math.ceil(height);

        resizeCtx.clearRect(0,0,oldWidth,oldHeight);

        ctx.drawImage(
            ENGINE.resizeCanvas,
            0,0,oldWidth,oldHeight,
            0,0,canvas.width,canvas.height
        );
    }else if(canvas.width!==Math.ceil(width)||canvas.height!==Math.ceil(height)){
        canvas.width=Math.ceil(width);
        canvas.height=Math.ceil(height);
    }

    if(ENGINE.mobile){
        ENGINE.viewHeight=360;
        ENGINE.viewWidth=360*(width/height);
        ENGINE.unitScale=height/360;
    }else{
        ENGINE.unitScale=Math.min(width/640,height/360);
        ENGINE.viewWidth=width/ENGINE.unitScale;
        ENGINE.viewHeight=height/ENGINE.unitScale;
    }

    ENGINE.centerX=ENGINE.viewWidth/2;
    ENGINE.centerY=ENGINE.viewHeight/2;
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
    if(!ENGINE.backgroundLoaded||!ENGINE.backgroundImage){
        ctx.fillStyle=ENGINE.background;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        return;
    }

    const image=ENGINE.backgroundImage;
    const width=640*(Number(ENGINE.backgroundScale)||1);
    const height=width*(image.naturalHeight/image.naturalWidth);

    const x=canvas.width/2-width*ENGINE.unitScale/2;
    const y=canvas.height/2-height*ENGINE.unitScale/2;
    const effect=applyCanvasEffects();

    if(!effect)return;

    ctx.globalAlpha=1-effect.ghost/100;

    ctx.drawImage(
        effect.source,
        x,
        y,
        width*ENGINE.unitScale,
        height*ENGINE.unitScale
    );
}


function updateSpriteOrder(){
    if(!ENGINE.spriteOrderDirty)return;

    ENGINE.spriteOrder=Object.values(ENGINE.sprites);

    ENGINE.spriteOrder.sort((a,b)=>a.layer-b.layer);

    ENGINE.spriteOrderDirty=false;
}


function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.globalAlpha=1;

    drawBackground();
    updateEdgeSprites();
    updateSpriteOrder();

    const sprites=ENGINE.spriteOrder;

    for(let i=0;i<sprites.length;i++)
        sprites[i].draw();

    ctx.globalAlpha=1;
}


function gameLoop(timestamp){
    if(!ENGINE.running)return;

    if(!ENGINE.lastTime)
        ENGINE.lastTime=timestamp;

    const elapsed=timestamp-ENGINE.lastRender;

    if(elapsed>=ENGINE.frameInterval){
        ENGINE.deltaTime=(timestamp-ENGINE.lastTime)/1000;
        ENGINE.lastTime=timestamp;
        ENGINE.lastRender=timestamp-(elapsed%ENGINE.frameInterval);
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


window.MLGame={
    ENGINE,
    canvas,
    ctx,
    broadcast:broadcastMessage,
    broadcastAndWait:broadcastAndWaitMessage,
    registerBlock,
    registerReporter,
    createBlock,
    createReporter,
    executeBlock,
    executeBlocks,
    createScriptContext,
    resolveValue
};