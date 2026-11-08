/* World camera. JSON supplies defaults; these blocks change the live view. */
const CAMERA_DEFAULTS={x:0,y:0,zoom:1,follow:null,offsetX:0,offsetY:0,offscreenCulling:true};
let cameraDefaults={...CAMERA_DEFAULTS},cameraConfigPromise=null;
function validateCameraConfig(value){
    if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Camera config must be an object");
    const result={...CAMERA_DEFAULTS};
    for(const key of ["x","y","zoom","offsetX","offsetY"]){
        if(!(key in value))continue;
        if(typeof value[key]!=="number"||!Number.isFinite(value[key])||(key==="zoom"&&value[key]<=0))throw new Error("Invalid camera "+key);
        result[key]=value[key];
    }
    if("follow" in value){
        if(value.follow!==null&&typeof value.follow!=="string")throw new Error("Camera follow must be a sprite name or null");
        result.follow=value.follow;
    }
    if("offscreenCulling" in value){
        if(typeof value.offscreenCulling!=="boolean")throw new Error("offscreenCulling must be a boolean");
        result.offscreenCulling=value.offscreenCulling;
    }
    return result;
}
function loadCameraConfig(){
    if(cameraConfigPromise)return cameraConfigPromise;
    cameraConfigPromise=(async()=>{
        if(typeof fetch!=="function")return;
        const controller=new AbortController();
        const timeout=Number.isFinite(ENGINE.requestTimeout)?setTimeout(()=>controller.abort(),ENGINE.requestTimeout):null;
        try{
            const response=await fetch("/JScratch/camera.json",{signal:controller.signal,cache:"no-cache"});
            if(!response.ok)throw new Error("HTTP "+response.status);
            const data=await response.json();if(controller.signal.aborted)throw new Error("Camera config loading timed out");
            cameraDefaults=validateCameraConfig(data);
        }catch(error){console.warn("Using default camera:",error.message);}
        finally{if(timeout!==null)clearTimeout(timeout);}
    })();
    return cameraConfigPromise;
}
function updateCameraMetrics(){
    const zoom=ENGINE.camera.zoom;
    ENGINE.unitScale=ENGINE.baseUnitScale*zoom;
    ENGINE.viewWidth=ENGINE.baseViewWidth/zoom;
    ENGINE.viewHeight=ENGINE.baseViewHeight/zoom;
}
function resetCamera(){
    ENGINE.camera={...cameraDefaults};updateCameraMetrics();
}
function updateCamera(){
    const camera=ENGINE.camera;
    const target=typeof camera.follow==="string"?ENGINE.sprites[camera.follow]:camera.follow;
    target?.prepareFrame?.();
    if(target?.coordinateMode==="canvas")camera.follow=null;
    else if(target&&!target.deleted){camera.x=target.x+camera.offsetX;camera.y=target.y+camera.offsetY;}
    else if(target?.deleted&&typeof camera.follow!=="string")camera.follow=null;
    updateCameraMetrics();
}
function cameraNumber(value,c,label){
    const n=Number(resolveValue(value,c));if(!Number.isFinite(n))throw new Error("Camera "+label+" must be finite");return n;
}
const recordCamera=(type,data={})=>ENGINE.recordBlock(createBlock(type,data));
function cameraTo(x,y){return recordCamera("cameraTo",{x,y});}
function cameraBy(x,y){return recordCamera("cameraBy",{x,y});}
function cameraToSprite(name){return recordCamera("cameraToSprite",{name});}
function cameraFollow(name,offsetX=0,offsetY=0){return recordCamera("cameraFollow",{name,offsetX,offsetY});}
function cameraStopFollowing(){return recordCamera("cameraStopFollowing");}
function cameraZoom(zoom){return arguments.length?recordCamera("cameraZoom",{zoom}):createReporter("cameraZoomValue");}
function cameraX(){return createReporter("cameraX");}
function cameraY(){return createReporter("cameraY");}
function cameraReset(){return recordCamera("cameraReset");}
registerBlock("cameraTo",(b,c)=>{
    const x=cameraNumber(b.x,c,"x"),y=cameraNumber(b.y,c,"y");
    Object.assign(ENGINE.camera,{x,y,follow:null});
});
registerBlock("cameraBy",(b,c)=>{
    const x=cameraNumber(b.x,c,"x"),y=cameraNumber(b.y,c,"y");
    updateCamera();Object.assign(ENGINE.camera,{x:ENGINE.camera.x+x,y:ENGINE.camera.y+y,follow:null});
});
registerBlock("cameraToSprite",(b,c)=>{
    const target=getContextSprite(b.name,c);if(!target||target.deleted)return;
    const position=getSpriteWorldGeometry(target);
    Object.assign(ENGINE.camera,{x:position.x,y:position.y,follow:null});
});
registerBlock("cameraFollow",(b,c)=>{
    const offsetX=cameraNumber(b.offsetX,c,"offsetX"),offsetY=cameraNumber(b.offsetY,c,"offsetY");
    const value=resolveValue(b.name,c),target=getContextSprite(value,c),name=String(value);
    if(target?.coordinateMode==="canvas")throw new Error("Camera following requires a world-coordinate sprite");
    Object.assign(ENGINE.camera,{follow:target?.isClone?target:name,offsetX,offsetY});updateCamera();
});
registerBlock("cameraStopFollowing",()=>{updateCamera();ENGINE.camera.follow=null;});
registerBlock("cameraZoom",(b,c)=>{
    const zoom=cameraNumber(b.zoom,c,"zoom");if(zoom<=0)throw new Error("Camera zoom must be greater than zero");
    ENGINE.camera.zoom=zoom;updateCameraMetrics();
});
registerBlock("cameraReset",resetCamera);
registerReporter("cameraX",()=>{updateCamera();return ENGINE.camera.x;});
registerReporter("cameraY",()=>{updateCamera();return ENGINE.camera.y;});
registerReporter("cameraZoomValue",()=>ENGINE.camera.zoom);
function spriteInCameraView(sprite){
    sprite=getSpriteWorldGeometry(sprite);
    const angle=sprite.rotation*Math.PI/180;
    const width=Math.abs(sprite.width*sprite.flipX),height=Math.abs(sprite.height*sprite.flipY);
    const halfWidth=(Math.abs(Math.cos(angle))*width+Math.abs(Math.sin(angle))*height)/2;
    const halfHeight=(Math.abs(Math.sin(angle))*width+Math.abs(Math.cos(angle))*height)/2;
    const camera=ENGINE.camera,pad=1/ENGINE.unitScale;
    return sprite.x+halfWidth>=camera.x-ENGINE.viewWidth/2-pad&&sprite.x-halfWidth<=camera.x+ENGINE.viewWidth/2+pad&&
        sprite.y+halfHeight>=camera.y-ENGINE.viewHeight/2-pad&&sprite.y-halfHeight<=camera.y+ENGINE.viewHeight/2+pad;
}
resetCamera();
