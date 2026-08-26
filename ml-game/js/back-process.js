
const ENGINE={
    width:640,height:360,centerX:0,centerY:0,viewWidth:640,viewHeight:360,unitScale:1,
    background:"#000000",backgroundImage:null,backgroundLoaded:false,backgroundScale:1,
    sprites:{},variables:{},running:true,lastTime:0,deltaTime:0,camera:{x:0,y:0},scripts:[],
    mobile:false
};

const canvas=document.getElementById("game-canvas");
const ctx=canvas.getContext("2d",{alpha:false});
ctx.imageSmoothingEnabled=false;

document.documentElement.style.touchAction="none";
document.body.style.touchAction="none";
canvas.style.touchAction="none";
canvas.style.userSelect="none";
canvas.style.webkitUserSelect="none";
canvas.style.webkitTouchCallout="none";

["gesturestart","gesturechange","gestureend"].forEach(event=>{
    document.addEventListener(event,e=>e.preventDefault(),{passive:false});
});

document.addEventListener("wheel",e=>{
    if(e.ctrlKey)e.preventDefault();
},{passive:false});

document.addEventListener("touchmove",e=>{
    if(e.touches.length>1)e.preventDefault();
},{passive:false});

class Sprite{
    constructor(name){
        Object.assign(this,{name,x:0,y:0,visible:true,costume:null,image:null,scale:1,width:160,height:160,loaded:false,opacity:1,rotation:0,layer:0,variables:{},velocityX:0,velocityY:0,edgeLock:null});
    }

    setCostume(path,scale=1){
        this.costume=path;
        this.scale=Number(scale)||1;
        this.image=new Image();
        this.loaded=false;
        this.image.onload=()=>{
            this.loaded=true;
            this.width=160*this.scale;
            this.height=this.width*(this.image.naturalHeight/this.image.naturalWidth);
            updateEdgeSprite(this);
        };
        this.image.onerror=()=>{
            this.loaded=false;
            console.warn("Could not load costume:",path);
        };
        this.image.src=path;
    }

    draw(){
        if(!this.visible||!this.loaded)return;
        ctx.save();
        ctx.globalAlpha=this.opacity;
        ctx.imageSmoothingEnabled=false;
        ctx.translate((this.x-ENGINE.camera.x)*ENGINE.unitScale+canvas.width/2,(this.y-ENGINE.camera.y)*ENGINE.unitScale+canvas.height/2);
        ctx.rotate(this.rotation*Math.PI/180);
        ctx.drawImage(this.image,-this.width*ENGINE.unitScale/2,-this.height*ENGINE.unitScale/2,this.width*ENGINE.unitScale,this.height*ENGINE.unitScale);
        ctx.restore();
    }
}

function resolveValue(value){
    if(value===null||value===undefined)return"";

    if(typeof value==="object"){
        if(value.type==="variable")return ENGINE.variables[value.name]??"";
        if(value.type==="join")return value.values.map(resolveValue).join("");
        if(value.type==="value")return resolveValue(value.value);
    }

    return value;
}

function updateEdgeSprite(sprite){
    if(!sprite||!sprite.edgeLock)return;

    const lock=sprite.edgeLock;
    const halfWidth=sprite.width/2;
    const halfHeight=sprite.height/2;

    const left=ENGINE.camera.x-ENGINE.viewWidth/2;
    const right=ENGINE.camera.x+ENGINE.viewWidth/2;
    const top=ENGINE.camera.y-ENGINE.viewHeight/2;
    const bottom=ENGINE.camera.y+ENGINE.viewHeight/2;

    if(lock.horizontal==="left")
        sprite.x=left+lock.horizontalDistance+halfWidth;
    else if(lock.horizontal==="right")
        sprite.x=right-lock.horizontalDistance-halfWidth;

    if(lock.vertical==="top")
        sprite.y=top+lock.verticalDistance+halfHeight;
    else if(lock.vertical==="bottom")
        sprite.y=bottom-lock.verticalDistance-halfHeight;

    const minX=left+halfWidth;
    const maxX=right-halfWidth;
    const minY=top+halfHeight;
    const maxY=bottom-halfHeight;

    if(minX<=maxX)
        sprite.x=Math.max(minX,Math.min(maxX,sprite.x));
    else
        sprite.x=ENGINE.camera.x;

    if(minY<=maxY)
        sprite.y=Math.max(minY,Math.min(maxY,sprite.y));
    else
        sprite.y=ENGINE.camera.y;
}

