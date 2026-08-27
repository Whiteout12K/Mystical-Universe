// Control Blocks

function createControlBlock(type,data={}){
    const block=createBlock(type,data);
    ENGINE.recordBlock(block);
    return block;
}

function wait(time){
    return createControlBlock("wait",{time});
}

function waitUntil(condition){
    return createControlBlock("waitUntil",{condition});
}

function repeat(times,...blocks){
    const block=createControlBlock("repeat",{times,blocks});
    ENGINE.absorbBlocks(blocks);
    return block;
}

function forever(...blocks){
    const block=createControlBlock("forever",{blocks});
    ENGINE.absorbBlocks(blocks);
    return block;
}

function ifBlock(condition,...blocks){
    const split=blocks.indexOf("else");

    const block=createControlBlock(
        "if",
        split===-1
            ?{
                condition,
                thenBlocks:blocks,
                elseBlocks:[]
            }
            :{
                condition,
                thenBlocks:blocks.slice(0,split),
                elseBlocks:blocks.slice(split+1)
            }
    );

    ENGINE.absorbBlocks(
        split===-1
            ?blocks
            :blocks.slice(0,split).concat(
                blocks.slice(split+1)
            )
    );

    return block;
}

function repeatUntil(condition,...blocks){
    const block=createControlBlock(
        "repeatUntil",
        {
            condition,
            blocks
        }
    );

    ENGINE.absorbBlocks(blocks);
    return block;
}

function whileBlock(condition,...blocks){
    if(typeof condition==="string"){
        const value=condition.trim().toLowerCase();

        if(value==="true")
            condition=true;
        else if(value==="false")
            condition=false;
    }

    const block=createControlBlock(
        "while",
        {
            condition,
            blocks
        }
    );

    ENGINE.absorbBlocks(blocks);
    return block;
}

function endScript(){
    return createControlBlock("endScript");
}


// Event Blocks

function broadcast(message){
    const block=createControlBlock(
        "broadcast",
        {message}
    );

    return block;
}

function broadcastAndWait(message){
    return createControlBlock(
        "broadcastWait",
        {message}
    );
}

function whenBroadcast(message,...blocks){
    const value=resolveValue(message);

    const script=registerBroadcast(
        value,
        blocks
    );

    const block=createBlock(
        "broadcastScript",
        {
            message,
            blocks,
            script
        }
    );

    ENGINE.absorbBlocks(blocks);

    ENGINE.removeTopLevelBlock(block);

    return block;
}