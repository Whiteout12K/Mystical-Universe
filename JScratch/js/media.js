/* Shared costume frames, GIF playback, pixel rendering, and readable alpha masks. */
const imageMedia=new WeakMap(),imagePixelCache=new WeakMap();

function applyRenderSettings(){
    ctx.imageSmoothingEnabled=false;
    ctx.imageSmoothingQuality="high";
    canvas.style.imageRendering="pixelated";
}
function configureRuntime(options={}){
    const changes={};
    for(const key of ["maxClones","requestTimeout","budgetLimit","budgetMs"]){
        if(!(key in options))continue;
        const value=Number(options[key]);
        if(!(value>0))throw new Error(key+" must be positive");
        changes[key]=value;
    }
    // Keep legacy media options compatible; these features are now always on.
    Object.assign(ENGINE,changes,{pixelCrisp:true,gifAutoPlay:true});applyRenderSettings();
}
function setPixelCrisp(enabled=true){return ENGINE.recordBlock(createBlock("setPixelCrisp",{enabled}));}
function setGifAutoPlay(enabled=true){return ENGINE.recordBlock(createBlock("setGifAutoPlay",{enabled}));}
function mediaBoolean(value,c){
    const v=resolveValue(value,c);
    return typeof v==="string"?!["","false","0"].includes(v.trim().toLowerCase()):Boolean(v);
}
registerBlock("setPixelCrisp",(b,c)=>configureRuntime({pixelCrisp:mediaBoolean(b.enabled,c)}));
registerBlock("setGifAutoPlay",(b,c)=>configureRuntime({gifAutoPlay:mediaBoolean(b.enabled,c)}));

