function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
}


/* AUDIO */

function initAudio(){
    if(ENGINE.audioContext)return ENGINE.audioContext;

    const AudioContextClass=
        window.AudioContext||
        window.webkitAudioContext;

    if(!AudioContextClass)return null;

    try{
        ENGINE.audioContext=new AudioContextClass();
        ENGINE.audioUnlocked=
            ENGINE.audioContext.state==="running";

        ENGINE.masterGain=
            ENGINE.audioContext.createGain();

        ENGINE.masterGain.gain.value=1;
        ENGINE.masterGain.connect(
            ENGINE.audioContext.destination
        );

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

        ENGINE.audioUnlocked=
            audioContext.state==="running";

        if(ENGINE.audioUnlocked)
            flushPendingSounds();
    }catch(error){
        console.warn("Could not unlock audio:",error);
    }
}

function flushPendingSounds(){
    if(!ENGINE.audioPending.length)return;

    const pending=ENGINE.audioPending.splice(0);

    pending.forEach(item=>{
        playSoundInternal(item.sound);
    });
}

["pointerdown","touchstart","mousedown","keydown"].forEach(event=>{
    document.addEventListener(
        event,
        unlockAudio,
        {passive:true}
    );
});

async function loadSoundBuffer(sound){
    const audioContext=ENGINE.audioContext;

    if(!audioContext||!sound?.path)
        return null;

    if(
        sound.buffer&&
        sound.bufferPath===sound.path
    )
        return sound.buffer;

    try{
        const response=await fetch(sound.path);

        if(!response.ok)
            throw new Error(`HTTP ${response.status}`);

        const data=await response.arrayBuffer();

        const buffer=
            await audioContext.decodeAudioData(data);

        sound.buffer=buffer;
        sound.bufferPath=sound.path;

        return buffer;
    }catch(error){
        console.warn(
            "Could not load sound:",
            sound.name,
            sound.path,
            error
        );

        return null;
    }
}

function removeSoundInstance(sound,instance){
    const index=sound.instances.indexOf(instance);

    if(index!==-1)
        sound.instances.splice(index,1);
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

    const source=
        audioContext.createBufferSource();

    const gain=
        audioContext.createGain();

    const panner=
        audioContext.createStereoPanner();

    source.buffer=buffer;

    source.detune.value=
        clamp(
            Number(sound.pitch)||0,
            -100,
            100
        )*12;

    source.playbackRate.value=
        Math.max(
            0,
            Number(sound.speed)||100
        )/100;

    gain.gain.value=
        clamp(
            Number(sound.volume)||0,
            0,
            100
        )/100;

    panner.pan.value=
        clamp(
            Number(sound.pan)||0,
            -100,
            100
        )/100;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ENGINE.masterGain);

    const instance={
        source,
        gain,
        panner,
        stopped:false
    };

    if(!sound.instances)
        sound.instances=[];

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
        console.warn(
            "Could not play sound:",
            sound.name,
            error
        );
    }
}

