/* SPRITE BLOCKS */

const sprite=(name)=>ENGINE.sprites[resolveValue(name)];
const num=(v,d=0)=>Number.isFinite(v=Number(resolveValue(v)))?v:d;
const recordSpriteBlock=(type,data)=>ENGINE.recordBlock(createBlock(type,data));

function createSprite(name){
    return recordSpriteBlock("createSprite",{name});
}

registerBlock("createSprite",async block=>{
    const name=String(resolveValue(block.name));
    if(!name)return null;
    return ENGINE.sprites[name]||=new Sprite(name),
        ENGINE.spriteOrderDirty=true,
        ENGINE.sprites[name];
});

registerBlock("spriteCostume",async block=>{
    const s=sprite(block.name);
    if(!s)return;
    const path=resolveValue(block.path),scale=num(block.scale);
    s.setCostume(path,scale);
    s.visible=!!path;
    s.touchable=!!path;
});

registerBlock("spriteSetSize",async block=>{
    const s=sprite(block.name);
    if(s)s.setScale(Math.max(0.01,num(block.scale,1)));
});

registerBlock("spriteChangeSize",async block=>{
    const s=sprite(block.name);
    if(s)s.setScale(Math.max(0.01,s.scale+num(block.amount)));
});

registerBlock("spriteEffect",async block=>{
    const s=sprite(block.name);
    if(!s)return;

    const effect=String(resolveValue(block.effect)).toLowerCase();
    if(effect==="brightness"||effect==="ghost"||effect==="color")
        s.effects[effect]=Math.max(0,Math.min(100,num(block.value)));
});

registerReporter("costumeOfSprite",value=>sprite(value.name)?.costume??"");
registerReporter("sizeOfSprite",value=>sprite(value.name)?.scale??0);

registerBlock("spriteShow",async block=>{
    const s=sprite(block.name);
    if(s)s.visible=true;
});

registerBlock("spriteHide",async block=>{
    const s=sprite(block.name);
    if(s)s.visible=false;
});

registerBlock("spriteLayer",async block=>{
    const s=sprite(block.name);
    if(!s)return;
    s.layer=num(block.layer);
    ENGINE.spriteOrderDirty=true;
});

registerBlock("goFront",async block=>{
    const s=sprite(block.name);
    if(!s)return;

    s.layer=Math.max(
        ...Object.values(ENGINE.sprites).map(x=>x.layer),
        0
    )+1;

    ENGINE.spriteOrderDirty=true;
});

registerBlock("goBack",async block=>{
    const s=sprite(block.name);
    if(!s)return;

    s.layer=Math.min(
        ...Object.values(ENGINE.sprites).map(x=>x.layer),
        0
    )-1;

    ENGINE.spriteOrderDirty=true;
});

registerBlock("deleteSprite",async block=>{
    const name=String(resolveValue(block.name));
    if(!name)return;

    const s=ENGINE.sprites[name];
    if(!s)return;

    delete ENGINE.sprites[name];
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