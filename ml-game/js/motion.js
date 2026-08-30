/* MOTION BLOCKS */

const motionSprite=n=>ENGINE.sprites[resolveValue(n)];
const motionNum=(v,d=0)=>Number.isFinite(v=Number(resolveValue(v)))?v:d;
const normDeg=v=>((v%360)+360)%360;
const recordMotionBlock=(type,data)=>ENGINE.recordBlock(createBlock(type,data));

registerBlock("moveTo",async block=>{
    const s=motionSprite(block.name);
    if(!s)return;
    s.edgeLock=null;
    s.x=motionNum(block.x);
    s.y=motionNum(block.y);
});

registerBlock("move",async block=>{
    const s=motionSprite(block.name);
    if(!s)return;
    s.edgeLock=null;
    s.x+=motionNum(block.x);
    s.y+=motionNum(block.y);
});

function setupEdgeLock(s,horizontal,hDistance,vertical,vDistance){
    if(!s)return;

    horizontal=String(horizontal??"").toLowerCase();
    vertical=String(vertical??"").toLowerCase();

    s.edgeLock={
        horizontal,
        horizontalDistance:Math.max(0,Number(hDistance)||0),
        vertical,
        verticalDistance:Math.max(0,Number(vDistance)||0)
    };

    if(vertical==="top"&&!horizontal)s.x=0;
    updateEdgeSprite(s);
}

registerBlock("moveToEdge",async block=>{
    const s=motionSprite(block.name);
    if(!s)return;

    setupEdgeLock(
        s,
        String(resolveValue(block.horizontalEdge)??"").toLowerCase(),
        Math.max(0,motionNum(block.x)),
        String(resolveValue(block.verticalEdge)??"").toLowerCase(),
        Math.max(0,motionNum(block.y))
    );
});


/* REPORTERS */

registerReporter("spriteX",v=>motionSprite(v.name)?.x??0);
registerReporter("spriteY",v=>motionSprite(v.name)?.y??0);
registerReporter("spriteDirection",v=>motionSprite(v.name)?.rotation??0);
registerReporter("isMobile",()=>ENGINE.mobile===true);


registerBlock("moveToSprite",async block=>{
    const s=motionSprite(block.name),t=motionSprite(block.target);
    if(!s||!t)return;
    s.edgeLock=null;
    s.x=t.x;
    s.y=t.y;
});

registerBlock("facing",async block=>{
    const s=motionSprite(block.name);
    if(!s)return;

    s.flipX=s.flipY=1;

    switch(String(resolveValue(block.facing)).toLowerCase()){
        case"left":s.flipX=-1;break;
        case"down":s.flipY=-1;break;
    }
});

registerBlock("direction",async block=>{
    const s=motionSprite(block.name);
    if(s)s.rotation=normDeg(motionNum(block.direction));
});

registerBlock("turn",async block=>{
    const s=motionSprite(block.name);
    if(s)s.rotation=normDeg(s.rotation+motionNum(block.amount));
});


/* GLIDE */

async function glideSprite(s,x,y,time,context){
    if(!s)return;

    x=Number(resolveValue(x));
    y=Number(resolveValue(y));
    time=Number(resolveValue(time));

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

registerBlock("glideTo",async(block,context)=>{
    const s=motionSprite(block.name);
    if(s)await glideSprite(s,block.x,block.y,block.time,context);
});

registerBlock("glideToSprite",async(block,context)=>{
    const s=motionSprite(block.name),t=motionSprite(block.target);
    if(!s||!t)return;

    await glideSprite(
        s,
        t.x,
        t.y,
        block.time,
        context
    );
});


/* MOTION API */

function moveTo(name,x,y){
    return recordMotionBlock("moveTo",{name,x,y});
}

function moveBy(name,x,y){
    return recordMotionBlock("move",{name,x,y});
}

function moveToEdge(name,horizontalEdge,x,verticalEdge,y){
    return recordMotionBlock(
        "moveToEdge",
        {name,horizontalEdge,x,verticalEdge,y}
    );
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