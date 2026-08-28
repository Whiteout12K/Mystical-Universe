/* =========================================================
   MYSTICAL LEGENDS GAME ENGINE - UI SYSTEM
   ========================================================= */

const ML_UI={
    elements:{},
    order:[],
    nextId:1
};


/* =========================================================
   HELPERS
   ========================================================= */

function uiValue(v,f=""){
    v=resolveValue(v);
    return v===null||v===undefined?f:v;
}

function uiNumber(v,f=0){
    v=Number(uiValue(v));
    return Number.isFinite(v)?v:f;
}

function uiString(v,f=""){
    v=uiValue(v);
    return v===null||v===undefined?f:String(v);
}

function uiBool(v,f=false){
    v=uiValue(v);
    if(typeof v==="boolean")return v;
    if(v==="true"||v==="1")return true;
    if(v==="false"||v==="0"||v==="")return false;
    return v===null||v===undefined?f:Boolean(v);
}

function uiScale(){
    return ENGINE.unitScale||1;
}

/* Same screen/world positioning convention as sprites.
   X: right is positive.
   Y: up is positive. */

function uiX(x){
    return canvas.width/2+uiNumber(x)*uiScale();
}

function uiY(y){
    return canvas.height/2-uiNumber(y)*uiScale();
}

function uiWidth(v){
    return uiNumber(v)*uiScale();
}

function uiHeight(v){
    return uiNumber(v)*uiScale();
}


/* =========================================================
   ELEMENTS
   ========================================================= */

function uiCreateElement(id,type="box",data={}){
    id=uiString(id);

    if(!id)id="ui_"+ML_UI.nextId++;

    let e=ML_UI.elements[id];

    if(e){
        e.type=type||e.type;
        Object.assign(e,data);
        return e;
    }

    e={
        id,type,
        visible:true,opacity:1,
        x:0,y:0,width:100,height:40,
        rotation:0,scale:1,layer:0,
        anchor:"center",
        ...data
    };

    ML_UI.elements[id]=e;
    ML_UI.order.push(id);
    return e;
}

function uiGetElement(id){
    return ML_UI.elements[uiString(id)]||null;
}

function uiDeleteElement(id){
    id=uiString(id);
    if(!ML_UI.elements[id])return;

    delete ML_UI.elements[id];

    const i=ML_UI.order.indexOf(id);
    if(i>=0)ML_UI.order.splice(i,1);
}

function uiClearElements(){
    ML_UI.elements={};
    ML_UI.order=[];
}

function uiSortElements(){
    ML_UI.order.sort((a,b)=>{
        const A=ML_UI.elements[a],B=ML_UI.elements[b];
        return uiNumber(A?.layer)-uiNumber(B?.layer);
    });
}


/* =========================================================
   POSITIONING
   ========================================================= */

function uiAnchorOffset(w,h,anchor){
    w=uiWidth(w);
    h=uiHeight(h);

    switch(uiString(anchor,"center").toLowerCase()){
        case"topleft":return[0,0];
        case"top":return[-w/2,0];
        case"topright":return[-w,0];
        case"left":return[0,-h/2];
        case"right":return[-w,-h/2];
        case"bottomleft":return[0,-h];
        case"bottom":return[-w/2,-h];
        case"bottomright":return[-w,-h];
        default:return[-w/2,-h/2];
    }
}

function uiPosition(e){
    const o=uiAnchorOffset(e.width,e.height,e.anchor);
    return[uiX(e.x)+o[0],uiY(e.y)+o[1]];
}


/* =========================================================
   DRAW HELPERS
   ========================================================= */

function uiRoundRect(x,y,w,h,r){
    r=Math.max(0,Math.min(uiNumber(r)*uiScale(),Math.abs(w)/2,Math.abs(h)/2));

    ctx.beginPath();

    if(ctx.roundRect){
        ctx.roundRect(x,y,w,h,r);
        return;
    }

    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
}

