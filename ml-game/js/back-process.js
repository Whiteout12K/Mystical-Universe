// back-process.js

const ENGINE={
    width:640,height:360,centerX:0,centerY:0,viewWidth:640,viewHeight:360,unitScale:1,
    background:"#000000",backgroundImage:null,backgroundLoaded:false,backgroundScale:1,backgroundCostume:"",
    backgroundEffects:{brightness:0,ghost:0,color:0},
    sprites:{},sounds:{},variables:{},running:true,lastTime:0,deltaTime:0,camera:{x:0,y:0},
    scripts:[],program:[],broadcasts:{},blocks:{},mobile:false,buildingBlock:false,_blockId:0,
    audioContext:null,audioUnlocked:false,audioPending:[],masterGain:null,
    backgroundEffectCanvas:null,backgroundEffectCacheKey:null,
    spriteList:[],spriteOrderDirty:true,
    runtimeScripts:[],frame:0,fps:0,
    _fpsTime:0,_fpsFrames:0,
    _schedulerBusy:false
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


/* GAME VALUES */

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


/* BLOCK REGISTRATION */

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


/* PROGRAM MANAGEMENT */

ENGINE.recordBlock=block=>{
    if(
        block&&
        typeof block==="object"&&
        !ENGINE.program.includes(block)
    )
        ENGINE.program.push(block);

    return block;
};

ENGINE.removeTopLevelBlock=block=>{
    const index=ENGINE.program.indexOf(block);

    if(index!==-1)
        ENGINE.program.splice(index,1);
};

ENGINE.absorbBlocks=blocks=>{
    if(Array.isArray(blocks))
        blocks.forEach(ENGINE.absorbBlock);
};

ENGINE.absorbBlock=block=>{
    if(!block||typeof block!=="object")
        return;

    ENGINE.removeTopLevelBlock(block);
    absorbNested(block);
};

function absorbNested(block){
    if(!block||typeof block!=="object")
        return;

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
    if(!block||typeof block!=="object")
        return;

    block._handled=true;

    Object.values(block).forEach(value=>{
        if(Array.isArray(value))
            value.forEach(markBlockTreeHandled);
        else if(value?.type)
            markBlockTreeHandled(value);
    });
}


/* CONTROL BLOCKS */

registerBlock("repeat",async(block,context)=>{
    const times=Math.max(
        0,
        Math.floor(Number(resolveValue(block.times))||0)
    );

    for(
        let i=0;
        i<times&&ENGINE.running&&!context.ended;
        i++
    )
        await executeBlocks(block.blocks,context);
});

registerBlock("forever",async(block,context)=>{
    while(ENGINE.running&&!context.ended){
        await executeBlocks(block.blocks,context);
        await waitForNextFrame();
    }
});

registerBlock("if",async(block,context)=>{
    await executeBlocks(
        resolveValue(block.condition)
            ?block.thenBlocks
            :block.elseBlocks,
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
        await waitForNextFrame();
    }
});

registerBlock("while",async(block,context)=>{
    while(
        ENGINE.running&&
        !context.ended&&
        resolveValue(block.condition)
    ){
        await executeBlocks(block.blocks,context);
        await waitForNextFrame();
    }
});

registerBlock("wait",async block=>{
    const seconds=Math.max(
        0,
        Number(resolveValue(block.time))||0
    );

    if(seconds<=0){
        await waitForNextFrame();
        return;
    }

    await new Promise(resolve=>{
        setTimeout(resolve,seconds*1000);
    });
});

registerBlock("waitUntil",async(block,context)=>{
    while(
        ENGINE.running&&
        !context.ended&&
        !resolveValue(block.condition)
    )
        await waitForNextFrame();
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


/* PUBLIC API */

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


/* START */

window.addEventListener("load",()=>{
    resizeGame();
    initAudio();
    runScripts();
    requestAnimationFrame(gameLoop);
});
