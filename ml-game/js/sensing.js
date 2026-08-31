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

    SENSING.mouseX=
        (event.clientX-rect.left)*scaleX;

    SENSING.mouseY=
        (event.clientY-rect.top)*scaleY;
}


function getCanvasPoint(){
    return{
        x:
            (SENSING.mouseX-canvas.width/2)/
            ENGINE.unitScale+
            ENGINE.camera.x,

        y:
            -(SENSING.mouseY-canvas.height/2)/
            ENGINE.unitScale+
            ENGINE.camera.y
    };
}


function sensingValue(type,evaluate){
    return createReporter(
        type,
        {evaluate}
    );
}


function sensingSprite(name,c=null){
    return getContextSprite(name,c);
}


function touchingMouse(sprite){
    return sensingValue(
        "touchingMouse",
        c=>{
            const target=
                sensingSprite(sprite,c);

            if(
                !target||
                target.deleted||
                !target.loaded
            )
                return false;

            const mouse=getCanvasPoint();

            const halfWidth=
                target.width/2;

            const halfHeight=
                target.height/2;

            return(
                mouse.x>=target.x-halfWidth&&
                mouse.x<=target.x+halfWidth&&
                mouse.y>=target.y-halfHeight&&
                mouse.y<=target.y+halfHeight
            );
        }
    );
}


function touchingSprite(sprite,sprite2){
    return sensingValue(
        "touchingSprite",
        c=>{
            const a=
                sensingSprite(sprite,c);

            const b=
                sensingSprite(sprite2,c);

            if(
                !a||
                !b||
                a.deleted||
                b.deleted||
                !a.loaded||
                !b.loaded
            )
                return false;

            return(
                Math.abs(a.x-b.x)<
                    (a.width+b.width)/2&&
                Math.abs(a.y-b.y)<
                    (a.height+b.height)/2
            );
        }
    );
}


function touchingColor(sprite,color_hex){
    return sensingValue(
        "touchingColor",
        c=>{
            const targetSprite=
                sensingSprite(sprite,c);

            const color=
                String(
                    resolveValue(color_hex,c)
                ).toLowerCase();

            if(
                !targetSprite||
                targetSprite.deleted||
                !targetSprite.loaded
            )
                return false;

            const target=parseColor(color);

            if(!target)
                return false;

            const width=Math.max(
                1,
                Math.ceil(targetSprite.width)
            );

            const height=Math.max(
                1,
                Math.ceil(targetSprite.height)
            );

            const offscreen=
                document.createElement("canvas");

            offscreen.width=width;
            offscreen.height=height;

            const offctx=
                offscreen.getContext(
                    "2d",
                    {willReadFrequently:true}
                );

            offctx.imageSmoothingEnabled=false;

            offctx.drawImage(
                targetSprite.image,
                0,
                0,
                width,
                height
            );

            const data=
                offctx.getImageData(
                    0,
                    0,
                    width,
                    height
                ).data;

            for(
                let i=0;
                i<data.length;
                i+=4
            ){
                if(
                    data[i]===target.r&&
                    data[i+1]===target.g&&
                    data[i+2]===target.b&&
                    data[i+3]>0
                )
                    return true;
            }

            return false;
        }
    );
}


function parseColor(color){
    color=String(color)
        .replace(/^#/,"")
        .trim();

    if(/^[0-9a-f]{3}$/i.test(color)){
        color=color
            .split("")
            .map(c=>c+c)
            .join("");
    }

    if(!/^[0-9a-f]{6}$/i.test(color))
        return null;

    return{
        r:parseInt(
            color.substring(0,2),
            16
        ),

        g:parseInt(
            color.substring(2,4),
            16
        ),

        b:parseInt(
            color.substring(4,6),
            16
        )
    };
}


function distanceMouse(sprite){
    return sensingValue(
        "distanceMouse",
        c=>{
            const targetSprite=
                sensingSprite(sprite,c);

            if(!targetSprite||targetSprite.deleted)
                return 0;

            const mouse=getCanvasPoint();

            return Math.hypot(
                targetSprite.x-mouse.x,
                targetSprite.y-mouse.y
            );
        }
    );
}


function distanceSprite(sprite,sprite2){
    return sensingValue(
        "distanceSprite",
        c=>{
            const a=
                sensingSprite(sprite,c);

            const b=
                sensingSprite(sprite2,c);

            if(
                !a||
                !b||
                a.deleted||
                b.deleted
            )
                return 0;

            return Math.hypot(
                a.x-b.x,
                a.y-b.y
            );
        }
    );
}


function keyPressed(key){
    return sensingValue(
        "keyPressed",
        c=>{
            let value=
                String(
                    resolveValue(key,c)
                ).toLowerCase();

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

            value=
                keyMap[value]||
                value;

            return!!SENSING.keys[value];
        }
    );
}


function mouseX(){
    return sensingValue(
        "mouseX",
        ()=>{
            return getCanvasPoint().x;
        }
    );
}


function mouseY(){
    return sensingValue(
        "mouseY",
        ()=>{
            return getCanvasPoint().y;
        }
    );
}


function currentYear(){
    return sensingValue(
        "currentYear",
        ()=>{
            return new Date().getFullYear();
        }
    );
}


function currentMonth(){
    return sensingValue(
        "currentMonth",
        ()=>{
            return new Date().getMonth()+1;
        }
    );
}


function currentDay(){
    return sensingValue(
        "currentDay",
        ()=>{
            return new Date().getDate();
        }
    );
}


function currentHour(){
    return sensingValue(
        "currentHour",
        ()=>{
            return new Date().getHours();
        }
    );
}


function currentMin(){
    return sensingValue(
        "currentMin",
        ()=>{
            return new Date().getMinutes();
        }
    );
}


window.addEventListener(
    "mousemove",
    getMousePosition
);


window.addEventListener(
    "mousedown",
    event=>{
        getMousePosition(event);

        if(event.button===0){
            SENSING.leftClick=true;
            SENSING.keys.leftclick=true;
        }

        if(event.button===2){
            SENSING.rightClick=true;
            SENSING.keys.rightclick=true;
        }
    }
);


window.addEventListener(
    "mouseup",
    event=>{
        if(event.button===0){
            SENSING.leftClick=false;
            SENSING.keys.leftclick=false;
        }

        if(event.button===2){
            SENSING.rightClick=false;
            SENSING.keys.rightclick=false;
        }
    }
);


window.addEventListener(
    "keydown",
    event=>{
        SENSING.keys[
            event.key.toLowerCase()
        ]=true;
    }
);


window.addEventListener(
    "keyup",
    event=>{
        SENSING.keys[
            event.key.toLowerCase()
        ]=false;
    }
);


window.addEventListener(
    "blur",
    ()=>{
        SENSING.keys={};
        SENSING.leftClick=false;
        SENSING.rightClick=false;
    }
);


window.addEventListener(
    "contextmenu",
    event=>event.preventDefault()
);