function uiGradient(e,x,y,w,h){
    if(!e.gradient)return uiString(e.color,"#fff");

    const g=e.gradient;
    const d=uiString(g.direction,"vertical").toLowerCase();

    let gradient;

    if(d==="horizontal")
        gradient=ctx.createLinearGradient(x,y,x+w,y);
    else if(d==="diagonal")
        gradient=ctx.createLinearGradient(x,y,x+w,y+h);
    else
        gradient=ctx.createLinearGradient(x,y,x,y+h);

    const color=uiString(e.color,"#fff");

    gradient.addColorStop(0,uiString(g.from,color));
    gradient.addColorStop(1,uiString(g.to,color));

    return gradient;
}

function uiShadow(e){
    if(!e.shadow)return;

    ctx.shadowColor=uiString(e.shadow.color,"rgba(0,0,0,.5)");
    ctx.shadowBlur=uiNumber(e.shadow.blur)*uiScale();
    ctx.shadowOffsetX=uiNumber(e.shadow.x)*uiScale();
    ctx.shadowOffsetY=uiNumber(e.shadow.y)*uiScale();
}

function uiClearShadow(){
    ctx.shadowColor="transparent";
    ctx.shadowBlur=0;
    ctx.shadowOffsetX=0;
    ctx.shadowOffsetY=0;
}


/* =========================================================
   TEXT
   ========================================================= */

function uiDrawText(e){
    const text=uiString(e.text);
    const size=Math.max(1,uiNumber(e.size,24))*uiScale();

    ctx.font=
        `${uiString(e.style,"normal")} `+
        `${uiString(e.weight,"normal")} `+
        `${size}px ${uiString(e.font,"Arial")}`;

    ctx.textAlign=uiString(e.align,"center");
    ctx.textBaseline=uiString(e.baseline,"middle");
    ctx.fillStyle=uiString(e.color,"#fff");

    uiShadow(e);

    const x=uiX(e.x);
    const y=uiY(e.y);
    const outline=uiNumber(e.outlineWidth);

    if(outline>0){
        ctx.lineWidth=outline*uiScale();
        ctx.strokeStyle=uiString(e.outlineColor,"#000");
        ctx.strokeText(text,x,y);
    }

    ctx.fillText(text,x,y);
    uiClearShadow();
}


/* =========================================================
   BOX
   ========================================================= */

function uiDrawBox(e){
    const w=uiWidth(e.width);
    const h=uiHeight(e.height);
    const p=uiPosition(e);

    ctx.save();
    ctx.translate(p[0]+w/2,p[1]+h/2);
    ctx.rotate(uiNumber(e.rotation)*Math.PI/180);
    ctx.scale(Math.max(.001,uiNumber(e.scale,1)),Math.max(.001,uiNumber(e.scale,1)));

    const x=-w/2,y=-h/2;

    uiRoundRect(x,y,w,h,e.radius);
    uiShadow(e);
    ctx.fillStyle=uiGradient(e,x,y,w,h);
    ctx.fill();

    const outline=uiNumber(e.outlineWidth);

    if(outline>0){
        ctx.lineWidth=outline*uiScale();
        ctx.strokeStyle=uiString(e.outlineColor,"#fff");
        ctx.stroke();
    }

    uiClearShadow();
    ctx.restore();
}


/* =========================================================
   LINE
   ========================================================= */

function uiDrawLine(e){
    const x1=uiX(e.x);
    const y1=uiY(e.y);
    const x2=uiX(uiNumber(e.x)+uiNumber(e.toX,100));
    const y2=uiY(uiNumber(e.y)+uiNumber(e.toY));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);

    ctx.lineWidth=Math.max(1,uiNumber(e.width,2)*uiScale());
    ctx.strokeStyle=uiString(e.color,"#fff");
    ctx.lineCap=uiString(e.cap,"round");

    uiShadow(e);
    ctx.stroke();
    uiClearShadow();
    ctx.restore();
}


/* =========================================================
   CIRCLE
   ========================================================= */

function uiDrawCircle(e){
    const r=Math.max(0,uiNumber(e.radius,20)*uiScale());

    ctx.save();
    ctx.translate(uiX(e.x),uiY(e.y));
    ctx.rotate(uiNumber(e.rotation)*Math.PI/180);

    const s=Math.max(.001,uiNumber(e.scale,1));
    ctx.scale(s,s);

    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);

    uiShadow(e);
    ctx.fillStyle=uiString(e.color,"#fff");
    ctx.fill();

    const outline=uiNumber(e.outlineWidth);

    if(outline>0){
        ctx.lineWidth=outline*uiScale();
        ctx.strokeStyle=uiString(e.outlineColor,"#000");
        ctx.stroke();
    }

    uiClearShadow();
    ctx.restore();
}


