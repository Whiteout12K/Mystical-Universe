/* CLONE BLOCKS */

const cloneNum=(v,d=0)=>Number.isFinite(v=Number(resolveValue(v)))?v:d;
const recordCloneBlock=(type,data)=>ENGINE.recordBlock(createBlock(type,data));

function cloneSource(name,c=null){
    const n=String(resolveValue(name,c)??"");
    if(c?.clone?.isClone&&(n==="self"||n===c.clone.cloneName))return c.clone;
    return ENGINE.sprites[n]||null;
}

function copySpriteState(source,clone){
    clone.x=source.x;
    clone.y=source.y;
    clone.visible=source.visible;
    clone.scale=source.scale;
    clone.width=source.width;
    clone.height=source.height;
    clone.loaded=source.loaded;
    clone.opacity=source.opacity;
    clone.rotation=source.rotation;
    clone.flipX=source.flipX;
    clone.flipY=source.flipY;
    clone.effects={...source.effects};
    clone.layer=source.layer;
    clone.touchable=source.touchable;
    clone.coordinateMode=source.coordinateMode;
    clone.solidCollision={enabled:source.solidCollision.enabled,targets:Array.isArray(source.solidCollision.targets)?[...source.solidCollision.targets]:source.solidCollision.targets,blocked:false,contacts:[]};
    clone.velocityX=source.velocityX;
    clone.velocityY=source.velocityY;
    clone.coordinateHorizontal=source.coordinateHorizontal;
    clone.coordinateVertical=source.coordinateVertical;
    clone.costume=source.costume||"";
    clone.variables=Object.assign(Object.create(null),source.variables);
    clone.privateVariables=Object.assign(Object.create(null),source.privateVariables);
    clone.cloneOf=source.isClone?source.cloneOf:source.name;
    clone.cloneName=source.isClone?source.cloneName:source.name;

    if(source.isUI)source.copyUIStateTo(clone);
    else if(clone.costume){
        clone.setCostume(clone.costume,clone.scale);
        if(source.image){
            clone.image=source.image;
            clone.loaded=source.image.complete&&source.image.naturalWidth>0;
            if(clone.loaded)clone.updateSize();
            else{
                const image=source.image;
                image.addEventListener("load",()=>{
                    if(!clone.deleted&&clone.image===image){
                        clone.loaded=true;
                        clone.updateSize();
                        ENGINE.spriteOrderDirty=true;
                    }
                },{once:true});
            }
        }
    }

    ENGINE.spriteOrderDirty=true;
    return clone;
}

function createClone(source){
    if(!source||source.deleted)return null;
    if(ENGINE.clones.length>=ENGINE.maxClones){reportRuntimeError(new Error("Clone limit reached ("+ENGINE.maxClones+")"),null,null);return null;}

    const CloneType=source.isUI?UISprite:Sprite;
    const clone=new CloneType(source.isClone?source.cloneName:source.name,true);
    copySpriteState(source,clone);

    ENGINE.clones.push(clone);
    ENGINE.spriteOrderDirty=true;

    const listeners=ENGINE.cloneBroadcasts?.[clone.cloneName]||[];
    for(const [index,script] of listeners.entries()){
        const context=createScriptContext(clone);
        context.scriptName="Clone "+clone.cloneName+" ["+(index+1)+"]";
        context.group=clone.cloneName;
        launchScript(script.blocks,context);
    }

    return clone;
}


/* CREATE / DELETE */

registerBlock("makeClone",async(b,c)=>{
    const source=cloneSource(b.name,c);
    if(source)createClone(source);
});

registerBlock("deleteClone",async(b,c)=>{
    const clone=c?.clone?.isClone?c.clone:null;
    if(!clone)return;

    removeSpriteObject(clone);

    c.ended=true;
    releaseInactiveWaiters();
});

registerBlock("deleteClonesOf",async(b,c)=>{
    const name=String(resolveValue(b.name,c)??"");
    const targets=ENGINE.clones.filter(x=>
        !x.deleted&&(name==="all"||x.cloneName===name)
    );

    targets.forEach(clone=>{
        markSpriteDeleted(clone);
    });

    ENGINE.clones=ENGINE.clones.filter(x=>!x.deleted);
    releaseInactiveWaiters();
    ENGINE.spriteOrderDirty=true;
});


/* CLONE EVENTS */

function whenClone(name,...blocks){
    const key=String(resolveValue(name));
    ENGINE.cloneBroadcasts??=Object.create(null);
    ENGINE.cloneBroadcasts[key]??=[];

    const script={name:key,blocks:Array.isArray(blocks)?blocks:[]};
    ENGINE.cloneBroadcasts[key].push(script);

    ENGINE.absorbBlocks(script.blocks);

    return script;
}


/* CLONE REPORTERS */

function cloneName(){
    return createReporter("cloneName");
}

function cloneId(){
    return createReporter("cloneId");
}

registerReporter("cloneName",(b,c)=>
    c?.clone?.isClone?c.clone.cloneName:""
);

registerReporter("cloneId",(b,c)=>
    c?.clone?.isClone?c.clone.cloneId:0
);

function isClone(){
    return createReporter("isClone");
}

registerReporter("isClone",(b,c)=>!!c?.clone?.isClone);


/* CLONE API */

function makeClone(name){
    return recordCloneBlock("makeClone",{name});
}

function deleteClone(){
    return recordCloneBlock("deleteClone",{});
}

function deleteClonesOf(name){
    return recordCloneBlock("deleteClonesOf",{name});
}

function getCloneName(){
    return createReporter("cloneName");
}

function getCloneId(){
    return createReporter("cloneId");
}
