// Canvas Blocks

registerBlock("canvasColor",async block=>{
    const color=resolveValue(block.color);

    if(typeof color==="string")
        ENGINE.background=color;
});


registerBlock("canvasCostume",async block=>{
    const path=resolveValue(block.path);

    let scale=Number(
        resolveValue(block.scale)
    );

    if(!Number.isFinite(scale)||scale<=0)
        scale=1;

    if(path===""){
        ENGINE.backgroundImage=null;
        ENGINE.backgroundLoaded=false;
        ENGINE.backgroundScale=1;
        ENGINE.backgroundCostume="";
        ENGINE.backgroundEffects={
            brightness:0,
            ghost:0,
            color:0
        };
        return;
    }

    const image=new Image();

    ENGINE.backgroundImage=image;
    ENGINE.backgroundScale=scale;
    ENGINE.backgroundCostume=path;
    ENGINE.backgroundLoaded=false;

    image.onload=()=>{
        if(ENGINE.backgroundImage===image)
            ENGINE.backgroundLoaded=true;
    };

    image.onerror=()=>{
        if(ENGINE.backgroundImage===image){
            ENGINE.backgroundImage=null;
            ENGINE.backgroundLoaded=false;
        }

        console.warn(
            "Could not load background costume:",
            path
        );
    };

    image.src=path;
});


registerBlock("canvasSetSize",async block=>{
    let scale=Number(
        resolveValue(block.scale)
    );

    if(!Number.isFinite(scale)||scale<=0)
        scale=1;

    ENGINE.backgroundScale=scale;
});


registerBlock("canvasChangeSize",async block=>{
    let amount=Number(
        resolveValue(block.amount)
    );

    if(!Number.isFinite(amount))
        amount=0;

    ENGINE.backgroundScale=Math.max(
        0.01,
        (Number(ENGINE.backgroundScale)||1)+amount
    );
});


registerBlock("canvasEffect",async block=>{
    const effect=String(
        resolveValue(block.effect)
    ).toLowerCase();

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    value=Math.max(
        0,
        Math.min(100,value)
    );

    if(!ENGINE.backgroundEffects){
        ENGINE.backgroundEffects={
            brightness:0,
            ghost:0,
            color:0
        };
    }

    if(
        effect==="brightness"||
        effect==="ghost"||
        effect==="color"
    ){
        ENGINE.backgroundEffects[effect]=value;
    }
});


function canvasColor(color){
    const block=createBlock(
        "canvasColor",
        {color}
    );

    ENGINE.recordBlock(block);

    return block;
}


function canvasCostume(path,scale=1){
    const block=createBlock(
        "canvasCostume",
        {
            path,
            scale
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


function canvasSize(scale){
    return createCanvasSizeBlock(
        scale
    );
}


function createCanvasSizeBlock(scale){
    const block=createBlock(
        "canvasSetSize",
        {scale}
    );

    ENGINE.recordBlock(block);

    return block;
}


function canvasChangeSize(amount){
    const block=createBlock(
        "canvasChangeSize",
        {amount}
    );

    ENGINE.recordBlock(block);

    return block;
}


function canvasEffect(effect,value){
    const block=createBlock(
        "canvasEffect",
        {
            effect,
            value
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


function costumeOfCanvas(){
    return{
        type:"operator",
        operator:"canvasCostume",
        evaluate:()=>{
            return ENGINE.backgroundCostume??"";
        }
    };
}


function sizeOfCanvas(){
    return{
        type:"operator",
        operator:"canvasSize",
        evaluate:()=>{
            return Number(
                ENGINE.backgroundScale
            )||1;
        }
    };
}