/* =========================================================
   BAR
   ========================================================= */

function uiDrawBar(e){
    const w=Math.max(0,uiWidth(e.width));
    const h=Math.max(0,uiHeight(e.height));
    const p=uiPosition(e);

    const max=uiNumber(e.max,100);
    const value=uiNumber(e.value);
    const progress=max===0?0:Math.max(0,Math.min(1,value/max));

    ctx.save();
    ctx.translate(p[0]+w/2,p[1]+h/2);
    ctx.rotate(uiNumber(e.rotation)*Math.PI/180);

    const s=Math.max(.001,uiNumber(e.scale,1));
    ctx.scale(s,s);

    const x=-w/2,y=-h/2;

    uiRoundRect(x,y,w,h,e.radius);
    ctx.fillStyle=uiString(e.background,"rgba(255,255,255,.2)");
    ctx.fill();

    const fw=w*progress;

    if(fw>0){
        ctx.save();

        uiRoundRect(x,y,fw,h,e.radius);
        ctx.clip();

        const gradient={
            ...e,
            color:uiString(e.foreground,"#fff")
        };

        ctx.fillStyle=uiGradient(gradient,x,y,w,h);
        ctx.fillRect(x,y,fw,h);

        ctx.restore();
    }

    const outline=uiNumber(e.outlineWidth);

    if(outline>0){
        uiRoundRect(x,y,w,h,e.radius);
        ctx.lineWidth=outline*uiScale();
        ctx.strokeStyle=uiString(e.outlineColor,"#fff");
        ctx.stroke();
    }

    ctx.restore();
}


/* =========================================================
   IMAGE
   ========================================================= */

function uiDrawImage(e){
    const path=uiString(e.path);
    if(!path)return;

    if(!e.image){
        e.image=new Image();
        e.image.src=path;
    }

    if(e.image.src!==path)
        e.image.src=path;

    if(!e.image.complete||!e.image.naturalWidth)return;

    const w=uiWidth(e.width);
    const h=uiHeight(e.height);
    const p=uiPosition(e);

    ctx.save();
    ctx.translate(p[0]+w/2,p[1]+h/2);
    ctx.rotate(uiNumber(e.rotation)*Math.PI/180);

    const s=Math.max(.001,uiNumber(e.scale,1));
    ctx.scale(s,s);

    uiShadow(e);

    ctx.drawImage(e.image,-w/2,-h/2,w,h);

    uiClearShadow();
    ctx.restore();
}


/* =========================================================
   BUTTON
   ========================================================= */

function uiDrawButton(e){
    uiDrawBox(e);

    uiDrawText({
        text:e.text,
        x:e.x,y:e.y,
        size:e.textSize??20,
        color:e.textColor??"#fff",
        font:e.font??"Arial",
        weight:e.textWeight??"bold",
        align:"center",
        baseline:"middle",
        outlineWidth:e.textOutlineWidth??0,
        outlineColor:e.textOutlineColor??"#000",
        shadow:e.textShadow
    });
}


/* =========================================================
   RENDER
   ========================================================= */

function uiDrawElement(e){
    if(!e||!uiBool(e.visible,true))return;

    const opacity=Math.max(0,Math.min(1,uiNumber(e.opacity,1)));
    if(opacity<=0)return;

    ctx.save();
    ctx.globalAlpha*=opacity;

    switch(e.type){
        case"text":uiDrawText(e);break;
        case"box":
        case"panel":uiDrawBox(e);break;
        case"line":uiDrawLine(e);break;
        case"circle":uiDrawCircle(e);break;
        case"bar":
        case"progress":uiDrawBar(e);break;
        case"button":uiDrawButton(e);break;
        case"image":uiDrawImage(e);break;
    }

    ctx.restore();
}

function renderUI(){
    uiSortElements();

    for(const id of ML_UI.order){
        const e=ML_UI.elements[id];
        if(e)uiDrawElement(e);
    }

    ctx.globalAlpha=1;
}


