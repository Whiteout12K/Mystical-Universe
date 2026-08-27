// back-process.js

const ENGINE={
    width:640,height:360,centerX:0,centerY:0,viewWidth:640,viewHeight:360,unitScale:1,
    background:"#000000",backgroundImage:null,backgroundLoaded:false,backgroundScale:1,
    backgroundCostume:"",
    backgroundEffects:{
        brightness:0,
        ghost:0,
        color:0
    },
    sprites:{},variables:{},running:true,lastTime:0,deltaTime:0,camera:{x:0,y:0},
    scripts:[],program:[],broadcasts:{},blocks:{},mobile:false,buildingBlock:false,
    _blockId:0
};

const canvas=document.getElementById("game-canvas");
const ctx=canvas.getContext("2d",{alpha:false});
ctx.imageSmoothingEnabled=false;

document.documentElement.style.touchAction="none";
document.body.style.touchAction="none";
canvas.style.touchAction="none";
canvas.style.userSelect="none";
canvas.style.webkitUserSelect="none";
canvas.style.webkitTouchCallout="none";

["gesturestart","gesturechange","gestureend"].forEach(event=>{
    document.addEventListener(
        event,
        e=>e.preventDefault(),
        {passive:false}
    );
});

document.addEventListener(
    "wheel",
    e=>{
        if(e.ctrlKey)
            e.preventDefault();
    },
    {passive:false}
);

document.addEventListener(
    "touchmove",
    e=>{
        if(e.touches.length>1)
            e.preventDefault();
    },
    {passive:false}
);


function clamp(value,min,max){
    return Math.max(
        min,
        Math.min(max,value)
    );
}


function rgbToHsl(r,g,b){
    r/=255;
    g/=255;
    b/=255;

    const max=Math.max(r,g,b);
    const min=Math.min(r,g,b);

    let h=0;
    let s=0;

    const l=(max+min)/2;

    if(max!==min){
        const d=max-min;

        s=l>0.5
            ?d/(2-max-min)
            :d/(max+min);

        switch(max){
            case r:
                h=(g-b)/d+(g<b?6:0);
                break;

            case g:
                h=(b-r)/d+2;
                break;

            case b:
                h=(r-g)/d+4;
                break;
        }

        h/=6;
    }

    return[h,s,l];
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
    let r;
    let g;
    let b;

    if(s===0){
        r=l;
        g=l;
        b=l;
    }else{
        const q=
            l<0.5
                ?l*(1+s)
                :l+s-l*s;

        const p=2*l-q;

        r=hueToRgb(p,q,h+1/3);
        g=hueToRgb(p,q,h);
        b=hueToRgb(p,q,h-1/3);
    }

    return[
        Math.round(r*255),
        Math.round(g*255),
        Math.round(b*255)
    ];
}


function createEffectCanvas(sprite){
    if(!sprite.effectCanvas)
        sprite.effectCanvas=document.createElement("canvas");

    const width=Math.max(
        1,
        Math.ceil(sprite.width)
    );

    const height=Math.max(
        1,
        Math.ceil(sprite.height)
    );

    const effectCanvas=sprite.effectCanvas;

    if(
        effectCanvas.width!==width||
        effectCanvas.height!==height
    ){
        effectCanvas.width=width;
        effectCanvas.height=height;
        sprite.effectCacheKey=null;
    }

    return effectCanvas;
}


