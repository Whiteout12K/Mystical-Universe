// Sprite Blocks

function createSprite(name){
    name=resolveValue(name);

    if(!name)
        return null;

    return ENGINE.sprites[name]||
        (ENGINE.sprites[name]=new Sprite(name));
}


registerBlock("spriteCostume",async block=>{
    const name=resolveValue(block.name);
    const path=resolveValue(block.path);
    const scale=Number(
        resolveValue(block.scale)
    );

    const sprite=ENGINE.sprites[name];

    if(!sprite)
        return;

    if(path===""){
        sprite.setCostume("",scale);
        sprite.visible=false;
        sprite.touchable=false;
    }else{
        sprite.setCostume(path,scale);
        sprite.visible=true;
        sprite.touchable=true;
    }
});


registerBlock("spriteSetSize",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)
        return;

    let scale=Number(
        resolveValue(block.scale)
    );

    if(!Number.isFinite(scale)||scale<=0)
        scale=1;

    sprite.setScale(scale);
});


registerBlock("spriteChangeSize",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)
        return;

    let amount=Number(
        resolveValue(block.amount)
    );

    if(!Number.isFinite(amount))
        amount=0;

    sprite.setScale(
        Math.max(
            0.01,
            sprite.scale+amount
        )
    );
});


registerBlock("spriteEffect",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)
        return;

    const effect=String(
        resolveValue(block.effect)
    ).toLowerCase();

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    value=Math.max(
        0,
        Math.min(100,value)
    );

    if(effect==="brightness"){
        sprite.effects.brightness=value;
    }else if(effect==="ghost"){
        sprite.effects.ghost=value;
    }else if(effect==="color"){
        sprite.effects.color=value;
    }
});


registerReporter("costumeOfSprite",value=>{
    const sprite=ENGINE.sprites[
        resolveValue(value.name)
    ];

    return sprite?.costume??"";
});


registerReporter("sizeOfSprite",value=>{
    const sprite=ENGINE.sprites[
        resolveValue(value.name)
    ];

    return sprite?.scale??0;
});


registerBlock("spriteShow",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(sprite)
        sprite.visible=true;
});


registerBlock("spriteHide",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(sprite)
        sprite.visible=false;
});


registerBlock("spriteLayer",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)
        return;

    let layer=Number(
        resolveValue(block.layer)
    );

    if(!Number.isFinite(layer))
        layer=0;

    sprite.layer=layer;
});


registerBlock("goFront",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)
        return;

    const sprites=Object.values(
        ENGINE.sprites
    );

    const highest=sprites.reduce(
        (max,item)=>
            Math.max(max,item.layer),
        0
    );

    sprite.layer=highest+1;
});


registerBlock("goBack",async block=>{
    const sprite=ENGINE.sprites[
        resolveValue(block.name)
    ];

    if(!sprite)
        return;

    const sprites=Object.values(
        ENGINE.sprites
    );

    const lowest=sprites.reduce(
        (min,item)=>
            Math.min(min,item.layer),
        0
    );

    sprite.layer=lowest-1;
});


registerBlock("deleteSprite",async block=>{
    const name=resolveValue(block.name);

    if(!name)
        return;

    delete ENGINE.sprites[name];
});


function recordSpriteBlock(type,data){
    const block=createBlock(
        type,
        data
    );

    ENGINE.recordBlock(block);

    return block;
}


function spriteCostume(name,path,scale=1){
    if(arguments.length===1){
        return costumeOfSprite(name);
    }

    return recordSpriteBlock(
        "spriteCostume",
        {
            name,
            path,
            scale
        }
    );
}


function spriteSetSize(name,scale){
    if(arguments.length===1){
        return sizeOfSprite(name);
    }

    return recordSpriteBlock(
        "spriteSetSize",
        {
            name,
            scale
        }
    );
}


function spriteChangeSize(name,amount){
    return recordSpriteBlock(
        "spriteChangeSize",
        {
            name,
            amount
        }
    );
}


function spriteEffect(name,effect,value){
    return recordSpriteBlock(
        "spriteEffect",
        {
            name,
            effect,
            value
        }
    );
}


function costumeOfSprite(name){
    return createReporter(
        "costumeOfSprite",
        {
            name
        }
    );
}


function sizeOfSprite(name){
    return createReporter(
        "sizeOfSprite",
        {
            name
        }
    );
}


function spriteShow(name){
    return recordSpriteBlock(
        "spriteShow",
        {
            name
        }
    );
}


function spriteHide(name){
    return recordSpriteBlock(
        "spriteHide",
        {
            name
        }
    );
}


function spriteLayer(name,layer){
    return recordSpriteBlock(
        "spriteLayer",
        {
            name,
            layer
        }
    );
}


function goFront(name){
    return recordSpriteBlock(
        "goFront",
        {
            name
        }
    );
}


function goBack(name){
    return recordSpriteBlock(
        "goBack",
        {
            name
        }
    );
}


function deleteSprite(name){
    return recordSpriteBlock(
        "deleteSprite",
        {
            name
        }
    );
}