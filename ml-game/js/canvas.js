// Canvas Blocks

registerBlock("canvasColor",async block=>{
    const color=resolveValue(block.color);

    if(typeof color==="string")
        ENGINE.background=color;
});

registerBlock("canvasCostume",async block=>{
    const path=resolveValue(block.path);
    const scale=Number(resolveValue(block.scale))||1;

    if(path===""){
        ENGINE.backgroundImage=null;
        ENGINE.backgroundLoaded=false;
        ENGINE.backgroundScale=1;
        return;
    }

    const image=new Image();

    ENGINE.backgroundImage=image;
    ENGINE.backgroundScale=scale;
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