/* =========================================================
   ENGINE RENDER HOOK
   =========================================================

   UI is drawn AFTER the normal engine render.

   It does not clear the canvas.
   It does not run its own animation loop.
   Therefore the UI cannot race against the game renderer.
   ========================================================= */

ENGINE.renderUI=renderUI;


/* If render is exposed globally, wrap it once.
   back-process.js uses the same global render function. */

if(typeof window!=="undefined"&&typeof window.render==="function"){
    const baseRender=window.render;

    if(!baseRender._mlUI){
        const wrappedRender=function(){
            baseRender();
            renderUI();
        };

        wrappedRender._mlUI=true;
        window.render=wrappedRender;
    }
}


/* =========================================================
   BLOCK REGISTRATION
   ========================================================= */

registerBlock("uiText",b=>uiCreateElement(b.id,"text",{
    text:b.text,x:b.x??0,y:b.y??0,size:b.size??24,
    color:b.color??"#fff",font:b.font??"Arial",
    weight:b.weight??"normal",style:b.style??"normal",
    align:b.align??"center",baseline:b.baseline??"middle",
    outlineWidth:b.outlineWidth??0,
    outlineColor:b.outlineColor??"#000",
    opacity:b.opacity??1,layer:b.layer??0,shadow:b.shadow
}));

registerBlock("uiPanel",b=>uiCreateElement(b.id,"panel",{
    x:b.x??0,y:b.y??0,width:b.width??200,height:b.height??100,
    color:b.color??"rgba(0,0,0,.7)",radius:b.radius??10,
    outlineWidth:b.outlineWidth??0,
    outlineColor:b.outlineColor??"#fff",
    gradient:b.gradient,shadow:b.shadow,
    opacity:b.opacity??1,anchor:b.anchor??"center",
    rotation:b.rotation??0,scale:b.scale??1,layer:b.layer??0
}));

registerBlock("uiBox",b=>uiCreateElement(b.id,"box",{
    x:b.x??0,y:b.y??0,width:b.width??100,height:b.height??100,
    color:b.color??"#fff",radius:b.radius??0,
    outlineWidth:b.outlineWidth??0,
    outlineColor:b.outlineColor??"#000",
    gradient:b.gradient,shadow:b.shadow,
    opacity:b.opacity??1,anchor:b.anchor??"center",
    rotation:b.rotation??0,scale:b.scale??1,layer:b.layer??0
}));

registerBlock("uiLine",b=>uiCreateElement(b.id,"line",{
    x:b.x??0,y:b.y??0,toX:b.toX??100,toY:b.toY??0,
    width:b.width??2,color:b.color??"#fff",
    cap:b.cap??"round",opacity:b.opacity??1,
    shadow:b.shadow,layer:b.layer??0
}));

registerBlock("uiCircle",b=>uiCreateElement(b.id,"circle",{
    x:b.x??0,y:b.y??0,radius:b.radius??20,
    color:b.color??"#fff",outlineWidth:b.outlineWidth??0,
    outlineColor:b.outlineColor??"#000",shadow:b.shadow,
    opacity:b.opacity??1,rotation:b.rotation??0,
    scale:b.scale??1,layer:b.layer??0
}));

registerBlock("uiProgressBar",b=>uiCreateElement(b.id,"progress",{
    x:b.x??0,y:b.y??0,width:b.width??200,height:b.height??20,
    value:b.value??0,max:b.max??100,
    background:b.background??"rgba(255,255,255,.2)",
    foreground:b.foreground??"#fff",radius:b.radius??5,
    outlineWidth:b.outlineWidth??0,
    outlineColor:b.outlineColor??"#fff",
    gradient:b.gradient,opacity:b.opacity??1,
    anchor:b.anchor??"center",rotation:b.rotation??0,
    scale:b.scale??1,layer:b.layer??0
}));

