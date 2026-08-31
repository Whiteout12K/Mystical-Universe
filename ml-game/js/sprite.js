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

    s.layer=Math.max(
        ...getAllSprites().map(x=>x.layer),
        0
    )+1;

    ENGINE.spriteOrderDirty=true;
});

registerBlock("goBack",async(block,c)=>{
    const s=sprite(block.name,c);
    if(!s)return;

    s.layer=Math.min(
        ...getAllSprites().map(x=>x.layer),
        0
    )-1;

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

