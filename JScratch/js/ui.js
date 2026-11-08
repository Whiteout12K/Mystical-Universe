/* Costume-free sprites. Their canvas image is generated only when visuals change. */
const ML_UI={elements:Object.create(null),order:[],nextId:1};
const UI_SHARED=new Set(["x","y","rotation","scale","layer","visible","opacity","flipX","flipY","touchable","coordinateMode"]);
const UI_VISUAL_FIELDS=["text","value","max","color","foreground","background","radius","size","font","weight","style","align","baseline","outlineWidth","outlineColor","gradient","shadow","textSize","textColor","textWeight","textOutlineWidth","textOutlineColor","textShadow","toX","toY","strokeWidth","cap","path","anchor"];
function uiValue(v,f="",c=null){const result=resolveValue(v,c);return result==null?f:result;}
function uiNumber(v,f=0,c=null){const number=Number(uiValue(v,f,c));return Number.isFinite(number)?number:f;}
function uiString(v,f="",c=null){return String(uiValue(v,f,c));}
function uiBool(v,f=false,c=null){return v==null?f:mediaBoolean(v,c);}
function uiScale(){return ENGINE.baseUnitScale||1;} // Legacy helper; coordinate modes are handled by Sprite.draw().
function uiResolved(value,c){
    if(!value||typeof value!=="object")return value;
    if(value.type)return resolveValue(value,c);
    if(Array.isArray(value))return value.map(v=>uiResolved(v,c));
    return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,uiResolved(v,c)]));
}
function uiDefaults(type){
    const defaults={color:"#fff",outlineWidth:0,outlineColor:"#000",radius:0};
    if(type==="text")return {...defaults,text:"",size:24,font:"Arial",weight:"normal",style:"normal",align:"center"};
    if(type==="circle")return {...defaults,radius:20};
    if(type==="line")return {...defaults,toX:100,toY:0,strokeWidth:2,cap:"round"};
    if(type==="progress"||type==="bar")return {...defaults,width:200,height:20,value:0,max:100,background:"rgba(255,255,255,.2)",foreground:"#fff",radius:5};
    if(type==="button")return {...defaults,width:140,height:45,text:"Button",textSize:20,textColor:"#fff",textWeight:"bold",color:"#444",radius:8};
    return {...defaults,width:type==="panel"?200:100,height:type==="panel"?100:100};
}
function uiFont(v,size=v.size||24,weight=v.weight||"normal"){return `${v.style||"normal"} ${weight} ${Math.max(1,Number(size)||24)}px ${v.font||"Arial"}`;}
function uiLayout(type,v,context){
    if(type==="text"){
        const size=Math.max(1,Number(v.size)||24),lines=String(v.text??"").split("\n");context.font=uiFont(v,size);
        let width=1;for(const line of lines){const metrics=context.measureText(line);width=Math.max(width,metrics.width||0,(metrics.actualBoundingBoxLeft||0)+(metrics.actualBoundingBoxRight||0));}
        const pad=2+Math.max(0,Number(v.outlineWidth)||0);
        return {width:Math.max(1,Number(v.width)||width+pad*2),height:Math.max(1,Number(v.height)||lines.length*size*1.3+pad*2)};
    }
    if(type==="line")return {width:Math.max(1,Number(v.width)||Math.abs(Number(v.toX)||0)+Math.max(1,Number(v.strokeWidth)||2)+2),height:Math.max(1,Number(v.height)||Math.abs(Number(v.toY)||0)+Math.max(1,Number(v.strokeWidth)||2)+2)};
    if(type==="circle")return {width:Math.max(1,Number(v.width)||Math.max(0,Number(v.radius)||0)*2+Math.max(0,Number(v.outlineWidth)||0)),height:Math.max(1,Number(v.height)||Math.max(0,Number(v.radius)||0)*2+Math.max(0,Number(v.outlineWidth)||0))};
    return {width:Math.max(1,Number(v.width)||1),height:Math.max(1,Number(v.height)||1)};
}
function uiRounded(context,x,y,w,h,r=0){
    r=Math.max(0,Math.min(Number(r)||0,w/2,h/2));context.beginPath();
    if(context.roundRect){context.roundRect(x,y,w,h,r);return;}
    context.moveTo(x+r,y);context.lineTo(x+w-r,y);context.quadraticCurveTo(x+w,y,x+w,y+r);context.lineTo(x+w,y+h-r);context.quadraticCurveTo(x+w,y+h,x+w-r,y+h);context.lineTo(x+r,y+h);context.quadraticCurveTo(x,y+h,x,y+h-r);context.lineTo(x,y+r);context.quadraticCurveTo(x,y,x+r,y);context.closePath();
}
function uiFill(context,v,width,height,color=v.color||"#fff"){
    if(!v.gradient)return color;
    const g=v.gradient,direction=String(g.direction||"vertical").toLowerCase();
    const gradient=context.createLinearGradient(0,0,direction==="vertical"?0:width,direction==="horizontal"?0:height);
    gradient.addColorStop(0,g.from||color);gradient.addColorStop(1,g.to||color);return gradient;
}
function uiShadow(context,shadow){if(!shadow)return;context.shadowColor=shadow.color||"rgba(0,0,0,.5)";context.shadowBlur=Math.max(0,Number(shadow.blur)||0);context.shadowOffsetX=Number(shadow.x)||0;context.shadowOffsetY=Number(shadow.y)||0;}
function uiPaint(context,type,v,w,h,imageFrame){
    const outline=Math.max(0,Number(v.outlineWidth)||0),inset=outline/2;
    context.save();uiShadow(context,v.shadow);
    if(type==="text"||type==="button"){
        if(type==="button"){
            uiRounded(context,inset,inset,Math.max(0,w-outline),Math.max(0,h-outline),v.radius);context.fillStyle=uiFill(context,v,w,h);context.fill();
            if(outline){context.lineWidth=outline;context.strokeStyle=v.outlineColor||"#000";context.stroke();}
        }
        context.shadowColor="transparent";uiShadow(context,type==="button"?v.textShadow:v.shadow);
        const size=type==="button"?Number(v.textSize)||20:Number(v.size)||24,lines=String(v.text??"").split("\n");
        context.font=uiFont(v,size,type==="button"?v.textWeight||"bold":v.weight||"normal");context.textBaseline="middle";context.textAlign=type==="button"?"center":v.align||"center";
        context.fillStyle=type==="button"?v.textColor||"#fff":v.color||"#fff";
        const pad=2+outline,x=context.textAlign==="left"?pad:context.textAlign==="right"?w-pad:w/2;
        const textOutline=type==="button"?Number(v.textOutlineWidth)||0:outline;
        for(let i=0;i<lines.length;i++){
            const y=h/2+(i-(lines.length-1)/2)*size*1.3;
            if(textOutline){context.lineWidth=textOutline;context.strokeStyle=type==="button"?v.textOutlineColor||"#000":v.outlineColor||"#000";context.strokeText(lines[i],x,y);}
            context.fillText(lines[i],x,y);
        }
    }else if(type==="line"){
        const stroke=Math.max(1,Number(v.strokeWidth)||2),dx=Math.sign(Number(v.toX)||0)*Math.max(0,w-stroke-2),dy=Math.sign(Number(v.toY)||0)*Math.max(0,h-stroke-2);context.beginPath();context.moveTo(w/2-dx/2,h/2+dy/2);context.lineTo(w/2+dx/2,h/2-dy/2);context.lineWidth=Math.max(1,Number(v.strokeWidth)||2);context.strokeStyle=v.color||"#fff";context.lineCap=v.cap||"round";context.stroke();
    }else if(type==="circle"){
        context.beginPath();context.ellipse(w/2,h/2,Math.max(0,(w-outline)/2),Math.max(0,(h-outline)/2),0,0,Math.PI*2);context.fillStyle=uiFill(context,v,w,h);context.fill();if(outline){context.lineWidth=outline;context.strokeStyle=v.outlineColor||"#000";context.stroke();}
    }else if(type==="image"){
        if(imageFrame)context.drawImage(imageFrame.source,0,0,w,h);
    }else{
        uiRounded(context,inset,inset,Math.max(0,w-outline),Math.max(0,h-outline),v.radius);
        context.fillStyle=type==="bar"||type==="progress"?v.background??"rgba(255,255,255,.2)":uiFill(context,v,w,h);context.fill();
        if(type==="bar"||type==="progress"){
            const max=Number(v.max)||0,value=Number(v.value)||0,ratio=max>0?clamp(value/max,0,1):0;
            context.save();context.clip();context.fillStyle=uiFill(context,v,w,h,v.foreground||"#fff");context.fillRect(0,0,w*ratio,h);context.restore();
        }
        if(outline){context.lineWidth=outline;context.strokeStyle=v.outlineColor||"#000";context.stroke();}
    }
    context.restore();
}
class UISprite extends Sprite{
    constructor(name,clone=false){
        super(name,clone);this.costume="";this.isUI=true;this.uiType="box";this.uiData=uiDefaults("box");this.uiBindings=new Map();this.uiContexts=new Map();
        this.uiContext=createScriptContext(clone?this:null);this.uiRevision=0;this.uiBaseWidth=100;this.uiBaseHeight=100;this._uiPreparing=false;this._uiKey=null;this._uiSnapshot=null;this._uiError="";
        for(const [dimension,base] of [["width","uiBaseWidth"],["height","uiBaseHeight"]])Object.defineProperty(this,dimension,{
            configurable:true,enumerable:true,get(){return this[base]*this.scale;},
            set(value){const number=Number(value);if(!Number.isFinite(number))return;this[base]=Math.max(1,number/(this.scale||1));this.uiData[dimension]=this[base];}
        });
        this.image=document.createElement("canvas");this.image.width=this.image.height=1;this.loaded=true;
        imageMedia.set(this.image,{frameProvider:()=>{this.ensureRaster();return {source:this.image,width:this.image.width,height:this.image.height,version:this.uiRevision};}});
    }
    get id(){return this.isClone?this.cloneIdName:this.name;}
    get type(){return this.uiType;}
    get progress(){const max=Number(this.max)||0;return max>0?clamp((Number(this.value)||0)/max,0,1):0;}
    readVisual(key){const preparing=this._uiPreparing;this._uiPreparing=true;try{return uiResolved(this.uiData[key],this.uiContexts.get(key)||this.uiContext);}finally{this._uiPreparing=preparing;}}
    setUIProperty(key,value,c=this.uiContext,bind=false){
        if(key==="id"||key==="name"||key==="type"||key==="image")throw new Error("UI property "+key+" is read-only");
        if(key==="space")key="coordinateMode";
        if(UI_SHARED.has(key)){
            this.uiBindings.delete(key);
            if(bind)this.uiBindings.set(key,{value,context:c});
            else this.applyShared(key,resolveValue(value,c));
        }else{this.uiData[key]=value;this.uiContexts.set(key,c);}
        this.prepareFrame();
    }
    applyShared(key,value){
        const previous=this[key];
        if(key==="coordinateMode"){setSpriteCoordinateMode(this,value);return;}
        if(key==="scale"){this.setScale(Math.max(.01,Number(value)||1));return;}
        if(key==="visible"||key==="touchable")this[key]=mediaBoolean(value);
        else if(key==="opacity")this.opacity=clamp(Number(value)||0,0,1);
        else this[key]=Number.isFinite(Number(value))?Number(value):0;
        if(key==="layer"&&previous!==this.layer)ENGINE.spriteOrderDirty=true;
    }
    applyDefinition(type,data,c){
        this.uiType=type;this.uiData={...uiDefaults(type)};this.uiContext=c||createScriptContext();
        this.uiBindings.clear();this.uiContexts.clear();
        for(const [key,value] of Object.entries(data)){
            if(["id","type","_id","_handled"].includes(key)||value===undefined)continue;
            if(UI_SHARED.has(key))this.applyShared(key,resolveValue(value,c));else this.uiData[key]=value;
        }
        this._uiKey=null;this.prepareFrame();ENGINE.spriteOrderDirty=true;return this;
    }
    updateSize(){} // Width/height accessors combine generated dimensions with the shared scale.
    setCostume(path,scale=1){this.uiType="image";this.costume=String(path||"");this.uiData.path=this.costume;this.setScale(scale);this._uiKey=null;this.prepareFrame();}
    prepareFrame(){
        if(this._uiPreparing||this.deleted)return;
        this._uiPreparing=true;
        try{
            for(const [key,binding] of this.uiBindings)this.applyShared(key,resolveValue(binding.value,binding.context||this.uiContext));
            const values=Object.fromEntries(Object.entries(this.uiData).map(([key,value])=>[key,uiResolved(value,this.uiContexts.get(key)||this.uiContext)]));
            const dataKey=JSON.stringify([this.uiType,values],(_key,value)=>typeof value==="bigint"?String(value):typeof value==="number"&&!Number.isFinite(value)?String(value):value);
            if(this._uiSnapshot?.key===dataKey){this.updateSize();return;}
            const layout=uiLayout(this.uiType,values,this.image.getContext("2d"));
            this.uiBaseWidth=layout.width;this.uiBaseHeight=layout.height;this.updateSize();
            if(this.uiType==="image"&&String(values.path||"")!==this._uiAssetPath){
                this._uiAssetPath=String(values.path||"");this._uiAsset=this._uiAssetPath?loadImageAsset(this._uiAssetPath):null;
                this._uiAsset?.ready.then(()=>{this._uiKey=null;}).catch(error=>this.reportUIError(error));
            }
            this._uiSnapshot={values,...layout,key:dataKey};
        }catch(error){this.reportUIError(error);}
        finally{this._uiPreparing=false;}
    }
    reportUIError(error){const message=error.message||String(error);if(message!==this._uiError){this._uiError=message;reportRuntimeError(error,null,{...this.uiContext,scriptName:"UI "+this.id});}}
    ensureRaster(){
        this.prepareFrame();const snapshot=this._uiSnapshot;if(!snapshot||this.deleted)return;
        try{
            const asset=this._uiAsset,imageFrame=this.uiType==="image"&&asset?.image?.naturalWidth?getImageFrame(asset.image):null;
            const key=snapshot.key+"|"+(imageFrame?imageFrame.version+":ready":"pending");if(key===this._uiKey)return;
            const width=Math.max(1,Math.ceil(snapshot.width)),height=Math.max(1,Math.ceil(snapshot.height));
            if(this.image.width!==width)this.image.width=width;if(this.image.height!==height)this.image.height=height;
            const context=this.image.getContext("2d");context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);context.imageSmoothingEnabled=false;
            context.save();context.scale(width/snapshot.width,height/snapshot.height);uiPaint(context,this.uiType,snapshot.values,snapshot.width,snapshot.height,imageFrame);context.restore();
            this.uiRevision++;this._uiKey=key;this._uiError="";
        }catch(error){this.reportUIError(error);}
    }
    copyUIStateTo(clone){
        clone.uiType=this.uiType;clone.uiData={...this.uiData};clone.uiContexts=new Map();clone.uiContext=createScriptContext(clone);clone.uiBindings=new Map([...this.uiBindings].map(([key,binding])=>[key,{value:binding.value,context:clone.uiContext}]));clone._uiKey=null;clone.prepareFrame();
    }
    onDelete(){if(ML_UI.elements[this.name]===this){delete ML_UI.elements[this.name];const i=ML_UI.order.indexOf(this.name);if(i>=0)ML_UI.order.splice(i,1);}}
}
for(const key of UI_VISUAL_FIELDS)Object.defineProperty(UISprite.prototype,key,{configurable:true,get(){return this.readVisual(key);},set(value){if(this.uiData){this.uiData[key]=value;this.uiContexts?.delete(key);}}});
function uiCreateElement(id,type="box",data={},c=null){
    id=uiString(id,"",c)||"ui_"+ML_UI.nextId++;
    let e=getContextSprite(id,c);
    if(e&&!e.isUI)throw new Error("UI name already belongs to a sprite: "+id);
    if(!e){e=new UISprite(id);ENGINE.sprites[id]=e;ML_UI.elements[id]=e;ML_UI.order.push(id);}
    return e.applyDefinition(type,data,c);
}
function uiGetElement(id,c=null){const e=getContextSprite(id,c);return e?.isUI&&!e.deleted?e:null;}
function uiDeleteElement(id,c=null){const e=uiGetElement(id,c);if(e)removeSpriteObject(e);}
function uiClearElements(){
    for(const sprite of getAllSprites())if(sprite.isUI){markSpriteDeleted(sprite);if(!sprite.isClone&&ENGINE.sprites[sprite.name]===sprite)delete ENGINE.sprites[sprite.name];}
    ENGINE.clones=ENGINE.clones.filter(sprite=>!sprite.deleted);ML_UI.order.length=0;ENGINE.spriteOrderDirty=true;releaseInactiveWaiters();
}
function renderUI(){for(const sprite of getAllSprites().filter(s=>s.isUI).sort((a,b)=>a.layer-b.layer))sprite.draw();} // Manual compatibility API only; normal render already draws UI once.

