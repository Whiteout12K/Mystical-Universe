// Backend code for each code block.

const ENGINE={
    width:640,height:360,centerX:0,centerY:0,viewWidth:640,viewHeight:360,unitScale:1,
    background:"#000000",backgroundImage:null,backgroundLoaded:false,backgroundScale:1,
    sprites:{},variables:{},running:true,lastTime:0,deltaTime:0,camera:{x:0,y:0},scripts:[],
    mobile:false
};

const canvas=document.getElementById("game-canvas");
const ctx=canvas.getContext("2d",{alpha:false});
ctx.imageSmoothingEnabled=false;

class Sprite{
    constructor(name){
        Object.assign(this,{name,x:0,y:0,visible:true,costume:null,image:null,scale:1,width:160,height:160,loaded:false,opacity:1,rotation:0,layer:0,variables:{},velocityX:0,velocityY:0});
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

function createSprite(name){
    if(!name)return null;
    return ENGINE.sprites[name]||(ENGINE.sprites[name]=new Sprite(name));
}

function setVar(name,value){
    name=String(resolveValue(name));
    ENGINE.variables[name]=resolveValue(value);
    return ENGINE.variables[name];
}

function getVar(name){
    return{type:"variable",name:String(resolveValue(name))};
}

function join(...values){
    return{type:"join",values};
}

function canvasColor(color){
    color=resolveValue(color);
    if(typeof color==="string"){
        ENGINE.background=color;
        ENGINE.backgroundImage=null;
        ENGINE.backgroundLoaded=false;
    }
}

function canvasCostume(path,scale=1){
    path=resolveValue(path);
    scale=Number(resolveValue(scale))||1;
    if(!path)return;
    const image=new Image();
    ENGINE.backgroundImage=image;
    ENGINE.backgroundScale=scale;
    ENGINE.backgroundLoaded=false;
    image.onload=()=>ENGINE.backgroundLoaded=true;
    image.onerror=()=>{
        ENGINE.backgroundLoaded=false;
        console.warn("Could not load background costume:",path);
    };
    image.src=path;
}

function spriteCostume(name,path,scale=1){
    name=resolveValue(name);
    path=resolveValue(path);
    scale=Number(resolveValue(scale))||1;
    const sprite=ENGINE.sprites[name];
    if(sprite)sprite.setCostume(path,scale);
}

function moveTo(name,x,y){
    name=resolveValue(name);
    x=Number(resolveValue(x))||0;
    y=Number(resolveValue(y))||0;
    const sprite=ENGINE.sprites[name];
    if(!sprite)return;
    sprite.x=x;
    sprite.y=y;
}

function moveBy(name,x,y){
    return{type:"move",name:resolveValue(name),x:resolveValue(x),y:resolveValue(y)};
}

function moveToEdge(name,horizontalEdge,x,verticalEdge,y){
    name=resolveValue(name);
    horizontalEdge=String(resolveValue(horizontalEdge)).toLowerCase();
    verticalEdge=String(resolveValue(verticalEdge)).toLowerCase();
    x=Number(resolveValue(x))||0;
    y=Number(resolveValue(y))||0;

    const sprite=ENGINE.sprites[name];
    if(!sprite)return;

    sprite.x=horizontalEdge==="left"?ENGINE.camera.x-ENGINE.viewWidth/2+x:horizontalEdge==="right"?ENGINE.camera.x+ENGINE.viewWidth/2-x:ENGINE.camera.x+x;
    sprite.y=verticalEdge==="top"?ENGINE.camera.y-ENGINE.viewHeight/2+y:verticalEdge==="bottom"?ENGINE.camera.y+ENGINE.viewHeight/2-y:ENGINE.camera.y+y;
}

function setCostume(name,path,scale){
    name=resolveValue(name);
    path=resolveValue(path);
    const sprite=ENGINE.sprites[name];
    if(sprite)sprite.setCostume(path,scale===undefined?sprite.scale:Number(resolveValue(scale))||1);
}

function wait(time){
    return{type:"wait",time:Math.max(0,Number(resolveValue(time))||0)};
}

function repeat(times,...blocks){
    return{type:"repeat",times:Math.max(0,Math.floor(Number(resolveValue(times))||0)),blocks};
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

async function executeBlock(block){
    if(!block||!ENGINE.running)return;

    if(block.type==="move"){
        const sprite=ENGINE.sprites[resolveValue(block.name)];
        if(sprite){
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
    Object.values(ENGINE.sprites).sort((a,b)=>a.layer-b.layer).forEach(sprite=>sprite.draw());
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