/* SENSING BLOCKS */

const SENSING={
    mouseX:0,mouseY:0,leftClick:false,rightClick:false,keys:{}
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
        y:-(SENSING.mouseY-canvas.height/2)/ENGINE.unitScale+ENGINE.camera.y
    };
}

function sensingValue(type,evaluate){
    return createReporter(type,{evaluate});
}

function sensingSprite(name,c=null){
    return getContextSprite(name,c);
}


/* TOUCHING */

function touchingMouse(sprite){
    return sensingValue("touchingMouse",c=>{
        const target=sensingSprite(sprite,c);
        if(!target||target.deleted||!target.loaded)return false;

        const mouse=getCanvasPoint();
        const hw=target.width/2,hh=target.height/2;

        return mouse.x>=target.x-hw&&mouse.x<=target.x+hw&&
               mouse.y>=target.y-hh&&mouse.y<=target.y+hh;
    });
}

function touchingSprite(sprite,sprite2){
    return sensingValue("touchingSprite",c=>{
        const a=sensingSprite(sprite,c),b=sensingSprite(sprite2,c);
        if(!a||!b||a.deleted||b.deleted||!a.loaded||!b.loaded)return false;

        return Math.abs(a.x-b.x)<(a.width+b.width)/2&&
               Math.abs(a.y-b.y)<(a.height+b.height)/2;
    });
}

function touchingColor(sprite,color_hex){
    return sensingValue("touchingColor",c=>{
        const targetSprite=sensingSprite(sprite,c);
        const color=String(resolveValue(color_hex,c)).toLowerCase();

        if(!targetSprite||targetSprite.deleted||!targetSprite.loaded)return false;

        const target=parseColor(color);
        if(!target)return false;

        const width=Math.max(1,Math.ceil(targetSprite.width));
        const height=Math.max(1,Math.ceil(targetSprite.height));
        const offscreen=document.createElement("canvas");

        offscreen.width=width;
        offscreen.height=height;

        const offctx=offscreen.getContext("2d",{willReadFrequently:true});
        offctx.imageSmoothingEnabled=false;
        offctx.drawImage(targetSprite.image,0,0,width,height);

        const data=offctx.getImageData(0,0,width,height).data;

        for(let i=0;i<data.length;i+=4)
            if(data[i]===target.r&&data[i+1]===target.g&&data[i+2]===target.b&&data[i+3]>0)
                return true;

        return false;
    });
}

function parseColor(color){
    color=String(color).replace(/^#/,"").trim();

    if(/^[0-9a-f]{3}$/i.test(color))
        color=color.split("").map(c=>c+c).join("");

    if(!/^[0-9a-f]{6}$/i.test(color))return null;

    return{
        r:parseInt(color.substring(0,2),16),
        g:parseInt(color.substring(2,4),16),
        b:parseInt(color.substring(4,6),16)
    };
}


/* DISTANCE */

function distanceMouse(sprite){
    return sensingValue("distanceMouse",c=>{
        const targetSprite=sensingSprite(sprite,c);
        if(!targetSprite||targetSprite.deleted)return 0;

        const mouse=getCanvasPoint();

        return Math.hypot(
            targetSprite.x-mouse.x,
            targetSprite.y-mouse.y
        );
    });
}

function distanceSprite(sprite,sprite2){
    return sensingValue("distanceSprite",c=>{
        const a=sensingSprite(sprite,c),b=sensingSprite(sprite2,c);
        if(!a||!b||a.deleted||b.deleted)return 0;

        return Math.hypot(a.x-b.x,a.y-b.y);
    });
}


/* KEYBOARD / POINTER */

function keyPressed(key){
    return sensingValue("keyPressed",c=>{
        let value=String(resolveValue(key,c)).toLowerCase();

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

        value=keyMap[value]||value;

        return!!SENSING.keys[value];
    });
}


/* MOUSE */

function mouseX(){
    return sensingValue("mouseX",()=>getCanvasPoint().x);
}

function mouseY(){
    return sensingValue("mouseY",()=>getCanvasPoint().y);
}


/* DATE / TIME */

function currentYear(){
    return sensingValue("currentYear",()=>new Date().getFullYear());
}

function currentMonth(){
    return sensingValue("currentMonth",()=>new Date().getMonth()+1);
}

function currentDay(){
    return sensingValue("currentDay",()=>new Date().getDate());
}

function currentHour(){
    return sensingValue("currentHour",()=>new Date().getHours());
}

function currentMin(){
    return sensingValue("currentMin",()=>new Date().getMinutes());
}


/* INPUT EVENTS */

window.addEventListener("pointermove",event=>{
    getMousePosition(event);
});

window.addEventListener("pointerdown",event=>{
    getMousePosition(event);

    /*
     * Primary pointer = left click.
     * This includes the primary mouse button and a finger press
     * on mobile/touch devices.
     */
    if(event.isPrimary&&event.button===0){
        SENSING.leftClick=true;
        SENSING.keys.leftclick=true;
    }

    /*
     * Right mouse button only.
     * Touch/pointer events with button 2 are not treated as
     * leftclick and do not overwrite the special rightclick state.
     */
    if(event.pointerType==="mouse"&&event.button===2){
        SENSING.rightClick=true;
        SENSING.keys.rightclick=true;
    }
});

window.addEventListener("pointerup",event=>{
    if(event.isPrimary&&event.button===0){
        SENSING.leftClick=false;
        SENSING.keys.leftclick=false;
    }

    if(event.pointerType==="mouse"&&event.button===2){
        SENSING.rightClick=false;
        SENSING.keys.rightclick=false;
    }
});

window.addEventListener("pointercancel",event=>{
    if(event.isPrimary){
        SENSING.leftClick=false;
        SENSING.keys.leftclick=false;
    }

    if(event.pointerType==="mouse"){
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
