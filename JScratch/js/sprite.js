/* SPRITE BLOCKS */

const sprite=(name,c=null)=>getContextSprite(name,c);

const num=(v,d=0,c=null)=>{
    v=Number(resolveValue(v,c));
    return Number.isFinite(v)?v:d;
};

const recordSpriteBlock=(type,data)=>ENGINE.recordBlock(createBlock(type,data));

function createSprite(name){
    return recordSpriteBlock("createSprite",{name});
}

registerBlock("createSprite",async(block,c)=>{
    const name=String(resolveValue(block.name,c));
    if(!name)return null;

    if(ENGINE.sprites[name])return ENGINE.sprites[name];

    const s=new Sprite(name);
    ENGINE.sprites[name]=s;
    ENGINE.spriteOrderDirty=true;
    return s;
});

registerBlock("spriteCostume",async(block,c)=>{
    const s=sprite(block.name,c);
    if(!s)return;

    const path=resolveValue(block.path,c);
    const scale=num(block.scale,1,c);

    s.setCostume(path,scale);
    s.visible=!!path;
    s.touchable=!!path;
    ENGINE.spriteOrderDirty=true;
});

registerBlock("spriteSetSize",async(block,c)=>{
    const s=sprite(block.name,c);
    if(s)s.setScale(Math.max(0.01,num(block.scale,1,c)));
});

registerBlock("spriteChangeSize",async(block,c)=>{
    const s=sprite(block.name,c);
    if(s)s.setScale(Math.max(0.01,s.scale+num(block.amount,0,c)));
});

registerBlock("spriteEffect",async(block,c)=>{
    const s=sprite(block.name,c);
    if(!s)return;

    const effect=String(resolveValue(block.effect,c)).toLowerCase();

    if(effect==="brightness")
        s.effects.brightness=Math.max(-100,Math.min(100,num(block.value,0,c)));

    else if(effect==="ghost"||effect==="color")
        s.effects[effect]=Math.max(0,Math.min(100,num(block.value,0,c)));

    // The pixel cache key includes brightness/color; ghost affects draw opacity only.
});

registerBlock("spriteChangeEffect",async(block,c)=>{
    const s=sprite(block.name,c);
    if(!s)return;

    const effect=String(resolveValue(block.effect,c)).toLowerCase();
    const amount=num(block.value,0,c);

    if(effect==="brightness")
        s.effects.brightness=Math.max(-100,Math.min(100,
            num(s.effects.brightness,0)+amount
        ));

    else if(effect==="ghost"||effect==="color")
        s.effects[effect]=Math.max(0,Math.min(100,
            num(s.effects[effect],0)+amount
        ));

    // The pixel cache key includes brightness/color; ghost affects draw opacity only.
});

registerReporter("costumeOfSprite",(value,c)=>
    sprite(value.name,c)?.costume??""
);

registerReporter("sizeOfSprite",(value,c)=>
    sprite(value.name,c)?.scale??0
);

registerBlock("spriteShow",async(block,c)=>{
    const s=sprite(block.name,c);
    if(s){
        s.visible=true;
        ENGINE.spriteOrderDirty=true;
    }
});

registerBlock("spriteHide",async(block,c)=>{
    const s=sprite(block.name,c);
    if(s){
        s.visible=false;
        ENGINE.spriteOrderDirty=true;
    }
});

registerBlock("spriteLayer",async(block,c)=>{
    const s=sprite(block.name,c);
    if(!s)return;

    s.layer=num(block.layer,0,c);
    ENGINE.spriteOrderDirty=true;
});

registerBlock("goFront",async(block,c)=>{
    const s=sprite(block.name,c);
    if(!s)return;

    let highest=0;
    for(const item of getAllSprites())highest=Math.max(highest,item.layer);
    s.layer=highest+1;

    ENGINE.spriteOrderDirty=true;
});

registerBlock("goBack",async(block,c)=>{
    const s=sprite(block.name,c);
    if(!s)return;

    let lowest=0;
    for(const item of getAllSprites())lowest=Math.min(lowest,item.layer);
    s.layer=lowest-1;

    ENGINE.spriteOrderDirty=true;
});

