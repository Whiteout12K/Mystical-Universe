
function canvasColor(color){
    color=resolveValue(color);

    if(typeof color==="string"){
        ENGINE.background=color;
        ENGINE.backgroundImage=null;
        ENGINE.backgroundLoaded=false;
    }
}

function canvasCostume(path,scale=1){
    path=resolveValue(path);
    scale=Number(resolveValue(scale))||1;

    if(!path)return;

    const image=new Image();

    ENGINE.backgroundImage=image;
    ENGINE.backgroundScale=scale;
    ENGINE.backgroundLoaded=false;

    image.onload=()=>ENGINE.backgroundLoaded=true;

    image.onerror=()=>{
        ENGINE.backgroundLoaded=false;
        console.warn("Could not load background costume:",path);
    };

    image.src=path;
}