function applySpriteEffects(sprite){
    const effects=sprite.effects||{};

    const brightness=clamp(
        Number(effects.brightness)||0,
        0,
        100
    );

    const color=clamp(
        Number(effects.color)||0,
        0,
        100
    );

    const ghost=clamp(
        Number(effects.ghost)||0,
        0,
        100
    );

    const image=sprite.image;

    if(!image||!image.naturalWidth)
        return null;

    if(
        brightness===0&&
        color===0
    ){
        sprite.effectCacheKey=null;
        return image;
    }

    const effectCanvas=createEffectCanvas(sprite);

    const key=[
        sprite.costume,
        sprite.width,
        sprite.height,
        brightness,
        color
    ].join("|");

    if(sprite.effectCacheKey===key)
        return effectCanvas;

    const effectCtx=
        effectCanvas.getContext(
            "2d",
            {willReadFrequently:true}
        );

    effectCtx.clearRect(
        0,
        0,
        effectCanvas.width,
        effectCanvas.height
    );

    effectCtx.imageSmoothingEnabled=false;

    effectCtx.drawImage(
        image,
        0,
        0,
        effectCanvas.width,
        effectCanvas.height
    );

    if(brightness===0&&color===0){
        sprite.effectCacheKey=key;
        return effectCanvas;
    }

    let imageData;

    try{
        imageData=effectCtx.getImageData(
            0,
            0,
            effectCanvas.width,
            effectCanvas.height
        );
    }catch(error){
        console.warn(
            "Unable to process sprite effects:",
            error
        );

        sprite.effectCacheKey=null;
        return image;
    }

    const data=imageData.data;

    const brightnessMultiplier=
        1+brightness/100;

    const hueShift=
        color/100;

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

            hsl[0]=
                (hsl[0]+hueShift)%1;

            const rgb=hslToRgb(
                hsl[0],
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

    sprite.effectCacheKey=key;

    return effectCanvas;
}


function createCanvasEffectCanvas(){
    if(!ENGINE.backgroundEffectCanvas)
        ENGINE.backgroundEffectCanvas=
            document.createElement("canvas");

    return ENGINE.backgroundEffectCanvas;
}


function applyCanvasEffects(){
    const image=ENGINE.backgroundImage;

    if(!image||!image.naturalWidth)
        return null;

    const effects=
        ENGINE.backgroundEffects||{};

    const brightness=clamp(
        Number(effects.brightness)||0,
        0,
        100
    );

    const color=clamp(
        Number(effects.color)||0,
        0,
        100
    );

    const ghost=clamp(
        Number(effects.ghost)||0,
        0,
        100
    );

    if(
        brightness===0&&
        color===0
    ){
        ENGINE.backgroundEffectCacheKey=null;

        return{
            source:image,
            ghost
        };
    }

    const width=Math.max(
        1,
        Math.ceil(image.naturalWidth)
    );

    const height=Math.max(
        1,
        Math.ceil(image.naturalHeight)
    );

    const effectCanvas=
        createCanvasEffectCanvas();

    if(
        effectCanvas.width!==width||
        effectCanvas.height!==height
    ){
        effectCanvas.width=width;
        effectCanvas.height=height;
        ENGINE.backgroundEffectCacheKey=null;
    }

    const key=[
        ENGINE.backgroundCostume,
        width,
        height,
        brightness,
        color
    ].join("|");

    if(
        ENGINE.backgroundEffectCacheKey!==key
    ){
        const effectCtx=
            effectCanvas.getContext(
                "2d",
                {willReadFrequently:true}
            );

        effectCtx.clearRect(
            0,
            0,
            width,
            height
        );

        effectCtx.imageSmoothingEnabled=false;

        effectCtx.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        let imageData;

        try{
            imageData=effectCtx.getImageData(
                0,
                0,
                width,
                height
            );
        }catch(error){
            console.warn(
                "Unable to process canvas effects:",
                error
            );

            ENGINE.backgroundEffectCacheKey=null;

            return{
                source:image,
                ghost
            };
        }

        const data=imageData.data;

        const brightnessMultiplier=
            1+brightness/100;

        const hueShift=
            color/100;

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
                    Math.round(
                        r*brightnessMultiplier
                    ),
                    0,
                    255
                );

                g=clamp(
                    Math.round(
                        g*brightnessMultiplier
                    ),
                    0,
                    255
                );

                b=clamp(
                    Math.round(
                        b*brightnessMultiplier
                    ),
                    0,
                    255
                );
            }

            if(color>0){
                const hsl=rgbToHsl(
                    r,
                    g,
                    b
                );

                hsl[0]=
                    (hsl[0]+hueShift)%1;

                const rgb=hslToRgb(
                    hsl[0],
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

        ENGINE.backgroundEffectCacheKey=key;
    }

    return{
        source:effectCanvas,
        ghost
    };
}


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
            effectCacheKey:null
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
            return;
        }

        this.costume=path;
        this.scale=scale;
        this.effectCacheKey=null;

        const cached=this.imageCache[path];

        if(cached){
            this.image=cached;

            if(cached.complete&&cached.naturalWidth>0){
                this.loaded=true;
                this.updateSize();
                updateEdgeSprite(this);
            }else{
                this.loaded=false;
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
                console.warn("Could not load costume:",path);

            if(this.costume===path)
                this.loaded=false;
        };

        image.src=path;
    }

    updateSize(){
        if(!this.image||!this.image.naturalWidth)
            return;

        this.width=160*this.scale;
        this.height=
            this.width*
            (
                this.image.naturalHeight/
                this.image.naturalWidth
            );

        this.effectCacheKey=null;
    }

    setScale(scale){
        scale=Number(scale);

        if(!Number.isFinite(scale)||scale<=0)
            scale=1;

        this.scale=scale;
        this.updateSize();
        updateEdgeSprite(this);
    }

    draw(){
        if(!this.visible||!this.loaded)
            return;

        ctx.save();

        const effects=this.effects||{};

        const ghost=clamp(
            Number(effects.ghost)||0,
            0,
            100
        );

        const source=
            applySpriteEffects(this);

        if(!source){
            ctx.restore();
            return;
        }

        ctx.globalAlpha=
            clamp(
                Number(this.opacity)||0,
                0,
                1
            )*
            (1-ghost/100);

        ctx.imageSmoothingEnabled=false;

        ctx.translate(
            (this.x-ENGINE.camera.x)*ENGINE.unitScale+
            canvas.width/2,
            -(this.y-ENGINE.camera.y)*ENGINE.unitScale+
            canvas.height/2
        );

        ctx.rotate(
            this.rotation*Math.PI/180
        );

        ctx.scale(
            this.flipX,
            this.flipY
        );

        ctx.drawImage(
            source,
            -this.width*ENGINE.unitScale/2,
            -this.height*ENGINE.unitScale/2,
            this.width*ENGINE.unitScale,
            this.height*ENGINE.unitScale
        );

        ctx.restore();
    }
}