registerBlock("deleteSprite",async(block,c)=>{
    const name=String(resolveValue(block.name,c));
    if(!name)return;

    const s=ENGINE.sprites[name];
    if(!s)return;

    delete ENGINE.sprites[name];

    s.deleted=true;
    s.visible=false;

    ENGINE.spriteOrder=ENGINE.spriteOrder.filter(x=>x!==s);
    ENGINE.spriteOrderDirty=true;
});

registerBlock("deleteAllSprites",async()=>{
    const sprites=Object.values(ENGINE.sprites||{});

    for(const s of sprites){
        if(!s)continue;
        s.deleted=true;
        s.visible=false;
        s.touchable=false;
    }

    if(ENGINE.clones&&typeof ENGINE.clones==="object"){
        for(const c of Object.values(ENGINE.clones)){
            if(!c)continue;
            c.deleted=true;
            c.visible=false;
            c.touchable=false;
        }

        if(Array.isArray(ENGINE.clones))
            ENGINE.clones.length=0;
        else
            Object.keys(ENGINE.clones).forEach(k=>delete ENGINE.clones[k]);
    }

    ENGINE.sprites=Object.create(null);
    ENGINE.spriteOrder=[];
    ENGINE.spriteOrderDirty=true;
    releaseInactiveWaiters();
});


/* PHASE EFFECTS */

function getActivePhaseSprites(){
    const list=[];
    const seen=new Set();

    const add=s=>{
        if(!s||s.deleted||seen.has(s))return;
        seen.add(s);
        list.push(s);
    };

    Object.values(ENGINE.sprites||{}).forEach(add);

    if(ENGINE.clones&&typeof ENGINE.clones==="object")
        Object.values(ENGINE.clones).forEach(add);

    return list;
}

async function phaseSprites(block,c,direction){
    const sprites=getActivePhaseSprites();
    if(!sprites.length)return;

    let time=num(block.time,1,c);
    if(time<0)time=0;

    const start=runtimeClock(c),duration=time*1000;
    while(contextActive(c)){
        const progress=duration?Math.min(1,(runtimeClock(c)-start)/duration):1;
        for(const s of sprites){
            if(!s||s.deleted)continue;
            s.effects.ghost=direction==="in"?100*(1-progress):100*progress;
        }
        if(progress>=1)break;
        // During a debugger step complete the selected timed command immediately.
        await runtimeWait(c?.stepping?duration:0,c,true);
    }

}

registerBlock("phaseIn",async(block,c)=>{
    await phaseSprites(block,c,"in");
});

registerBlock("phaseOut",async(block,c)=>{
    await phaseSprites(block,c,"out");
});


/* SPRITE API */

function createSpriteBlock(type,data){
    return recordSpriteBlock(type,data);
}

function spriteCostume(name,path,scale=1){
    return arguments.length===1
        ?costumeOfSprite(name)
        :createSpriteBlock("spriteCostume",{name,path,scale});
}

function spriteSetSize(name,scale){
    return arguments.length===1
        ?sizeOfSprite(name)
        :createSpriteBlock("spriteSetSize",{name,scale});
}

function spriteChangeSize(name,amount){
    return createSpriteBlock("spriteChangeSize",{name,amount});
}

function spriteEffect(name,effect,value){
    return createSpriteBlock("spriteEffect",{name,effect,value});
}

function spriteChangeEffect(name,effect,amount){
    return createSpriteBlock("spriteChangeEffect",{name,effect,value:amount});
}

function costumeOfSprite(name){
    return createReporter("costumeOfSprite",{name});
}

function sizeOfSprite(name){
    return createReporter("sizeOfSprite",{name});
}

function spriteShow(name){
    return createSpriteBlock("spriteShow",{name});
}

function spriteHide(name){
    return createSpriteBlock("spriteHide",{name});
}

function spriteLayer(name,layer){
    return createSpriteBlock("spriteLayer",{name,layer});
}

function goFront(name){
    return createSpriteBlock("goFront",{name});
}

function goBack(name){
    return createSpriteBlock("goBack",{name});
}

function deleteSprite(name){
    return createSpriteBlock("deleteSprite",{name});
}

function deleteAllSprites(){
    return createSpriteBlock("deleteAllSprites",{});
}

function phaseIn(time=1){
    return createSpriteBlock("phaseIn",{time});
}

function phaseOut(time=1){
    return createSpriteBlock("phaseOut",{time});
}