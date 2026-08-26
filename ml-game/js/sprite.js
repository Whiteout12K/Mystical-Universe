
function createSprite(name){
    if(!name)return null;

    return ENGINE.sprites[name]||(ENGINE.sprites[name]=new Sprite(name));
}

function spriteCostume(name,path,scale=1){
    name=resolveValue(name);
    path=resolveValue(path);
    scale=Number(resolveValue(scale))||1;

    const sprite=ENGINE.sprites[name];

    if(sprite)
        sprite.setCostume(path,scale);
}