function stopSoundInstance(instance){
    if(!instance||instance.stopped)
        return;

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


/* EFFECTS */

function rgbToHsl(r,g,b){
    r/=255;
    g/=255;
    b/=255;

    const max=Math.max(r,g,b);
    const min=Math.min(r,g,b);
    const l=(max+min)/2;

    if(max===min)
        return[0,0,l];

    const d=max-min;

    const s=
        l>0.5
            ?d/(2-max-min)
            :d/(max+min);

    let h;

    switch(max){
        case r:
            h=(g-b)/d+(g<b?6:0);
            break;

        case g:
            h=(b-r)/d+2;
            break;

        default:
            h=(r-g)/d+4;
    }

    return[h/6,s,l];
}

function hueToRgb(p,q,t){
    if(t<0)t+=1;
    if(t>1)t-=1;

    if(t<1/6)
        return p+(q-p)*6*t;

    if(t<1/2)
        return q;

    if(t<2/3)
        return p+(q-p)*(2/3-t)*6;

    return p;
}

function hslToRgb(h,s,l){
    if(s===0)
        return[l*255,l*255,l*255];

    const q=
        l<0.5
            ?l*(1+s)
            :l+s-l*s;

    const p=2*l-q;

    return[
        Math.round(hueToRgb(p,q,h+1/3)*255),
        Math.round(hueToRgb(p,q,h)*255),
        Math.round(hueToRgb(p,q,h-1/3)*255)
    ];
}

function applyImageEffects(
    image,
    effects,
    cacheCanvas,
    cacheKeyGetter,
    cacheKeySetter,
    key
){
    if(!image?.naturalWidth)
        return null;

    const brightness=
        clamp(
            Number(effects.brightness)||0,
            0,
            100
        );

    const color=
        clamp(
            Number(effects.color)||0,
            0,
            100
        );

    const ghost=
        clamp(
            Number(effects.ghost)||0,
            0,
            100
        );

    if(brightness===0&&color===0)
        return{
            source:image,
            ghost
        };

    const width=Math.max(
        1,
        Math.ceil(image.naturalWidth)
    );

    const height=Math.max(
        1,
        Math.ceil(image.naturalHeight)
    );

    if(
        cacheCanvas.width!==width||
        cacheCanvas.height!==height
    ){
        cacheCanvas.width=width;
        cacheCanvas.height=height;
        cacheKeySetter(null);
    }

    const cacheKey=
        `${key}|${width}|${height}|${brightness}|${color}`;

    if(cacheKeyGetter()!==cacheKey){
        const effectCtx=
            cacheCanvas.getContext(
                "2d",
                {willReadFrequently:true}
            );

        effectCtx.clearRect(
            0,
            0,
            width,
            height
        );

        effectCtx.imageSmoothingEnabled=true;
        effectCtx.imageSmoothingQuality="high";

        effectCtx.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        let imageData;

        try{
            imageData=
                effectCtx.getImageData(
                    0,
                    0,
                    width,
                    height
                );
        }catch(error){
            console.warn(
                "Unable to process image effects:",
                error
            );

            cacheKeySetter(null);

            return{
                source:image,
                ghost
            };
        }

        const data=imageData.data;
        const brightnessMultiplier=
            1+brightness/100;

        const hueShift=color/100;

        for(
            let i=0;
            i<data.length;
            i+=4
        ){
            if(data[i+3]===0)
                continue;

            let r=data[i];
            let g=data[i+1];
            let b=data[i+2];

            if(brightness>0){
                r=clamp(
                    Math.round(r*brightnessMultiplier),
                    0,
                    255
                );

                g=clamp(
                    Math.round(g*brightnessMultiplier),
                    0,
                    255
                );

                b=clamp(
                    Math.round(b*brightnessMultiplier),
                    0,
                    255
                );
            }

            if(color>0){
                const hsl=rgbToHsl(r,g,b);

                const rgb=hslToRgb(
                    (hsl[0]+hueShift)%1,
                    hsl[1],
                    hsl[2]
                );

                r=rgb[0];
                g=rgb[1];
                b=rgb[2];
            }

            data[i]=r;
            data[i+1]=g;
            data[i+2]=b;
        }

        effectCtx.putImageData(
            imageData,
            0,
            0
        );

        cacheKeySetter(cacheKey);
    }

    return{
        source:cacheCanvas,
        ghost
    };
}


/* SPRITE */

class Sprite{
    constructor(name){
        Object.assign(this,{
            name,
            x:0,
            y:0,
            visible:true,
            costume:null,
            image:null,
            scale:1,
            width:160,
            height:160,
            loaded:false,
            opacity:1,
            rotation:0,
            flipX:1,
            flipY:1,
            effects:{
                brightness:0,
                ghost:0,
                color:0
            },
            layer:0,
            variables:{},
            velocityX:0,
            velocityY:0,
            edgeLock:null,
            imageCache:{},
            costumeVersion:0,
            effectCanvas:null,
            effectCacheKey:null,
            touchable:true,
            _edgeDirty:true
        });
    }

    setCostume(path,scale=1){
        path=String(path??"");
        scale=Number(scale);

        if(!Number.isFinite(scale)||scale<=0)
            scale=1;

        if(!path){
            this.costume="";
            this.image=null;
            this.loaded=false;
            this.effectCacheKey=null;
            this._edgeDirty=true;
            return;
        }

        const changed=
            this.costume!==path||
            this.scale!==scale;

        this.costume=path;
        this.scale=scale;
        this.effectCacheKey=null;

        if(changed)
            this._edgeDirty=true;

        const cached=this.imageCache[path];

        if(cached){
            this.image=cached;

            this.loaded=
                cached.complete&&
                cached.naturalWidth>0;

            if(this.loaded){
                this.updateSize();
                updateEdgeSprite(this);
            }

            return;
        }

        const image=new Image();

        ++this.costumeVersion;

        this.imageCache[path]=image;
        this.image=image;
        this.loaded=false;

        image.onload=()=>{
            if(this.imageCache[path]!==image)
                return;

            if(this.costume===path){
                this.loaded=true;
                this.effectCacheKey=null;
                this.updateSize();
                updateEdgeSprite(this);
            }
        };

        image.onerror=()=>{
            if(this.imageCache[path]===image)
                console.warn(
                    "Could not load costume:",
                    path
                );

            if(this.costume===path)
                this.loaded=false;
        };

        image.src=path;
    }

    updateSize(){
        if(!this.image?.naturalWidth)
            return;

        this.width=160*this.scale;

        this.height=
            this.width*
            (
                this.image.naturalHeight/
                this.image.naturalWidth
            );

        this.effectCacheKey=null;
        this._edgeDirty=true;
    }

    setScale(scale){
        scale=Number(scale);

        if(!Number.isFinite(scale)||scale<=0)
            scale=1;

        if(this.scale===scale)
            return;

        this.scale=scale;
        this.updateSize();
        updateEdgeSprite(this);
    }

    draw(){
        if(!this.visible||!this.loaded)
            return;

        const effect=applySpriteEffects(this);

        if(!effect)
            return;

        ctx.save();

        ctx.globalAlpha=
            clamp(
                Number(this.opacity)||0,
                0,
                1
            )*
            (1-effect.ghost/100);

        ctx.translate(
            (this.x-ENGINE.camera.x)*
            ENGINE.unitScale+
            canvas.width/2,

            -(this.y-ENGINE.camera.y)*
            ENGINE.unitScale+
            canvas.height/2
        );

        if(this.rotation)
            ctx.rotate(
                this.rotation*
                Math.PI/180
            );

        if(
            this.flipX!==1||
            this.flipY!==1
        )
            ctx.scale(
                this.flipX,
                this.flipY
            );

        const width=
            this.width*
            ENGINE.unitScale;

        const height=
            this.height*
            ENGINE.unitScale;

        ctx.drawImage(
            effect.source,
            -width/2,
            -height/2,
            width,
            height
        );

        ctx.restore();
    }
}

function createEffectCanvas(sprite){
    if(!sprite.effectCanvas)
        sprite.effectCanvas=
            document.createElement("canvas");

    const width=Math.max(
        1,
        Math.ceil(sprite.width)
    );

    const height=Math.max(
        1,
        Math.ceil(sprite.height)
    );

    if(
        sprite.effectCanvas.width!==width||
        sprite.effectCanvas.height!==height
    ){
        sprite.effectCanvas.width=width;
        sprite.effectCanvas.height=height;
        sprite.effectCacheKey=null;
    }

    return sprite.effectCanvas;
}

function applySpriteEffects(sprite){
    const canvas=createEffectCanvas(sprite);

    return applyImageEffects(
        sprite.image,
        sprite.effects||{},
        canvas,
        ()=>sprite.effectCacheKey,
        value=>sprite.effectCacheKey=value,
        `${sprite.costume}|${sprite.width}|${sprite.height}`
    );
}

function createCanvasEffectCanvas(){
    if(!ENGINE.backgroundEffectCanvas)
        ENGINE.backgroundEffectCanvas=
            document.createElement("canvas");

    return ENGINE.backgroundEffectCanvas;
}

function applyCanvasEffects(){
    const image=ENGINE.backgroundImage;

    if(!image?.naturalWidth)
        return null;

    const canvas=createCanvasEffectCanvas();

    return applyImageEffects(
        image,
        ENGINE.backgroundEffects||{},
        canvas,
        ()=>ENGINE.backgroundEffectCacheKey,
        value=>ENGINE.backgroundEffectCacheKey=value,
        ENGINE.backgroundCostume
    );
}


/* SPRITE ORDER */

function markSpriteOrderDirty(){
    ENGINE.spriteOrderDirty=true;
}

function rebuildSpriteList(){
    ENGINE.spriteList=
        Object.values(ENGINE.sprites)
        .sort((a,b)=>a.layer-b.layer);

    ENGINE.spriteOrderDirty=false;
}


/* EDGE LOCKING */

function updateEdgeSprite(sprite){
    if(!sprite?.edgeLock)
        return;

    if(
        !sprite._edgeDirty&&
        !sprite.edgeLock.dynamic
    )
        return;

    const lock=sprite.edgeLock;
    const halfWidth=sprite.width/2;
    const halfHeight=sprite.height/2;

    const left=
        ENGINE.camera.x-
        ENGINE.viewWidth/2;

    const right=
        ENGINE.camera.x+
        ENGINE.viewWidth/2;

    const top=
        ENGINE.camera.y+
        ENGINE.viewHeight/2;

    const bottom=
        ENGINE.camera.y-
        ENGINE.viewHeight/2;

    if(lock.horizontal==="left")
        sprite.x=
            left+
            lock.horizontalDistance+
            halfWidth;

    else if(lock.horizontal==="right")
        sprite.x=
            right-
            lock.horizontalDistance-
            halfWidth;

    if(lock.vertical==="top")
        sprite.y=
            top-
            lock.verticalDistance-
            halfHeight;

    else if(lock.vertical==="bottom")
        sprite.y=
            bottom+
            lock.verticalDistance+
            halfHeight;

    const minX=left+halfWidth;
    const maxX=right-halfWidth;
    const minY=bottom+halfHeight;
    const maxY=top-halfHeight;

    sprite.x=
        minX<=maxX
            ?Math.max(minX,Math.min(maxX,sprite.x))
            :ENGINE.camera.x;

    sprite.y=
        minY<=maxY
            ?Math.max(minY,Math.min(maxY,sprite.y))
            :ENGINE.camera.y;

    sprite._edgeDirty=false;
}

function updateEdgeSprites(){
    Object.values(ENGINE.sprites).forEach(
        updateEdgeSprite
    );
}


/* BROADCASTS */

function createScriptContext(){
    return{
        ended:false,
        waiting:false,
        waitUntil:0
    };
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

function createRuntimeScript(blocks,context){
    return{
        blocks,
        context,
        index:0,
        done:false,
        started:true
    };
}

function startRuntimeScript(
    blocks,
    context=createScriptContext()
){
    if(!Array.isArray(blocks))
        return null;

    const runtime=
        createRuntimeScript(
            blocks,
            context
        );

    ENGINE.runtimeScripts.push(runtime);

    return runtime;
}

function broadcastMessage(message){
    const listeners=
        ENGINE.broadcasts[
            String(resolveValue(message))
        ];

    if(!listeners?.length)
        return;

    listeners.forEach(listener=>{
        startRuntimeScript(
            listener.blocks,
            createScriptContext()
        );
    });
}

async function broadcastAndWaitMessage(message){
    const listeners=
        ENGINE.broadcasts[
            String(resolveValue(message))
        ];

    if(!listeners?.length)
        return;

    const runtimes=
        listeners.map(listener=>
            startRuntimeScript(
                listener.blocks,
                createScriptContext()
            )
        );

    await Promise.all(
        runtimes.map(waitForRuntime)
    );
}

function waitForRuntime(runtime){
    if(!runtime||runtime.done)
        return Promise.resolve();

    return new Promise(resolve=>{
        runtime._resolve=resolve;
    });
}

function finishRuntime(runtime){
    if(runtime.done)
        return;

    runtime.done=true;

    if(runtime._resolve){
        const resolve=runtime._resolve;
        runtime._resolve=null;
        resolve();
    }
}

async function executeBlock(block,context){
    if(
        !block||
        typeof block!=="object"||
        !ENGINE.running||
        context.ended
    )
        return;

    if(block.type==="endScript"){
        context.ended=true;
        return;
    }

    const registered=
        ENGINE.blocks[block.type];

    if(registered?.execute)
        await registered.execute(
            block,
            context
        );
}

async function executeBlocks(blocks,context){
    if(!Array.isArray(blocks))
        return;

    for(const block of blocks){
        if(
            !ENGINE.running||
            context.ended
        )
            break;

        await executeBlock(
            block,
            context
        );
    }
}


/* SCRIPT SCHEDULER */

let frameResolvers=[];

function waitForNextFrame(){
    return new Promise(resolve=>{
        frameResolvers.push(resolve);
    });
}

function releaseFrameWaiters(){
    if(!frameResolvers.length)
        return;

    const waiters=frameResolvers;
    frameResolvers=[];

    waiters.forEach(resolve=>resolve());
}

async function runRuntimeScript(runtime){
    if(!runtime||runtime.done)
        return;

    try{
        await executeBlocks(
            runtime.blocks,
            runtime.context
        );
    }catch(error){
        console.error(
            "Script error:",
            error
        );
    }

    finishRuntime(runtime);
}

function processRuntimeScripts(){
    if(
        ENGINE._schedulerBusy||
        !ENGINE.runtimeScripts.length
    )
        return;

    ENGINE._schedulerBusy=true;

    const scripts=
        ENGINE.runtimeScripts.splice(0);

    scripts.forEach(runRuntimeScript);

    ENGINE._schedulerBusy=false;
}

function executeProgram(){
    ENGINE.scripts=
        ENGINE.program.slice();

    ENGINE.program.forEach(block=>{
        startRuntimeScript(
            [block],
            createScriptContext()
        );
    });
}

function runScripts(){
    executeProgram();
}

function startStandaloneBlock(block){
    if(!block)
        return block;

    ENGINE.recordBlock(block);

    startRuntimeScript(
        [block],
        createScriptContext()
    );

    return block;
}


/* CANVAS */

function resizeGame(){
    const width=Math.max(
        1,
        window.innerWidth
    );

    const height=Math.max(
        1,
        window.innerHeight
    );

    ENGINE.mobile=width<700;

    canvas.width=Math.ceil(width);
    canvas.height=Math.ceil(height);

    canvas.style.width=width+"px";
    canvas.style.height=height+"px";

    if(ENGINE.mobile){
        ENGINE.viewHeight=360;
        ENGINE.viewWidth=360*(width/height);
        ENGINE.unitScale=height/360;
    }else{
        ENGINE.unitScale=
            Math.min(
                width/640,
                height/360
            );

        ENGINE.viewWidth=
            width/ENGINE.unitScale;

        ENGINE.viewHeight=
            height/ENGINE.unitScale;
    }

    ENGINE.centerX=ENGINE.viewWidth/2;
    ENGINE.centerY=ENGINE.viewHeight/2;
    ENGINE.width=ENGINE.viewWidth;
    ENGINE.height=ENGINE.viewHeight;

    updateEdgeSprites();
}

function drawBackground(){
    if(
        !ENGINE.backgroundLoaded||
        !ENGINE.backgroundImage
    ){
        ctx.fillStyle=ENGINE.background;

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        return;
    }

    const image=ENGINE.backgroundImage;

    const width=
        640*
        (Number(ENGINE.backgroundScale)||1);

    const height=
        width*
        (
            image.naturalHeight/
            image.naturalWidth
        );

    const x=
        canvas.width/2-
        width*
        ENGINE.unitScale/2;

    const y=
        canvas.height/2-
        height*
        ENGINE.unitScale/2;

    const effect=applyCanvasEffects();

    if(!effect)
        return;

    ctx.save();

    ctx.globalAlpha=
        1-effect.ghost/100;

    ctx.drawImage(
        effect.source,
        x,
        y,
        width*ENGINE.unitScale,
        height*ENGINE.unitScale
    );

    ctx.restore();
}

function render(){
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawBackground();

    updateEdgeSprites();

    if(ENGINE.spriteOrderDirty)
        rebuildSpriteList();

    ENGINE.spriteList.forEach(
        sprite=>sprite.draw()
    );
}

function updateFPS(timestamp){
    ENGINE._fpsFrames++;

    if(!ENGINE._fpsTime)
        ENGINE._fpsTime=timestamp;

    const elapsed=
        timestamp-
        ENGINE._fpsTime;

    if(elapsed>=500){
        ENGINE.fps=
            Math.round(
                ENGINE._fpsFrames/
                (elapsed/1000)
            );

        ENGINE._fpsFrames=0;
        ENGINE._fpsTime=timestamp;
    }
}

function gameLoop(timestamp){
    if(!ENGINE.running)
        return;

    if(!ENGINE.lastTime)
        ENGINE.lastTime=timestamp;

    ENGINE.deltaTime=
        Math.min(
            0.1,
            Math.max(
                0,
                (
                    timestamp-
                    ENGINE.lastTime
                )/1000
            )
        );

    ENGINE.lastTime=timestamp;
    ENGINE.frame++;

    updateFPS(timestamp);

    releaseFrameWaiters();
    processRuntimeScripts();

    render();

    requestAnimationFrame(gameLoop);
}

window.addEventListener(
    "resize",
    resizeGame
);