function resolveValue(value){
    if(value===null||value===undefined)
        return"";

    if(typeof value==="object"){
        if(value.type==="variable")
            return ENGINE.variables[value.name]??"";

        if(value.type==="join"){
            return(value.values||[])
                .map(resolveValue)
                .join("");
        }

        if(value.type==="value")
            return resolveValue(value.value);

        if(value.type==="operator"){
            const block=ENGINE.blocks[value.operator];

            if(block?.reporter)
                return block.reporter(value);

            if(typeof value.evaluate==="function")
                return value.evaluate();
        }
    }

    return value;
}


function registerBlock(type,handler,options={}){
    if(typeof type!=="string"||!type)
        return;

    ENGINE.blocks[type]={
        execute:
            typeof handler==="function"
                ?handler
                :null,

        reporter:
            typeof options.reporter==="function"
                ?options.reporter
                :null
    };
}


function registerReporter(type,evaluate){
    registerBlock(
        type,
        null,
        {reporter:evaluate}
    );
}


function createBlock(type,data={}){
    return Object.assign(
        {
            type,
            _id:++ENGINE._blockId,
            _handled:false
        },
        data
    );
}


function createReporter(type,data={}){
    return Object.assign(
        {
            type:"operator",
            operator:type
        },
        data
    );
}


ENGINE.recordBlock=function(block){
    if(
        !block||
        typeof block!=="object"
    )
        return block;

    if(!ENGINE.program.includes(block))
        ENGINE.program.push(block);

    return block;
};


ENGINE.removeTopLevelBlock=function(block){
    if(!block)
        return;

    const index=ENGINE.program.indexOf(block);

    if(index!==-1)
        ENGINE.program.splice(index,1);
};


ENGINE.absorbBlocks=function(blocks){
    if(!Array.isArray(blocks))
        return;

    for(const block of blocks)
        ENGINE.absorbBlock(block);
};


ENGINE.absorbBlock=function(block){
    if(
        !block||
        typeof block!=="object"
    )
        return;

    ENGINE.removeTopLevelBlock(block);

    absorbNested(block);
};


function absorbNested(block){
    if(!block||typeof block!=="object")
        return;

    for(const key of Object.keys(block)){
        if(
            key==="_id"||
            key==="_handled"
        )
            continue;

        const value=block[key];

        if(Array.isArray(value)){
            for(const child of value){
                if(
                    child&&
                    typeof child==="object"&&
                    child.type
                ){
                    ENGINE.removeTopLevelBlock(child);
                    absorbNested(child);
                }
            }
        }else if(
            value&&
            typeof value==="object"&&
            value.type
        ){
            ENGINE.removeTopLevelBlock(value);
            absorbNested(value);
        }
    }
};