function updateEdgeSprites(){
    Object.values(ENGINE.sprites).forEach(updateEdgeSprite);
}

async function executeBlock(block){
    if(!block||!ENGINE.running)return;

    if(block.type==="move"){
        const sprite=ENGINE.sprites[resolveValue(block.name)];

        if(sprite){
            sprite.edgeLock=null;
            sprite.x+=Number(resolveValue(block.x))||0;
            sprite.y+=Number(resolveValue(block.y))||0;
        }

        return;
    }

    if(block.type==="wait"){
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(resolveValue(block.time))||0)*1000));
        return;
    }

    if(block.type==="repeat"){
        for(let i=0;i<block.times&&ENGINE.running;i++)
            for(const child of block.blocks)
                await executeBlock(child);
    }
}

function runScripts(){
    ENGINE.scripts.forEach(script=>executeBlock(script));
}

function resizeGame(){
    const width=Math.max(1,window.innerWidth);
    const height=Math.max(1,window.innerHeight);
    const mobile=width<700;

    ENGINE.mobile=mobile;

    canvas.width=Math.ceil(width);
    canvas.height=Math.ceil(height);
    canvas.style.width=width+"px";
    canvas.style.height=height+"px";

    if(mobile){
        ENGINE.viewHeight=360;
        ENGINE.viewWidth=ENGINE.viewHeight*(width/height);
        ENGINE.unitScale=height/ENGINE.viewHeight;
    }else{
        ENGINE.unitScale=Math.min(width/640,height/360);
        ENGINE.viewWidth=width/ENGINE.unitScale;
        ENGINE.viewHeight=height/ENGINE.unitScale;
    }

    ENGINE.centerX=ENGINE.viewWidth/2;
    ENGINE.centerY=ENGINE.viewHeight/2;
    ENGINE.width=ENGINE.viewWidth;
    ENGINE.height=ENGINE.viewHeight;

    ctx.imageSmoothingEnabled=false;
    updateEdgeSprites();
}

function drawBackground(){
    if(ENGINE.backgroundLoaded&&ENGINE.backgroundImage){
        const image=ENGINE.backgroundImage;
        const width=640*ENGINE.backgroundScale;
        const height=width*(image.naturalHeight/image.naturalWidth);
        const x=canvas.width/2-width*ENGINE.unitScale/2;
        const y=canvas.height/2-height*ENGINE.unitScale/2;

        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(image,x,y,width*ENGINE.unitScale,height*ENGINE.unitScale);
    }else{
        ctx.fillStyle=ENGINE.background;
        ctx.fillRect(0,0,canvas.width,canvas.height);
    }
}

function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawBackground();
    updateEdgeSprites();

    Object.values(ENGINE.sprites)
        .sort((a,b)=>a.layer-b.layer)
        .forEach(sprite=>sprite.draw());
}

function gameLoop(timestamp){
    if(!ENGINE.running)return;

    if(!ENGINE.lastTime)
        ENGINE.lastTime=timestamp;

    ENGINE.deltaTime=(timestamp-ENGINE.lastTime)/1000;
    ENGINE.lastTime=timestamp;

    render();

    requestAnimationFrame(gameLoop);
}

window.addEventListener("resize",resizeGame);

window.addEventListener("load",()=>{
    resizeGame();
    runScripts();
    requestAnimationFrame(gameLoop);
});

window.MLGame={ENGINE,canvas,ctx};