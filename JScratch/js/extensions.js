// Add new public blocks here with defineJScratchBlock(metadata, handler).
// The editor reads the metadata automatically; imported code is never evaluated.
// See BLOCKS.md for commands, reporters, containers, defaults and required checks.

// User-authored methods: definitions are collected before any startup script runs.
defineJScratchBlock({name:"defineFunction",kind:"container",label:"define block",category:"custom",params:[{name:"name",default:"My block"},{name:"parameters",default:[]}]},()=>{throw new Error("defineFunction must be at the top level");});
defineJScratchBlock({name:"callFunction",kind:"command",variadic:true,label:"call block",category:"custom",params:[{name:"name",default:"My block"}]},()=>{});
defineJScratchBlock({name:"functionValue",kind:"reporter",label:"local / parameter",category:"custom",params:[{name:"name",default:"amount"}]},(b,c)=>c?.functionScope?.values[String(resolveValue(b.name,c))]??"");
defineJScratchBlock({name:"setFunctionValue",kind:"command",label:"set local",category:"custom",params:[{name:"name",default:"amount"},{name:"value",default:0}]},(b,c)=>{
    if(!c.functionScope)throw new Error("setFunctionValue requires a custom block call");
    c.functionScope.values[String(resolveValue(b.name,c))]=resolveValue(b.value,c);
});
defineJScratchBlock({name:"returnFunction",kind:"command",label:"return",category:"custom",params:[{name:"value",default:0}]},()=>{});
defineJScratchBlock({name:"functionResult",kind:"reporter",label:"last block result",category:"custom",params:[]},(_b,c)=>c?.functionResult??"");
defineJScratchBlock({name:"beginGameAtBroadcast",kind:"command",label:"restart at broadcast",category:"control",params:[{name:"message",default:"World",picker:"broadcast"}]},(b,c)=>{
    if(ENGINE.suppressBroadcasts)return; // Replaying startup must not restart itself.
    const message=String(resolveValue(b.message,c));c.ended=true;void startRuntime({broadcast:message});
});

// Fixed logical stage dimensions; browser fitting never changes these units.
defineJScratchBlock({name:"canvasSize",kind:"command",label:"set canvas size",category:"canvas",params:[{name:"width",default:540},{name:"height",default:360}]},(b,c)=>setCanvasDimensions(resolveValue(b.width,c),resolveValue(b.height,c)));
defineJScratchBlock({name:"canvasWidth",kind:"reporter",label:"canvas width",category:"canvas",params:[]},()=>ENGINE.width);
defineJScratchBlock({name:"canvasHeight",kind:"reporter",label:"canvas height",category:"canvas",params:[]},()=>ENGINE.height);

defineJScratchBlock({name:"screenWidth",kind:"reporter",label:"visible screen width",category:"canvas",params:[]},()=>ENGINE.baseViewWidth);
defineJScratchBlock({name:"screenHeight",kind:"reporter",label:"visible screen height",category:"canvas",params:[]},()=>ENGINE.baseViewHeight);