function markBlockTreeHandled(block){
    if(!block||typeof block!=="object")
        return;

    block._handled=true;

    for(const key of Object.keys(block)){
        const value=block[key];

        if(Array.isArray(value)){
            value.forEach(markBlockTreeHandled);
        }else if(
            value&&
            typeof value==="object"&&
            value.type
        ){
            markBlockTreeHandled(value);
        }
    }
}


function updateEdgeSprite(sprite){
    if(!sprite||!sprite.edgeLock)
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

    if(minX<=maxX){
        sprite.x=Math.max(
            minX,
            Math.min(maxX,sprite.x)
        );
    }else{
        sprite.x=ENGINE.camera.x;
    }

    if(minY<=maxY){
        sprite.y=Math.max(
            minY,
            Math.min(maxY,sprite.y)
        );
    }else{
        sprite.y=ENGINE.camera.y;
    }
}


function updateEdgeSprites(){
    Object.values(ENGINE.sprites)
        .forEach(updateEdgeSprite);
}


function createScriptContext(){
    return{
        ended:false
    };
}


function registerBroadcast(message,blocks){
    const key=String(
        resolveValue(message)
    );

    if(!ENGINE.broadcasts[key])
        ENGINE.broadcasts[key]=[];

    const script={
        blocks:Array.isArray(blocks)
            ?blocks
            :[],
        registered:true
    };

    ENGINE.broadcasts[key].push(script);

    return script;
}


function broadcastMessage(message){
    const key=String(
        resolveValue(message)
    );

    const listeners=ENGINE.broadcasts[key];

    if(!listeners?.length)
        return;

    listeners.forEach(listener=>{
        const context=createScriptContext();

        Promise.resolve()
            .then(()=>{
                return executeBlocks(
                    listener.blocks,
                    context
                );
            })
            .catch(error=>{
                console.error(
                    "Broadcast script error:",
                    error
                );
            });
    });
}


