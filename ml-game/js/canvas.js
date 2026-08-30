// Canvas Blocks

registerBlock("canvasColor",async(b,c)=>{
    const v=resolveValue(b.color,c);
    if(typeof v==="string")ENGINE.background=v;
});

registerBlock("canvasCostume",async(b,c)=>{
    const path=resolveValue(b.path,c),scale=Number(resolveValue(b.scale,c))||1;
    if(path===""){
        ENGINE.backgroundImage=null;
        ENGINE.backgroundLoaded=false;
        ENGINE.backgroundScale=1;
        ENGINE.backgroundCostume="";
        ENGINE.backgroundEffectCacheKey=null;
        return;
    }

    const image=new Image();
    ENGINE.backgroundImage=image;
    ENGINE.backgroundScale=scale;
    ENGINE.backgroundCostume=path;
    ENGINE.backgroundLoaded=false;
    ENGINE.backgroundEffectCacheKey=null;

    image.onload=()=>{
        if(ENGINE.backgroundImage===image){
            ENGINE.backgroundLoaded=true;
            ENGINE.backgroundEffectCacheKey=null;
        }
    };

    image.onerror=()=>{
        if(ENGINE.backgroundImage===image){
            ENGINE.backgroundImage=null;
            ENGINE.backgroundLoaded=false;
            ENGINE.backgroundCostume="";
            ENGINE.backgroundEffectCacheKey=null;
        }
        console.warn("Could not load background costume:",path);
    };

    image.src=path;
});

const recordCanvas=(type,data)=>ENGINE.recordBlock(createBlock(type,data));

function canvasColor(color){return recordCanvas("canvasColor",{color});}
function canvasCostume(path,scale=1){return recordCanvas("canvasCostume",{path,scale});}