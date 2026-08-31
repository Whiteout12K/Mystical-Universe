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
    clone.velocityX=source.velocityX;
    clone.velocityY=source.velocityY;
    clone.edgeLock=source.edgeLock?{...source.edgeLock}:null;
    clone.costume=source.costume||"";
    clone.variables={...source.variables};
    clone.privateVariables={...source.privateVariables};
    clone.cloneOf=source.isClone?source.cloneOf:source.name;
    clone.cloneName=source.isClone?source.cloneName:source.name;

    if(clone.costume){
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

    const clone=new Sprite(source.isClone?source.cloneName:source.name,true);
    copySpriteState(source,clone);

    ENGINE.clones.push(clone);
    ENGINE.spriteOrderDirty=true;

    const listeners=ENGINE.cloneBroadcasts?.[clone.cloneName]||[];
    if(listeners.length){
        for(const script of listeners){
            const context=createScriptContext(clone);
            Promise.resolve()
                .then(()=>executeBlocks(script.blocks,context))
                .catch(e=>console.error("Clone script error:",e));
        }
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

    clone.deleted=true;
    clone.visible=false;

    const i=ENGINE.clones.indexOf(clone);
    if(i>=0)ENGINE.clones.splice(i,1);

    ENGINE.spriteOrder=ENGINE.spriteOrder.filter(s=>s!==clone);
    ENGINE.spriteOrderDirty=true;

    c.ended=true;
});

registerBlock("deleteClonesOf",async(b,c)=>{
    const name=String(resolveValue(b.name,c)??"");
    const targets=ENGINE.clones.filter(x=>
        !x.deleted&&(name==="all"||x.cloneName===name)
    );

    targets.forEach(clone=>{
        clone.deleted=true;
        clone.visible=false;
    });

    ENGINE.clones=ENGINE.clones.filter(x=>!x.deleted);
    ENGINE.spriteOrderDirty=true;
});


/* CLONE EVENTS */

function whenClone(name,...blocks){
    const key=String(resolveValue(name));
    ENGINE.cloneBroadcasts??={};
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