async function broadcastAndWaitMessage(message){
    const key=String(
        resolveValue(message)
    );

    const listeners=ENGINE.broadcasts[key];

    if(!listeners?.length)
        return;

    await Promise.all(
        listeners.map(listener=>{
            const context=createScriptContext();

            return executeBlocks(
                listener.blocks,
                context
            );
        })
    );
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

    const registered=ENGINE.blocks[block.type];

    if(!registered?.execute)
        return;

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


/*
    CONTROL EXECUTION
*/

registerBlock(
    "repeat",
    async(block,context)=>{
        const times=Math.max(
            0,
            Math.floor(
                Number(
                    resolveValue(block.times)
                )||0
            )
        );

        for(
            let i=0;
            i<times&&
            ENGINE.running&&
            !context.ended;
            i++
        ){
            await executeBlocks(
                block.blocks,
                context
            );
        }
    }
);


registerBlock(
    "forever",
    async(block,context)=>{
        while(
            ENGINE.running&&
            !context.ended
        ){
            await executeBlocks(
                block.blocks,
                context
            );

            await new Promise(
                resolve=>setTimeout(resolve,0)
            );
        }
    }
);


registerBlock(
    "if",
    async(block,context)=>{
        const condition=!!resolveValue(
            block.condition
        );

        if(condition){
            await executeBlocks(
                block.thenBlocks,
                context
            );
        }else{
            await executeBlocks(
                block.elseBlocks,
                context
            );
        }
    }
);


registerBlock(
    "repeatUntil",
    async(block,context)=>{
        while(
            ENGINE.running&&
            !context.ended&&
            !resolveValue(block.condition)
        ){
            await executeBlocks(
                block.blocks,
                context
            );

            await new Promise(
                resolve=>setTimeout(resolve,0)
            );
        }
    }
);


registerBlock(
    "while",
    async(block,context)=>{
        while(
            ENGINE.running&&
            !context.ended&&
            !!resolveValue(block.condition)
        ){
            await executeBlocks(
                block.blocks,
                context
            );

            await new Promise(
                resolve=>setTimeout(resolve,0)
            );
        }
    }
);


registerBlock(
    "wait",
    async block=>{
        const seconds=Math.max(
            0,
            Number(
                resolveValue(block.time)
            )||0
        );

        await new Promise(
            resolve=>{
                setTimeout(
                    resolve,
                    seconds*1000
                );
            }
        );
    }
);


registerBlock(
    "waitUntil",
    async(block,context)=>{
        while(
            ENGINE.running&&
            !context.ended&&
            !resolveValue(block.condition)
        ){
            await new Promise(
                resolve=>setTimeout(resolve,16)
            );
        }
    }
);


registerBlock(
    "broadcast",
    async block=>{
        broadcastMessage(
            resolveValue(block.message)
        );
    }
);


registerBlock(
    "broadcastWait",
    async block=>{
        await broadcastAndWaitMessage(
            resolveValue(block.message)
        );
    }
);


registerBlock(
    "broadcastScript",
    async(block,context)=>{
        await executeBlocks(
            block.blocks,
            context
        );
    }
);


/*
    TOP-LEVEL PROGRAM EXECUTION
*/

async function executeProgram(){
    const context=createScriptContext();

    ENGINE.scripts=ENGINE.program.slice();

    try{
        await executeBlocks(
            ENGINE.program,
            context
        );
    }catch(error){
        console.error(
            "Main program error:",
            error
        );
    }
}


function runScripts(){
    executeProgram();
}


function startStandaloneBlock(block){
    if(!block)
        return block;

    ENGINE.recordBlock(block);

    return block;
}


/*
    CANVAS RESIZING

    This section is intentionally unchanged.
*/

function resizeGame(){
    const width=Math.max(
        1,
        window.innerWidth
    );

    const height=Math.max(
        1,
        window.innerHeight
    );

    const mobile=width<700;

    ENGINE.mobile=mobile;

    canvas.width=Math.ceil(width);
    canvas.height=Math.ceil(height);

    canvas.style.width=width+"px";
    canvas.style.height=height+"px";

    if(mobile){
        ENGINE.viewHeight=360;
        ENGINE.viewWidth=
            ENGINE.viewHeight*
            (width/height);

        ENGINE.unitScale=
            height/
            ENGINE.viewHeight;
    }else{
        ENGINE.unitScale=
            Math.min(
                width/640,
                height/360
            );

        ENGINE.viewWidth=
            width/
            ENGINE.unitScale;

        ENGINE.viewHeight=
            height/
            ENGINE.unitScale;
    }

    ENGINE.centerX=
        ENGINE.viewWidth/2;

    ENGINE.centerY=
        ENGINE.viewHeight/2;

    ENGINE.width=
        ENGINE.viewWidth;

    ENGINE.height=
        ENGINE.viewHeight;

    ctx.imageSmoothingEnabled=false;

    updateEdgeSprites();
}


function drawBackground(){
    if(
        ENGINE.backgroundLoaded&&
        ENGINE.backgroundImage
    ){
        const image=
            ENGINE.backgroundImage;

        const width=
            640*
            (Number(
                ENGINE.backgroundScale
            )||1);

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

        const effect=
            applyCanvasEffects();

        ctx.save();

        if(effect){
            ctx.globalAlpha=
                1-
                clamp(
                    Number(effect.ghost)||0,
                    0,
                    100
                )/100;

            ctx.imageSmoothingEnabled=false;

            ctx.drawImage(
                effect.source,
                x,
                y,
                width*
                ENGINE.unitScale,
                height*
                ENGINE.unitScale
            );
        }

        ctx.restore();

    }else{
        ctx.fillStyle=
            ENGINE.background;

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }
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

    Object.values(ENGINE.sprites)
        .sort((a,b)=>a.layer-b.layer)
        .forEach(sprite=>sprite.draw());
}


function gameLoop(timestamp){
    if(!ENGINE.running)
        return;

    if(!ENGINE.lastTime)
        ENGINE.lastTime=timestamp;

    ENGINE.deltaTime=
        (timestamp-ENGINE.lastTime)/1000;

    ENGINE.lastTime=timestamp;

    render();

    requestAnimationFrame(gameLoop);
}


window.addEventListener(
    "resize",
    resizeGame
);


window.addEventListener(
    "load",
    ()=>{
        resizeGame();

        runScripts();

        requestAnimationFrame(gameLoop);
    }
);


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
