// back-process.js

const ENGINE={
    width:640,height:360,centerX:0,centerY:0,viewWidth:640,viewHeight:360,unitScale:1,
    background:"#000000",backgroundImage:null,backgroundLoaded:false,backgroundScale:1,
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
            costumeVersion:0
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
            return;
        }

        this.costume=path;
        this.scale=scale;

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

        const effects=this.effects||{};

        const brightness=Math.max(
            0,
            Math.min(
                100,
                Number(effects.brightness)||0
            )
        );

        const ghost=Math.max(
            0,
            Math.min(
                100,
                Number(effects.ghost)||0
            )
        );

        const color=Math.max(
            0,
            Math.min(
                100,
                Number(effects.color)||0
            )
        );

        const opacity=Math.max(
            0,
            Math.min(
                1,
                Number(this.opacity)
            )
        );

        const drawWidth=
            this.width*
            ENGINE.unitScale;

        const drawHeight=
            this.height*
            ENGINE.unitScale;

        /*
            Effects are rendered identically on every device.

            World coordinates:
            +X = right
            +Y = up

            Canvas coordinates:
            +X = right
            +Y = down

            Y is inverted only during world-to-screen
            conversion.
        */

        const screenX=
            (this.x-ENGINE.camera.x)*
            ENGINE.unitScale+
            canvas.width/2;

        const screenY=
            -(this.y-ENGINE.camera.y)*
            ENGINE.unitScale+
            canvas.height/2;

        /*
            Use an offscreen canvas whenever effects are active.

            This keeps the effect pipeline independent from
            browser/device-specific canvas behavior.
        */

        if(
            brightness>0||
            ghost>0||
            color>0
        ){
            drawSpriteWithEffects(
                this,
                screenX,
                screenY,
                drawWidth,
                drawHeight,
                brightness,
                ghost,
                color,
                opacity
            );

            return;
        }

        ctx.save();

        ctx.globalAlpha=opacity;
        ctx.imageSmoothingEnabled=false;

        ctx.translate(
            screenX,
            screenY
        );

        ctx.rotate(
            this.rotation*Math.PI/180
        );

        ctx.scale(
            this.flipX,
            this.flipY
        );

        ctx.drawImage(
            this.image,
            -drawWidth/2,
            -drawHeight/2,
            drawWidth,
            drawHeight
        );

        ctx.restore();
    }
}


function drawSpriteWithEffects(
    sprite,
    screenX,
    screenY,
    drawWidth,
    drawHeight,
    brightness,
    ghost,
    color,
    opacity
){
    const width=Math.max(
        1,
        Math.ceil(drawWidth)
    );

    const height=Math.max(
        1,
        Math.ceil(drawHeight)
    );

    if(
        !sprite._effectCanvas||
        sprite._effectCanvas.width!==width||
        sprite._effectCanvas.height!==height
    ){
        sprite._effectCanvas=
            document.createElement("canvas");

        sprite._effectCanvas.width=width;
        sprite._effectCanvas.height=height;

        sprite._effectContext=
            sprite._effectCanvas.getContext(
                "2d",
                {willReadFrequently:false}
            );
    }

    const effectCanvas=sprite._effectCanvas;
    const effectCtx=sprite._effectContext;

    effectCtx.clearRect(
        0,
        0,
        width,
        height
    );

    effectCtx.save();

    effectCtx.imageSmoothingEnabled=false;

    effectCtx.drawImage(
        sprite.image,
        0,
        0,
        width,
        height
    );

    effectCtx.restore();

    /*
        Pixel processing is used for the effects so the same
        behavior is available regardless of desktop/mobile
        filter implementation.
    */

    if(
        brightness>0||
        color>0
    ){
        const imageData=
            effectCtx.getImageData(
                0,
                0,
                width,
                height
            );

        const data=imageData.data;

        const brightnessFactor=
            1+
            brightness/100;

        const hue=color*3.6;

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
                r=Math.min(
                    255,
                    r*brightnessFactor
                );

                g=Math.min(
                    255,
                    g*brightnessFactor
                );

                b=Math.min(
                    255,
                    b*brightnessFactor
                );
            }

            if(color>0){
                const hsv=rgbToHsv(
                    r,
                    g,
                    b
                );

                hsv.h=
                    (hsv.h+hue)%360;

                const rgb=hsvToRgb(
                    hsv.h,
                    hsv.s,
                    hsv.v
                );

                r=rgb.r;
                g=rgb.g;
                b=rgb.b;
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
    }

    ctx.save();

    ctx.globalAlpha=
        opacity*
        (1-ghost/100);

    ctx.imageSmoothingEnabled=false;

    ctx.translate(
        screenX,
        screenY
    );

    ctx.rotate(
        sprite.rotation*Math.PI/180
    );

    ctx.scale(
        sprite.flipX,
        sprite.flipY
    );

    ctx.drawImage(
        effectCanvas,
        -drawWidth/2,
        -drawHeight/2,
        drawWidth,
        drawHeight
    );

    ctx.restore();
}


function rgbToHsv(r,g,b){
    r/=255;
    g/=255;
    b/=255;

    const max=Math.max(r,g,b);
    const min=Math.min(r,g,b);

    const d=max-min;

    let h=0;

    if(d!==0){
        if(max===r){
            h=
                60*
                (
                    (
                        (g-b)/d
                    )%6
                );
        }else if(max===g){
            h=
                60*
                (
                    (b-r)/d+
                    2
                );
        }else{
            h=
                60*
                (
                    (r-g)/d+
                    4
                );
        }
    }

    if(h<0)
        h+=360;

    const s=
        max===0
            ?0
            :d/max;

    return{
        h,
        s,
        v:max
    };
}


function hsvToRgb(h,s,v){
    const c=v*s;
    const x=
        c*
        (
            1-
            Math.abs(
                (h/60)%2-1
            )
        );

    const m=v-c;

    let r=0;
    let g=0;
    let b=0;

    if(h<60){
        r=c;
        g=x;
    }else if(h<120){
        r=x;
        g=c;
    }else if(h<180){
        g=c;
        b=x;
    }else if(h<240){
        g=x;
        b=c;
    }else if(h<300){
        r=x;
        b=c;
    }else{
        r=c;
        b=x;
    }

    return{
        r:(r+m)*255,
        g:(g+m)*255,
        b:(b+m)*255
    };
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


/*
    PROGRAM RECORDING SYSTEM

    Every command created by main.js is placed into
    ENGINE.program.

    Containers later absorb their child blocks and remove
    them from the top-level program.

    This means nested commands are data only until their
    parent executes them.
*/

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

    Only ENGINE.program is executed here.

    Child blocks have already been absorbed by their
    containers and therefore cannot accidentally run.
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

    /*
        The same coordinate scaling system is used on
        desktop and mobile.

        There is no separate sprite/rendering path.
    */

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
            ENGINE.backgroundScale;

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

        ctx.imageSmoothingEnabled=false;

        ctx.drawImage(
            image,
            x,
            y,
            width*
            ENGINE.unitScale,
            height*
            ENGINE.unitScale
        );
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

        /*
            All external command files have now loaded.
            Execute the completed sequential program once.
        */

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