registerBlock("uiBar",b=>uiCreateElement(b.id,"bar",{
    x:b.x??0,y:b.y??0,width:b.width??200,height:b.height??20,
    value:b.value??0,max:b.max??100,
    background:b.background??"rgba(255,255,255,.2)",
    foreground:b.foreground??"#fff",radius:b.radius??5,
    outlineWidth:b.outlineWidth??0,
    outlineColor:b.outlineColor??"#fff",
    gradient:b.gradient,opacity:b.opacity??1,
    anchor:b.anchor??"center",rotation:b.rotation??0,
    scale:b.scale??1,layer:b.layer??0
}));

registerBlock("uiButton",b=>uiCreateElement(b.id,"button",{
    x:b.x??0,y:b.y??0,width:b.width??140,height:b.height??45,
    color:b.color??"#444",radius:b.radius??8,
    outlineWidth:b.outlineWidth??1,
    outlineColor:b.outlineColor??"#fff",
    gradient:b.gradient,shadow:b.shadow,
    text:b.text??"Button",textSize:b.textSize??20,
    textColor:b.textColor??"#fff",
    textWeight:b.textWeight??"bold",
    font:b.font??"Arial",
    textOutlineWidth:b.textOutlineWidth??0,
    textOutlineColor:b.textOutlineColor??"#000",
    textShadow:b.textShadow,opacity:b.opacity??1,
    anchor:b.anchor??"center",rotation:b.rotation??0,
    scale:b.scale??1,layer:b.layer??0
}));

registerBlock("uiImage",b=>uiCreateElement(b.id,"image",{
    path:b.path,x:b.x??0,y:b.y??0,
    width:b.width??100,height:b.height??100,
    opacity:b.opacity??1,anchor:b.anchor??"center",
    rotation:b.rotation??0,scale:b.scale??1,
    shadow:b.shadow,layer:b.layer??0
}));


/* =========================================================
   MODIFY BLOCKS
   ========================================================= */

registerBlock("uiDelete",b=>uiDeleteElement(b.id));
registerBlock("uiClear",()=>uiClearElements());

registerBlock("uiShow",b=>{
    const e=uiGetElement(b.id);
    if(e)e.visible=true;
});

registerBlock("uiHide",b=>{
    const e=uiGetElement(b.id);
    if(e)e.visible=false;
});

registerBlock("uiSetVisible",b=>{
    const e=uiGetElement(b.id);
    if(e)e.visible=b.visible;
});

registerBlock("uiSetOpacity",b=>{
    const e=uiGetElement(b.id);
    if(e)e.opacity=b.opacity;
});

registerBlock("uiSetText",b=>{
    const e=uiGetElement(b.id);
    if(e)e.text=b.text;
});

registerBlock("uiSetPosition",b=>{
    const e=uiGetElement(b.id);
    if(e){
        e.x=b.x;
        e.y=b.y;
    }
});

registerBlock("uiMove",b=>{
    const e=uiGetElement(b.id);
    if(e){
        e.x=uiNumber(e.x)+uiNumber(b.dx);
        e.y=uiNumber(e.y)+uiNumber(b.dy);
    }
});

registerBlock("uiSetSize",b=>{
    const e=uiGetElement(b.id);
    if(e){
        e.width=b.width;
        e.height=b.height;
    }
});

registerBlock("uiSetColor",b=>{
    const e=uiGetElement(b.id);
    if(e){
        if(b.color!==undefined)e.color=b.color;
        if(b.background!==undefined)e.background=b.background;
        if(b.foreground!==undefined)e.foreground=b.foreground;
    }
});

registerBlock("uiSetLayer",b=>{
    const e=uiGetElement(b.id);
    if(e)e.layer=b.layer;
});

registerBlock("uiSetRotation",b=>{
    const e=uiGetElement(b.id);
    if(e)e.rotation=b.rotation;
});

registerBlock("uiSetScale",b=>{
    const e=uiGetElement(b.id);
    if(e)e.scale=b.scale;
});

registerBlock("uiBringToFront",b=>{
    const e=uiGetElement(b.id);
    if(!e)return;

    let highest=-Infinity;

    for(const id of ML_UI.order){
        const item=ML_UI.elements[id];
        if(item)highest=Math.max(highest,uiNumber(item.layer));
    }

    e.layer=highest+1;
});