/* Constructors keep their existing signatures. Visual reporters remain live. */
const UI_KINDS={uiText:"text",uiPanel:"panel",uiBox:"box",uiLine:"line",uiCircle:"circle",uiProgressBar:"progress",uiBar:"bar",uiButton:"button",uiImage:"image"};
for(const [type,kind] of Object.entries(UI_KINDS))registerBlock(type,(b,c)=>{
    const data={...b};if(kind==="line"){data.strokeWidth=b.width;delete data.width;}
    return uiCreateElement(b.id,kind,data,c);
});
function withUI(b,c,handler){const e=uiGetElement(b.id,c);if(e)return handler(e);}
registerBlock("uiDelete",(b,c)=>uiDeleteElement(b.id,c));registerBlock("uiClear",uiClearElements);
for(const [type,property] of Object.entries({uiSetVisible:"visible",uiSetOpacity:"opacity",uiSetText:"text",uiSetLayer:"layer",uiSetRotation:"rotation",uiSetScale:"scale",uiSetValue:"value",uiSetMax:"max"}))registerBlock(type,(b,c)=>withUI(b,c,e=>e.setUIProperty(property,b[property],c)));
registerBlock("uiShow",(b,c)=>withUI(b,c,e=>{e.visible=true;}));registerBlock("uiHide",(b,c)=>withUI(b,c,e=>{e.visible=false;}));
registerBlock("uiSetPosition",(b,c)=>withUI(b,c,()=>ENGINE.blocks.moveTo.execute({name:b.id,x:b.x,y:b.y},c)));
registerBlock("uiMove",(b,c)=>withUI(b,c,()=>ENGINE.blocks.move.execute({name:b.id,x:b.dx,y:b.dy},c)));
registerBlock("uiSetSize",(b,c)=>withUI(b,c,e=>{e.setUIProperty("width",b.width,c);e.setUIProperty("height",b.height,c);}));
registerBlock("uiSetColor",(b,c)=>withUI(b,c,e=>{for(const key of ["color","foreground","background"])if(b[key]!==undefined)e.setUIProperty(key,b[key],c);}));
registerBlock("uiBringToFront",(b,c)=>withUI(b,c,()=>ENGINE.blocks.goFront.execute({name:b.id},c)));
registerBlock("uiSendToBack",(b,c)=>withUI(b,c,()=>ENGINE.blocks.goBack.execute({name:b.id},c)));
registerBlock("uiSet",(b,c)=>withUI(b,c,e=>e.setUIProperty(String(resolveValue(b.property,c)),b.value,c)));
registerBlock("uiBind",(b,c)=>withUI(b,c,e=>e.setUIProperty(String(resolveValue(b.property,c)),b.value,c,true)));
registerBlock("uiUnbind",(b,c)=>withUI(b,c,e=>{const requested=String(resolveValue(b.property,c)),property=requested==="space"?"coordinateMode":requested;e.prepareFrame();if(UI_SHARED.has(property))e.uiBindings.delete(property);else e.uiData[property]=e.readVisual(property);e.prepareFrame();}));
registerReporter("uiExists",(b,c)=>!!uiGetElement(b.id,c));
registerReporter("uiGet",(b,c)=>{const e=uiGetElement(b.id,c);if(!e)return "";const property=String(resolveValue(b.property,c)),key=property==="space"?"coordinateMode":property;return e[key]??e.readVisual(key)??"";});
function uiSet(id,property,value){return uiRun("uiSet",{id,property,value});}
function uiBind(id,property,value){return uiRun("uiBind",{id,property,value});}
function uiUnbind(id,property){return uiRun("uiUnbind",{id,property});}
function uiSetValue(id,value){return uiRun("uiSetValue",{id,value});}
function uiSetMax(id,max){return uiRun("uiSetMax",{id,max});}
function uiExists(id){return createReporter("uiExists",{id});}
function uiGet(id,property){return createReporter("uiGet",{id,property});}

function uiRun(type,data={}){
    return ENGINE.recordBlock(createBlock(type,data));
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


window.MLGame.UI={
    get elements(){return ML_UI.elements;},get order(){return ML_UI.order;},
    create:uiCreateElement,get:uiGetElement,delete:uiDeleteElement,clear:uiClearElements,render:renderUI
};
