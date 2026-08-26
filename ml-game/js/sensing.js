// Backend code for sensing code blocks.

const SENSING={
    mouseX:0,
    mouseY:0,
    leftClick:false,
    rightClick:false,
    keys:{}
};

function getMousePosition(event){
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width;
    const scaleY=canvas.height/rect.height;

    SENSING.mouseX=(event.clientX-rect.left)*scaleX;
    SENSING.mouseY=(event.clientY-rect.top)*scaleY;
}

function getCanvasPoint(){
    return{
        x:(SENSING.mouseX-canvas.width/2)/ENGINE.unitScale+ENGINE.camera.x,
        y:(SENSING.mouseY-canvas.height/2)/ENGINE.unitScale+ENGINE.camera.y
    };
}

function touchingMouse(sprite){
    sprite=ENGINE.sprites[resolveValue(sprite)];
    if(!sprite||!sprite.loaded)return false;

    const mouse=getCanvasPoint();
    const halfWidth=sprite.width/2;
    const halfHeight=sprite.height/2;

    return mouse.x>=sprite.x-halfWidth&&
        mouse.x<=sprite.x+halfWidth&&
        mouse.y>=sprite.y-halfHeight&&
        mouse.y<=sprite.y+halfHeight;
}

function touchingSprite(sprite,sprite2){
    sprite=ENGINE.sprites[resolveValue(sprite)];
    sprite2=ENGINE.sprites[resolveValue(sprite2)];

    if(!sprite||!sprite2||!sprite.loaded||!sprite2.loaded)return false;

    return Math.abs(sprite.x-sprite2.x)<
        (sprite.width+sprite2.width)/2&&
        Math.abs(sprite.y-sprite2.y)<
        (sprite.height+sprite2.height)/2;
}

function touchingColor(sprite,color_hex){
    sprite=ENGINE.sprites[resolveValue(sprite)];
    color_hex=String(resolveValue(color_hex)).toLowerCase();

    if(!sprite||!sprite.loaded)return false;

    const width=Math.max(1,Math.ceil(sprite.width));
    const height=Math.max(1,Math.ceil(sprite.height));

    const offscreen=document.createElement("canvas");
    offscreen.width=width;
    offscreen.height=height;

    const offctx=offscreen.getContext("2d",{willReadFrequently:true});
    offctx.imageSmoothingEnabled=false;
    offctx.drawImage(sprite.image,0,0,width,height);

    const target=parseColor(color_hex);
    if(!target)return false;

    const data=offctx.getImageData(0,0,width,height).data;

    for(let i=0;i<data.length;i+=4){
        if(data[i]===target.r&&
            data[i+1]===target.g&&
            data[i+2]===target.b&&
            data[i+3]>0)
            return true;
    }

    return false;
}

function parseColor(color){
    color=color.replace("#","").trim();

    if(/^[0-9a-f]{3}$/i.test(color))
        color=color.split("").map(c=>c+c).join("");

    if(!/^[0-9a-f]{6}$/i.test(color))return null;

    return{
        r:parseInt(color.substring(0,2),16),
        g:parseInt(color.substring(2,4),16),
        b:parseInt(color.substring(4,6),16)
    };
}

function distanceMouse(sprite){
    sprite=ENGINE.sprites[resolveValue(sprite)];
    if(!sprite)return 0;

    const mouse=getCanvasPoint();
    return Math.hypot(
        sprite.x-mouse.x,
        sprite.y-mouse.y
    );
}

function distanceSprite(sprite,sprite2){
    sprite=ENGINE.sprites[resolveValue(sprite)];
    sprite2=ENGINE.sprites[resolveValue(sprite2)];

    if(!sprite||!sprite2)return 0;

    return Math.hypot(
        sprite.x-sprite2.x,
        sprite.y-sprite2.y
    );
}

function keyPressed(key){
    key=String(resolveValue(key)).toLowerCase();

    const keyMap={
        rightarrow:"arrowright",
        leftarrow:"arrowleft",
        uparrow:"arrowup",
        downarrow:"arrowdown",
        space:" ",
        shift:"shift",
        leftclick:"leftclick",
        rightclick:"rightclick"
    };

    key=keyMap[key]||key;

    return!!SENSING.keys[key];
}

function mouseX(){
    return getCanvasPoint().x;
}

function mouseY(){
    return getCanvasPoint().y;
}

function currentYear(){
    return new Date().getFullYear();
}

function currentMonth(){
    return new Date().getMonth()+1;
}

function currentDay(){
    return new Date().getDate();
}

function currentHour(){
    return new Date().getHours();
}

function currentMin(){
    return new Date().getMinutes();
}

window.addEventListener("mousemove",getMousePosition);

window.addEventListener("mousedown",event=>{
    getMousePosition(event);

    if(event.button===0)
        SENSING.leftClick=true;

    if(event.button===2)
        SENSING.rightClick=true;

    SENSING.keys[event.button===0?"leftclick":"rightclick"]=true;
});

window.addEventListener("mouseup",event=>{
    if(event.button===0){
        SENSING.leftClick=false;
        SENSING.keys.leftclick=false;
    }

    if(event.button===2){
        SENSING.rightClick=false;
        SENSING.keys.rightclick=false;
    }
});

window.addEventListener("keydown",event=>{
    SENSING.keys[event.key.toLowerCase()]=true;
});

window.addEventListener("keyup",event=>{
    SENSING.keys[event.key.toLowerCase()]=false;
});

window.addEventListener("blur",()=>{
    SENSING.keys={};
    SENSING.leftClick=false;
    SENSING.rightClick=false;
});

window.addEventListener("contextmenu",event=>event.preventDefault());