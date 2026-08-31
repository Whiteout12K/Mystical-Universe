// Control Blocks

const createControlBlock=(type,data={})=>{
    const b=createBlock(type,data);
    ENGINE.recordBlock(b);
    return b;
};

const control=(type,data,absorb=true)=>{
    const b=createControlBlock(type,data);
    if(absorb)ENGINE.absorbBlocks(data.blocks);
    return b;
};

function wait(time){
    return createControlBlock("wait",{time});
}

function waitUntil(condition){
    return createControlBlock("waitUntil",{condition});
}

function repeat(times,...blocks){
    return control("repeat",{times,blocks});
}

function forever(...blocks){
    return control("forever",{blocks});
}

function ifBlock(condition,...blocks){
    const i=blocks.indexOf("else");
    const thenBlocks=i<0?blocks:blocks.slice(0,i);
    const elseBlocks=i<0?[]:blocks.slice(i+1);
    return control("if",{condition,thenBlocks,elseBlocks},false);
}

function repeatUntil(condition,...blocks){
    return control("repeatUntil",{condition,blocks});
}

function whileBlock(condition,...blocks){
    if(typeof condition==="string"){
        const v=condition.trim().toLowerCase();
        if(v==="true")condition=true;
        else if(v==="false")condition=false;
    }
    return control("while",{condition,blocks});
}

function endScript(){
    return createControlBlock("endScript");
}


/* EVENT BLOCKS */

function broadcast(message){
    return createControlBlock("broadcast",{message});
}

function broadcastAndWait(message){
    return createControlBlock("broadcastWait",{message});
}

function whenBroadcast(message,...blocks){
    const block=createBlock("broadcastScript",{message,blocks});
    const script=registerBroadcast(resolveValue(message),blocks);
    block.script=script;
    ENGINE.absorbBlocks(blocks);
    ENGINE.removeTopLevelBlock(block);
    return block;
}