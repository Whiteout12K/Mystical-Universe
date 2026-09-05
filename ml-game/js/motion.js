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
    s.edgeLock=null;
    s.x=motionNum(block.x,0,c);
    s.y=motionNum(block.y,0,c);
});

registerBlock("move",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(!s)return;
    s.edgeLock=null;
    s.x+=motionNum(block.x,0,c);
    s.y+=motionNum(block.y,0,c);
});

function setupEdgeLock(s,horizontal,hDistance,vertical,vDistance){
    if(!s)return;

    horizontal=String(horizontal??"").toLowerCase();
    vertical=String(vertical??"").toLowerCase();

    const vw=ENGINE.viewWidth/2;
    const vh=ENGINE.viewHeight/2;
    const cx=ENGINE.camera.x;
    const cy=ENGINE.camera.y;
    const left=cx-vw;
    const right=cx+vw;
    const bottom=cy-vh;
    const top=cy+vh;

    hDistance=Math.max(0,Number(hDistance)||0);
    vDistance=Math.max(0,Number(vDistance)||0);

    /*
     * Edge distance is measured to the SPRITE CENTER.
     * This is deliberately independent of width/height so resizing
     * never changes the sprite's center position.
     */
    s.edgeLock={
        horizontal,
        horizontalDistance:hDistance,
        vertical,
        verticalDistance:vDistance,
        mobile:false
    };

    if(horizontal==="left")
        s.x=left+hDistance;
    else if(horizontal==="right")
        s.x=right-hDistance;

    if(vertical==="top")
        s.y=top-vDistance;
    else if(vertical==="bottom")
        s.y=bottom+vDistance;

    updateEdgeSprite(s);
}

registerBlock("moveToEdge",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(!s)return;

    setupEdgeLock(
        s,
        String(resolveValue(block.horizontalEdge,c)??"").toLowerCase(),
        Math.max(0,motionNum(block.x,0,c)),
        String(resolveValue(block.verticalEdge,c)??"").toLowerCase(),
        Math.max(0,motionNum(block.y,0,c))
    );
});


/* REPORTERS */

registerReporter("spriteX",(v,c)=>motionSprite(v.name,c)?.x??0);
registerReporter("spriteY",(v,c)=>motionSprite(v.name,c)?.y??0);
registerReporter("spriteDirection",(v,c)=>motionSprite(v.name,c)?.rotation??0);
registerReporter("isMobile",()=>ENGINE.mobile===true);

registerBlock("moveToSprite",async(block,c)=>{
    const s=motionSprite(block.name,c),t=motionSprite(block.target,c);
    if(!s||!t)return;
    s.edgeLock=null;
    s.x=t.x;
    s.y=t.y;
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

    s.edgeLock=null;

    if(!time){
        s.x=x;
        s.y=y;
        return;
    }

    const sx=s.x,sy=s.y,start=performance.now(),duration=time*1000;

    await new Promise(resolve=>{
        const animate=now=>{
            if(!ENGINE.running||context.ended)return resolve();

            const p=Math.min(1,(now-start)/duration);
            s.x=sx+(x-sx)*p;
            s.y=sy+(y-sy)*p;

            if(p>=1)return resolve();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    });
}

registerBlock("glideTo",async(block,c)=>{
    const s=motionSprite(block.name,c);
    if(s)await glideSprite(s,block.x,block.y,block.time,c);
});

registerBlock("glideToSprite",async(block,c)=>{
    const s=motionSprite(block.name,c),t=motionSprite(block.target,c);
    if(!s||!t)return;
    await glideSprite(s,t.x,t.y,block.time,c);
});


/* MOTION API */

function moveTo(name,x,y){
    return recordMotionBlock("moveTo",{name,x,y});
}

function moveBy(name,x,y){
    return recordMotionBlock("move",{name,x,y});
}

function moveToEdge(name,horizontalEdge,x,verticalEdge,y){
    return recordMotionBlock("moveToEdge",{name,horizontalEdge,x,verticalEdge,y});
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
