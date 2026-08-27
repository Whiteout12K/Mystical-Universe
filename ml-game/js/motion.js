// Motion Blocks

registerBlock("moveTo",async block=>{
    const name=resolveValue(block.name);
    const x=Number(resolveValue(block.x))||0;
    const y=Number(resolveValue(block.y))||0;

    const sprite=ENGINE.sprites[name];

    if(!sprite)return;

    sprite.edgeLock=null;
    sprite.x=x;
    sprite.y=y;
});

registerBlock("move",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)return;

    sprite.edgeLock=null;
    sprite.x+=Number(resolveValue(block.x))||0;
    sprite.y+=Number(resolveValue(block.y))||0;
});

registerBlock("moveToEdge",async block=>{
    const name=resolveValue(block.name);

    const horizontalEdge=String(
        resolveValue(block.horizontalEdge)
    ).toLowerCase();

    const verticalEdge=String(
        resolveValue(block.verticalEdge)
    ).toLowerCase();

    const x=Math.max(
        0,
        Number(resolveValue(block.x))||0
    );

    const y=Math.max(
        0,
        Number(resolveValue(block.y))||0
    );

    const sprite=ENGINE.sprites[name];

    if(!sprite)return;

    sprite.edgeLock={
        horizontal:horizontalEdge,
        horizontalDistance:x,
        vertical:verticalEdge,
        verticalDistance:y
    };

    updateEdgeSprite(sprite);
});


registerReporter("spriteX",value=>{
    const sprite=ENGINE.sprites[
        resolveValue(value.name)
    ];

    return sprite?.x??0;
});

registerReporter("spriteY",value=>{
    const sprite=ENGINE.sprites[
        resolveValue(value.name)
    ];

    return sprite?.y??0;
});

registerReporter("spriteDirection",value=>{
    const sprite=ENGINE.sprites[
        resolveValue(value.name)
    ];

    return sprite?.rotation??0;
});


registerBlock("moveToSprite",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    const target=ENGINE.sprites[
        resolveValue(block.target)
    ];

    if(!sprite||!target)return;

    sprite.edgeLock=null;
    sprite.x=target.x;
    sprite.y=target.y;
});

registerBlock("facing",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)return;

    const facing=String(
        resolveValue(block.facing)
    ).toLowerCase();

    sprite.flipX=1;
    sprite.flipY=1;

    if(facing==="left"){
        sprite.flipX=-1;
    }else if(facing==="down"){
        sprite.flipY=-1;
    }
});

registerBlock("direction",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)return;

    let value=Number(
        resolveValue(block.direction)
    );

    if(!Number.isFinite(value))
        value=0;

    sprite.rotation=
        ((value%360)+360)%360;
});

registerBlock("turn",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)return;

    let amount=Number(
        resolveValue(block.amount)
    );

    if(!Number.isFinite(amount))
        amount=0;

    sprite.rotation=
        ((sprite.rotation+amount)%360+360)%360;
});


registerBlock("glideTo",async(block,context)=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)return;

    const targetX=Number(
        resolveValue(block.x)
    );

    const targetY=Number(
        resolveValue(block.y)
    );

    let time=Number(
        resolveValue(block.time)
    );

    if(
        !Number.isFinite(targetX)||
        !Number.isFinite(targetY)
    )
        return;

    if(!Number.isFinite(time)||time<0)
        time=0;

    sprite.edgeLock=null;

    if(time===0){
        sprite.x=targetX;
        sprite.y=targetY;
        return;
    }

    const startX=sprite.x;
    const startY=sprite.y;
    const startTime=performance.now();
    const duration=time*1000;

    await new Promise(resolve=>{
        function animate(now){
            if(
                !ENGINE.running||
                context.ended
            ){
                resolve();
                return;
            }

            const progress=Math.min(
                1,
                (now-startTime)/duration
            );

            sprite.x=
                startX+
                (targetX-startX)*progress;

            sprite.y=
                startY+
                (targetY-startY)*progress;

            if(progress>=1){
                sprite.x=targetX;
                sprite.y=targetY;
                resolve();
                return;
            }

            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    });
});


registerBlock("glideToSprite",async(block,context)=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    const target=ENGINE.sprites[
        resolveValue(block.target)
    ];

    if(!sprite||!target)return;

    let time=Number(
        resolveValue(block.time)
    );

    if(!Number.isFinite(time)||time<0)
        time=0;

    sprite.edgeLock=null;

    const targetX=target.x;
    const targetY=target.y;

    if(time===0){
        sprite.x=targetX;
        sprite.y=targetY;
        return;
    }

    const startX=sprite.x;
    const startY=sprite.y;
    const startTime=performance.now();
    const duration=time*1000;

    await new Promise(resolve=>{
        function animate(now){
            if(
                !ENGINE.running||
                context.ended
            ){
                resolve();
                return;
            }

            const progress=Math.min(
                1,
                (now-startTime)/duration
            );

            sprite.x=
                startX+
                (targetX-startX)*progress;

            sprite.y=
                startY+
                (targetY-startY)*progress;

            if(progress>=1){
                sprite.x=targetX;
                sprite.y=targetY;
                resolve();
                return;
            }

            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    });
});


function recordMotionBlock(type,data){
    const block=createBlock(type,data);

    ENGINE.recordBlock(block);

    return block;
}


function moveTo(name,x,y){
    return recordMotionBlock(
        "moveTo",
        {
            name,
            x,
            y
        }
    );
}


function moveBy(name,x,y){
    return recordMotionBlock(
        "move",
        {
            name,
            x,
            y
        }
    );
}


function moveToEdge(
    name,
    horizontalEdge,
    x,
    verticalEdge,
    y
){
    return recordMotionBlock(
        "moveToEdge",
        {
            name,
            horizontalEdge,
            x,
            verticalEdge,
            y
        }
    );
}


function spriteX(name){
    return createReporter(
        "spriteX",
        {name}
    );
}


function spriteY(name){
    return createReporter(
        "spriteY",
        {name}
    );
}


function spriteDirection(name){
    return createReporter(
        "spriteDirection",
        {name}
    );
}


function moveToSprite(name,target){
    return recordMotionBlock(
        "moveToSprite",
        {
            name,
            target
        }
    );
}


function facing(name,value){
    return recordMotionBlock(
        "facing",
        {
            name,
            facing:value
        }
    );
}


function direction(name,value){
    return recordMotionBlock(
        "direction",
        {
            name,
            direction:value
        }
    );
}


function turn(name,amount){
    return recordMotionBlock(
        "turn",
        {
            name,
            amount
        }
    );
}


function glideTo(name,x,y,time){
    return recordMotionBlock(
        "glideTo",
        {
            name,
            x,
            y,
            time
        }
    );
}


function glideToSprite(name,target,time){
    return recordMotionBlock(
        "glideToSprite",
        {
            name,
            target,
            time
        }
    );
}