async function prepareImageAnimation(asset,path){
    imageMedia.set(asset.image,asset);
    if(!/\.gif(?:$|[?#])/i.test(path)&&!/^data:image\/gif[;,]/i.test(path))return;
    const controller=new AbortController();
    const timeout=Number.isFinite(ENGINE.requestTimeout)?setTimeout(()=>controller.abort(),ENGINE.requestTimeout):null;
    try{
        const response=await fetch(path,{signal:controller.signal});
        if(!response.ok)throw new Error("HTTP "+response.status);
        const data=await response.arrayBuffer();
        if(controller.signal.aborted)throw new Error("GIF loading timed out");
        const animation=createGifAnimation(JScratchGIF.parseGIF(data));
        animation.frame(ENGINE.animationClock);asset.animation=animation;
    }catch(error){
        // The native image remains usable even if GIF decoding is unavailable.
        console.warn("GIF animation unavailable:",path,error.message);
    }finally{if(timeout!==null)clearTimeout(timeout);}
}
function createGifAnimation(gif){
    const frames=gif.frames.filter(frame=>frame.image);
    if(!frames.length)throw new Error("GIF has no image frames");
    const surface=document.createElement("canvas"),patch=document.createElement("canvas");
    surface.width=gif.lsd.width;surface.height=gif.lsd.height;
    const context=surface.getContext("2d",{willReadFrequently:true});
    const ends=[];let duration=0;
    for(const frame of frames){duration+=Math.max(20,(frame.gce?.delay||10)*10);ends.push(duration);}
    const app=gif.frames.find(frame=>/^(NETSCAPE2.0|ANIMEXTS1.0)$/.test(frame.application?.id))?.application;
    const repeats=app?(app.blocks[1]|app.blocks[2]<<8):0;
    const iterations=app?(repeats?repeats+1:Infinity):1;
    const transparent=frames.some(frame=>frame.gce?.extras.transparentColorGiven);
    const background=!transparent&&gif.gct?.[gif.lsd.backgroundColorIndex];
    let index=-1,cycle=-1,revision=0,saved=null,previous=null;
    let epoch=ENGINE.animationEpoch,start=ENGINE.animationClock;
    const decoded=new Map();
    function clear(x=0,y=0,w=surface.width,h=surface.height){
        context.clearRect(x,y,w,h);
        if(background){context.fillStyle=`rgb(${background.join(",")})`;context.fillRect(x,y,w,h);}
    }
    function compose(next){
        if(previous?.disposalType===2){const d=previous.dims;clear(d.left,d.top,d.width,d.height);}
        else if(previous?.disposalType===3&&saved)context.putImageData(saved,0,0);
        let frame=decoded.get(next);
        if(!frame){
            frame=JScratchGIF.decompressFrame(frames[next],gif.gct,true);
            if(decoded.size>=16)decoded.delete(decoded.keys().next().value);
            decoded.set(next,frame);
        }
        saved=frame.disposalType===3?context.getImageData(0,0,surface.width,surface.height):null;
        const d=frame.dims;patch.width=d.width;patch.height=d.height;
        const pc=patch.getContext("2d");
        const pixels=pc.createImageData(d.width,d.height);pixels.data.set(frame.patch);pc.putImageData(pixels,0,0);
        context.drawImage(patch,d.left,d.top);previous=frame;
    }
    return {surface,get revision(){return revision;},get index(){return index;},frame(clock){
        if(epoch!==ENGINE.animationEpoch||clock<start){epoch=ENGINE.animationEpoch;start=clock;cycle=-1;}
        // Tolerate floating-point cancellation at exact frame boundaries.
        const elapsed=Math.max(0,clock-start)+1e-7,finished=elapsed>=duration*iterations;
        const nextCycle=finished?iterations-1:Math.floor(elapsed/duration);
        const time=finished?duration-1:elapsed%duration;
        let lo=0,hi=ends.length-1;
        while(lo<hi){const mid=(lo+hi)>>1;if(time<ends[mid])hi=mid;else lo=mid+1;}
        const target=lo;
        if(nextCycle!==cycle){clear();index=-1;previous=null;saved=null;cycle=nextCycle;}
        if(index!==target){for(let i=index+1;i<=target;i++)compose(i);index=target;revision++;}
        return {source:surface,width:surface.width,height:surface.height,version:revision};
    }};
}
function getImageFrame(image){
    const animation=imageMedia.get(image)?.animation;
    if(animation){
        try{return animation.frame(ENGINE.animationClock);}
        catch(error){imageMedia.get(image).animation=null;console.warn("GIF frame unavailable:",error.message);}
    }
    return {source:image,width:image?.naturalWidth||image?.width||0,height:image?.naturalHeight||image?.height||0,version:0};
}
function getImagePixels(image){
    const frame=getImageFrame(image);
    if(!frame.width||!frame.height)return null;
    const cached=imagePixelCache.get(image);
    if(cached&&cached.version===frame.version)return cached;
    const surface=document.createElement("canvas");surface.width=frame.width;surface.height=frame.height;
    const context=surface.getContext("2d",{willReadFrequently:true});context.imageSmoothingEnabled=false;
    context.drawImage(frame.source,0,0,frame.width,frame.height);
    let pixels;
    try{pixels=context.getImageData(0,0,frame.width,frame.height).data;}
    catch(error){throw new Error("Costume pixels require a same-origin or CORS-enabled image: "+error.message);}
    // Merge identical opaque row runs into rectangles. All alpha > 0 counts;
    // visual opacity/ghost effects never enter this source-costume mask.
    const rectangles=[];let previous=new Map();
    for(let y=0;y<frame.height;y++){
        const row=new Map();let x=0;
        while(x<frame.width){
            if(!pixels[(y*frame.width+x)*4+3]){x++;continue;}
            const left=x;while(x<frame.width&&pixels[(y*frame.width+x)*4+3])x++;
            const key=left+":"+x,prior=previous.get(key);
            if(prior){prior.height++;row.set(key,prior);}
            else{const rect={x:left,y,width:x-left,height:1};rectangles.push(rect);row.set(key,rect);}
        }
        previous=row;
    }
    const result={width:frame.width,height:frame.height,pixels,rectangles,version:frame.version,colors:new Map()};
    imagePixelCache.set(image,result);return result;
}
applyRenderSettings();
