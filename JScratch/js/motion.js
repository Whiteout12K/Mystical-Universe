/* MOTION BLOCKS */

const motionSprite=(n,c=null)=>getContextSprite(n,c);
const motionNum=(v,d=0,c=null)=>{
    v=Number(resolveValue(v,c));
    return Number.isFinite(v)?v:d;
};
const normDeg=v=>((v%360)+360)%360;
const recordMotionBlock=(type,data)=>ENGINE.recordBlock(createBlock(type,data));

registerBlock("moveTo",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(!s)return;
    moveSpriteWithSolids(s,motionNum(block.x,0,c),motionNum(block.y,0,c),c);
});

registerBlock("move",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(!s)return;
    moveSpriteWithSolids(s,s.x+motionNum(block.x,0,c),s.y+motionNum(block.y,0,c),c);
});

/* REPORTERS */

registerReporter("spriteX",(v,c)=>motionSprite(v.name,c)?.x??0);
registerReporter("spriteY",(v,c)=>motionSprite(v.name,c)?.y??0);
registerReporter("spriteDirection",(v,c)=>motionSprite(v.name,c)?.rotation??0);
registerReporter("isMobile",()=>ENGINE.mobile===true);

registerBlock("moveToSprite",async(block,c)=>{
    const s=motionSprite(block.name,c),t=motionSprite(block.target,c);
    if(!s||!t)return;
    const position=spriteTargetPosition(s,t);
    moveSpriteWithSolids(s,position.x,position.y,c);
});

registerBlock("facing",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(!s)return;
    s.flipX=s.flipY=1;
    switch(String(resolveValue(block.facing,c)).toLowerCase()){
        case"left":s.flipX=-1;break;
        case"down":s.flipY=-1;break;
    }
});

registerBlock("direction",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(s)s.rotation=normDeg(motionNum(block.direction,0,c));
});

registerBlock("turn",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(s)s.rotation=normDeg(s.rotation+motionNum(block.amount,0,c));
});


/* GLIDE */

async function glideSprite(s,x,y,time,context){
    if(!s)return;

    x=Number(resolveValue(x,context));
    y=Number(resolveValue(y,context));
    time=Number(resolveValue(time,context));

    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(!Number.isFinite(time)||time<0)time=0;


    if(!time){
        moveSpriteWithSolids(s,x,y,context);
        return;
    }

    const sx=s.x,sy=s.y,start=runtimeClock(context),duration=time*1000;
    while(contextActive(context)){
        const progress=context?.stepping?1:Math.min(1,(runtimeClock(context)-start)/duration);moveSpriteWithSolids(s,sx+(x-sx)*progress,sy+(y-sy)*progress,context);
        if(progress>=1)break;await runtimeWait(0,context,true);
    }
}

registerBlock("glideTo",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(s)await glideSprite(s,block.x,block.y,block.time,c);
});

registerBlock("glideToSprite",async(block,c)=>{
    const s=motionSprite(block.name,c),t=motionSprite(block.target,c);
    if(!s||!t)return;
    const position=spriteTargetPosition(s,t);
    await glideSprite(s,position.x,position.y,block.time,c);
});


/* MOTION API */

function moveTo(name,x,y){
    return recordMotionBlock("moveTo",{name,x,y});
}

function moveBy(name,x,y){
    return recordMotionBlock("move",{name,x,y});
}

function spriteX(name){
    return createReporter("spriteX",{name});
}

function spriteY(name){
    return createReporter("spriteY",{name});
}

function spriteDirection(name){
    return createReporter("spriteDirection",{name});
}

function isMobile(){
    return createReporter("isMobile");
}

function moveToSprite(name,target){
    return recordMotionBlock("moveToSprite",{name,target});
}

function facing(name,value){
    return recordMotionBlock("facing",{name,facing:value});
}

function direction(name,value){
    return recordMotionBlock("direction",{name,direction:value});
}

function turn(name,amount){
    return recordMotionBlock("turn",{name,amount});
}

function glideTo(name,x,y,time){
    return recordMotionBlock("glideTo",{name,x,y,time});
}

function glideToSprite(name,target,time){
    return recordMotionBlock("glideToSprite",{name,target,time});
}
// World (default) or browser canvas CSS pixels, independent of camera/zoom.
function spriteCoordinateMode(name,mode){return recordMotionBlock("spriteCoordinateMode",{name,mode});}
function coordinateModeOfSprite(name){return createReporter("coordinateModeOfSprite",{name});}
function setSpriteCoordinateMode(sprite,mode){
    const value=mode===true?"canvas":mode===false?"world":String(mode).toLowerCase();
    const normalized=value==="screen"?"canvas":value;
    if(!["world","canvas"].includes(normalized))throw new Error("Coordinate mode must be world or canvas");
    sprite.coordinateMode=normalized;
    if(normalized==="canvas"&&(ENGINE.camera.follow===sprite||(!sprite.isClone&&ENGINE.camera.follow===sprite.name)))ENGINE.camera.follow=null;
}
registerBlock("spriteCoordinateMode",(b,c)=>{const s=getContextSprite(b.name,c);if(s)setSpriteCoordinateMode(s,resolveValue(b.mode,c));});
registerReporter("coordinateModeOfSprite",(b,c)=>getContextSprite(b.name,c)?.coordinateMode||"world");

// Select browser-pixel axes; x/y are inward distances from the chosen sides.
function coordinatePlane(name,horizontal="left",vertical="top"){
    return recordMotionBlock("coordinatePlane",{name,horizontal,vertical});
}
registerBlock("coordinatePlane",(b,c)=>{
    const s=motionSprite(b.name,c);if(!s)return;
    const horizontal=String(resolveValue(b.horizontal,c)).toLowerCase();
    const vertical=String(resolveValue(b.vertical,c)).toLowerCase();
    if(!["left","right"].includes(horizontal)||!["top","bottom"].includes(vertical))
        throw new Error("Coordinate plane requires left/right and top/bottom");
    setSpriteCoordinateMode(s,"canvas");
    s.coordinateHorizontal=horizontal;s.coordinateVertical=vertical;
});