registerBlock("uiSendToBack",b=>{
    const e=uiGetElement(b.id);
    if(!e)return;

    let lowest=Infinity;

    for(const id of ML_UI.order){
        const item=ML_UI.elements[id];
        if(item)lowest=Math.min(lowest,uiNumber(item.layer));
    }

    e.layer=lowest-1;
});


/* =========================================================
   REPORTERS
   ========================================================= */

registerReporter("uiExists",b=>Boolean(uiGetElement(b.id)));

registerReporter("uiGet",b=>{
    const e=uiGetElement(b.id);
    if(!e)return"";
    return resolveValue(e[uiString(b.property)]);
});


/* =========================================================
   CONVENIENCE API
   ========================================================= */

function uiRun(type,data={}){
    const block=createBlock(type,data);
    const registered=ENGINE.blocks[type];

    if(registered?.execute)
        Promise.resolve(
            registered.execute(block,createScriptContext())
        ).catch(e=>console.error("UI block error:",e));

    return block;
}

function uiText(id,text,x=0,y=0,size=24,color="#fff"){
    return uiRun("uiText",{id,text,x,y,size,color});
}

function uiPanel(id,x=0,y=0,width=200,height=100,color="rgba(0,0,0,.7)",radius=10){
    return uiRun("uiPanel",{id,x,y,width,height,color,radius});
}

function uiBox(id,x=0,y=0,width=100,height=100,color="#fff",radius=0){
    return uiRun("uiBox",{id,x,y,width,height,color,radius});
}

function uiLine(id,x=0,y=0,toX=100,toY=0,width=2,color="#fff"){
    return uiRun("uiLine",{id,x,y,toX,toY,width,color});
}

function uiCircle(id,x=0,y=0,radius=20,color="#fff"){
    return uiRun("uiCircle",{id,x,y,radius,color});
}

function uiProgressBar(id,x=0,y=0,width=200,height=20,value=0,max=100,background="rgba(255,255,255,.2)",foreground="#fff"){
    return uiRun("uiProgressBar",{id,x,y,width,height,value,max,background,foreground});
}

function uiBar(id,x=0,y=0,width=200,height=20,value=0,max=100,background="rgba(255,255,255,.2)",foreground="#fff"){
    return uiRun("uiBar",{id,x,y,width,height,value,max,background,foreground});
}

function uiButton(id,x=0,y=0,width=140,height=45,text="Button",color="#444",textColor="#fff"){
    return uiRun("uiButton",{id,x,y,width,height,text,color,textColor});
}

function uiImage(id,path,x=0,y=0,width=100,height=100){
    return uiRun("uiImage",{id,path,x,y,width,height});
}

function uiDelete(id){
    return uiRun("uiDelete",{id});
}

function uiClear(){
    return uiRun("uiClear");
}

function uiShow(id){
    return uiRun("uiShow",{id});
}

function uiHide(id){
    return uiRun("uiHide",{id});
}

function uiSetVisible(id,visible){
    return uiRun("uiSetVisible",{id,visible});
}

function uiSetOpacity(id,opacity){
    return uiRun("uiSetOpacity",{id,opacity});
}

function uiSetText(id,text){
    return uiRun("uiSetText",{id,text});
}

function uiSetPosition(id,x,y){
    return uiRun("uiSetPosition",{id,x,y});
}

function uiMove(id,dx,dy){
    return uiRun("uiMove",{id,dx,dy});
}

function uiSetSize(id,width,height){
    return uiRun("uiSetSize",{id,width,height});
}

function uiSetColor(id,color){
    return uiRun("uiSetColor",{id,color});
}

function uiSetLayer(id,layer){
    return uiRun("uiSetLayer",{id,layer});
}

function uiSetRotation(id,rotation){
    return uiRun("uiSetRotation",{id,rotation});
}

function uiSetScale(id,scale){
    return uiRun("uiSetScale",{id,scale});
}

function uiBringToFront(id){
    return uiRun("uiBringToFront",{id});
}

function uiSendToBack(id){
    return uiRun("uiSendToBack",{id});
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.MLGame=window.MLGame||{};

window.MLGame.UI={
    elements:ML_UI.elements,
    order:ML_UI.order,
    create:uiCreateElement,
    get:uiGetElement,
    delete:uiDeleteElement,
    clear:uiClearElements,
    render:renderUI
};