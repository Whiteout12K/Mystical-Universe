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

function sensingTarget(s){return s&&!s.deleted&&s.loaded&&s.visible&&s.touchable!==false;}
function spriteCorners(s){
    const angle=s.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
        const dx=x*s.width/2,dy=y*s.height/2;
        return {x:s.x+dx*cos+dy*sin,y:s.y-dx*sin+dy*cos};
    });
}
function spritePointToPixel(s,point,mask){
    const angle=s.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const dx=point.x-s.x,dy=point.y-s.y;
    return {
        x:(.5+(dx*cos-dy*sin)/(s.width*s.flipX))*mask.width,
        y:(.5-(dx*sin+dy*cos)/(s.height*s.flipY))*mask.height
    };
}
function touchingMouse(sprite){
    return sensingValue("touchingMouse",c=>{
        const target=sensingSprite(sprite,c);
        if(!sensingTarget(target))return false;
        const mask=getImagePixels(target.image);if(!mask)return false;
        const point=spritePointToPixel(target,getCanvasPoint(),mask);
        const x=Math.floor(point.x),y=Math.floor(point.y);
        return x>=0&&y>=0&&x<mask.width&&y<mask.height&&mask.pixels[(y*mask.width+x)*4+3]>0;
    });
}
const collisionGeometry=new WeakMap();
function spriteCollisionGeometry(s){
    const mask=getImagePixels(s.image);if(!mask)return null;
    const key=[s.x,s.y,s.width,s.height,s.rotation,s.flipX,s.flipY].join("|");
    const cached=collisionGeometry.get(s);
    if(cached?.mask===mask&&cached.key===key)return cached;
    const angle=s.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const transform=(x,y)=>{
        const dx=(x/mask.width-.5)*s.width*s.flipX,dy=(.5-y/mask.height)*s.height*s.flipY;
        return {x:s.x+dx*cos+dy*sin,y:s.y-dx*sin+dy*cos};
    };
    const rectangles=mask.rectangles.map(r=>{
        const points=[transform(r.x,r.y),transform(r.x+r.width,r.y),transform(r.x+r.width,r.y+r.height),transform(r.x,r.y+r.height)];
        return {points,left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y))};
    });
    const geometry={mask,key,rectangles,axes:[{x:cos,y:-sin},{x:sin,y:cos}],
        left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity};
    for(const r of rectangles){geometry.left=Math.min(geometry.left,r.left);geometry.right=Math.max(geometry.right,r.right);geometry.bottom=Math.min(geometry.bottom,r.bottom);geometry.top=Math.max(geometry.top,r.top);}
    collisionGeometry.set(s,geometry);return geometry;
}
function collisionBoundsOverlap(a,b){return a.left<b.right&&b.left<a.right&&a.bottom<b.top&&b.bottom<a.top;}
function collisionRectanglesOverlap(a,b,axes){
    if(!collisionBoundsOverlap(a,b))return false;
    for(const axis of axes){
        let minA=Infinity,maxA=-Infinity,minB=Infinity,maxB=-Infinity;
        for(const p of a.points){const n=p.x*axis.x+p.y*axis.y;minA=Math.min(minA,n);maxA=Math.max(maxA,n);}
        for(const p of b.points){const n=p.x*axis.x+p.y*axis.y;minB=Math.min(minB,n);maxB=Math.max(maxB,n);}
        if(maxA<=minB||maxB<=minA)return false;
    }
    return true;
}
function touchingSprite(sprite,sprite2){
    return sensingValue("touchingSprite",c=>{
        const a=sensingSprite(sprite,c),b=sensingSprite(sprite2,c);
        if(!sensingTarget(a)||!sensingTarget(b))return false;
        // Reject separated full costume bounds before reading masks or building geometry.
        const bounds=s=>{const points=spriteCorners(s);return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y))};};
        if(!collisionBoundsOverlap(bounds(a),bounds(b)))return false;
        const A=spriteCollisionGeometry(a),B=spriteCollisionGeometry(b);
        if(!A||!B||!collisionBoundsOverlap(A,B))return false;
        const axes=[...A.axes,...B.axes];
        for(const left of A.rectangles)for(const right of B.rectangles)
            if(collisionRectanglesOverlap(left,right,axes))return true;
        return false;
    });
}
function spriteHasColor(sprite,color_hex){
    return sensingValue("spriteHasColor",c=>{
        const target=sensingSprite(sprite,c),color=parseColor(resolveValue(color_hex,c));
        if(!sensingTarget(target)||!color)return false;
        const mask=getImagePixels(target.image);if(!mask)return false;
        const key=(color.r<<16)|(color.g<<8)|color.b;
        if(mask.colors.has(key))return mask.colors.get(key);
        let found=false;
        for(let i=0;i<mask.pixels.length;i+=4){
            const data=mask.pixels;
            if(data[i+3]&&data[i]===color.r&&data[i+1]===color.g&&data[i+2]===color.b){found=true;break;}
        }
        if(mask.colors.size>=128)mask.colors.delete(mask.colors.keys().next().value);
        mask.colors.set(key,found);return found;
    });
}
// Preserve the existing own-costume API. The stage-contact variant is explicit.
const touchingColor=spriteHasColor;
let stageColorCanvas=null,stageMaskCanvas=null;
function touchingStageColor(sprite,color_hex){
    return sensingValue("touchingStageColor",c=>{
        const target=sensingSprite(sprite,c),color=parseColor(resolveValue(color_hex,c));
        if(!sensingTarget(target)||!color)return false;
        const corners=spriteCorners(target),left=Math.floor(Math.min(...corners.map(p=>p.x))),top=Math.ceil(Math.max(...corners.map(p=>p.y)));
        const width=Math.max(1,Math.ceil(Math.max(...corners.map(p=>p.x))-left)),height=Math.max(1,Math.ceil(top-Math.min(...corners.map(p=>p.y))));
        const stage=stageColorCanvas||=document.createElement("canvas"),mask=stageMaskCanvas||=document.createElement("canvas");
        if(stage.width!==width||stage.height!==height){stage.width=mask.width=width;stage.height=mask.height=height;}
        const sc=stage.getContext("2d",{willReadFrequently:true}),mc=mask.getContext("2d",{willReadFrequently:true});
        sc.clearRect(0,0,width,height);mc.clearRect(0,0,width,height);
        sc.fillStyle=ENGINE.background;sc.fillRect(0,0,width,height);
        if(ENGINE.backgroundLoaded){
            const effect=applyCanvasEffects(),w=640*ENGINE.backgroundScale,h=w*ENGINE.backgroundImage.naturalHeight/ENGINE.backgroundImage.naturalWidth;
            if(effect){sc.globalAlpha=1-effect.ghost/100;sc.drawImage(effect.source,ENGINE.camera.x-w/2-left,top-ENGINE.camera.y-h/2,w,h);sc.globalAlpha=1;}
        }
        const paint=(context,s)=>{
            const effect=applySpriteEffects(s);if(!effect)return;
            context.save();context.globalAlpha=1;context.imageSmoothingEnabled=false;
            context.translate(s.x-left,top-s.y);context.rotate(s.rotation*Math.PI/180);context.scale(s.flipX,s.flipY);
            context.drawImage(effect.source,-s.width/2,-s.height/2,s.width,s.height);context.restore();
        };
        updateSpriteOrder();
        for(const s of ENGINE.spriteOrder)if(s!==target&&!s.deleted&&s.visible&&s.loaded)paint(sc,s);
        paint(mc,target);
        try{
            const pixels=sc.getImageData(0,0,width,height).data,alpha=mc.getImageData(0,0,width,height).data;
            for(let i=0;i<pixels.length;i+=4)if(alpha[i+3]&&pixels[i]===color.r&&pixels[i+1]===color.g&&pixels[i+2]===color.b)return true;
        }catch(error){stageColorCanvas=stageMaskCanvas=null;throw new Error("Cannot read stage colors; use same-origin or CORS-enabled images: "+error.message);}
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

// Seconds elapsed in the latest simulation frame; use for frame-independent motion.
function deltaTime(){return createReporter("deltaTime");}
registerReporter("deltaTime",()=>ENGINE.deltaTime);
