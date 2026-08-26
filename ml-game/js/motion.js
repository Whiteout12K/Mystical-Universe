
function moveTo(name,x,y){
    name=resolveValue(name);
    x=Number(resolveValue(x))||0;
    y=Number(resolveValue(y))||0;

    const sprite=ENGINE.sprites[name];

    if(!sprite)return;

    sprite.edgeLock=null;
    sprite.x=x;
    sprite.y=y;
}

function moveBy(name,x,y){
    return{
        type:"move",
        name:resolveValue(name),
        x:resolveValue(x),
        y:resolveValue(y)
    };
}

function moveToEdge(name,horizontalEdge,x,verticalEdge,y){
    name=resolveValue(name);
    horizontalEdge=String(resolveValue(horizontalEdge)).toLowerCase();
    verticalEdge=String(resolveValue(verticalEdge)).toLowerCase();
    x=Math.max(0,Number(resolveValue(x))||0);
    y=Math.max(0,Number(resolveValue(y))||0);

    const sprite=ENGINE.sprites[name];

    if(!sprite)return;

    sprite.edgeLock={
        horizontal:horizontalEdge,
        horizontalDistance:x,
        vertical:verticalEdge,
        verticalDistance:y
    };

    updateEdgeSprite(sprite);
}