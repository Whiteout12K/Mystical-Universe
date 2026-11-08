import {validateExpression} from './model.mjs';
export function installBlocks(Blockly,catalog){
    const defs=new Map(),colours={control:"#c68b30",motion:"#527ec9",sprite:"#8a69bc",ui:"#3d9990",operator:"#559764",sensing:"#4296b3",clone:"#c68b30",camera:"#527ec9",lists:"#b66482",sound:"#a569b4",canvas:"#8a69bc",data:"#b66482",json:"#b66482",media:"#8a69bc",solid:"#b77d51"};
    const type=d=>'js_'+d.name+(d.reporter?'_value':'');
    const defaults=p=>p?.default??(/^(name|id|target|sprite|source)$/.test(p?.name)?'"Sprite"':/color/i.test(p?.name)?'"#ffffff"':/message/i.test(p?.name)?'"Play"':/text/i.test(p?.name)?'"Text"':'0');
    const hat=d=>['whenStart','whenBroadcast','whenClone'].includes(d.name);
    Blockly.Blocks.js_expression={init(){this.appendDummyInput().appendField(new Blockly.FieldTextInput('0'),'VALUE');this.setOutput(true);this.setColour(135);this.setTooltip('A JavaScript value: "text", a number, true/false, an array, or an expression.');}};
    Blockly.Blocks.js_code={init(){this.appendDummyInput().appendField('JavaScript').appendField(new Blockly.FieldTextInput(''),'CODE');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(220);this.setTooltip('Preserved JavaScript outside the visual block API.');}};
    for(const d of catalog){
        defs.set(type(d),d);
        Blockly.Blocks[type(d)]={init(){
            this.appendDummyInput('TITLE').appendField(d.name);
            this.setColour(colours[d.category]??215);
            if(d.reporter)this.setOutput(true);else if(!hat(d)){this.setPreviousStatement(true);this.setNextStatement(true);}
            this.updateArguments(d.params.length);
            if(d.container){this.appendStatementInput('BODY').appendField('do');if(d.name==='ifBlock')this.appendStatementInput('ELSE').appendField('else');}
            this.setInputsInline(d.reporter||d.params.length<=3);
            this.setTooltip(d.name+'('+d.params.map(p=>p.name).join(', ')+(d.rest?', …':'')+')');
        },
        customContextMenu(options){
            if(!d.container){options.push({text:"Add argument",enabled:true,callback:()=>this.changeArgumentCount(1)});options.push({text:"Remove last argument",enabled:this.argumentCount>0,callback:()=>this.changeArgumentCount(-1)});}
        },
        updateArguments(n){
            this.argumentCount??=0;
            while(this.argumentCount>n)this.removeInput('ARG'+(--this.argumentCount));
            while(this.argumentCount<n){const i=this.argumentCount++;this.appendValueInput('ARG'+i).appendField(d.params[i]?.name??'value '+(i+1));if(this.getInput('BODY'))this.moveInputBefore('ARG'+i,'BODY');else if(this.getInput('EXTRA'))this.moveInputBefore('ARG'+i,'EXTRA');}
        },
        changeArgumentCount(delta){if(d.container)return;Blockly.Events.setGroup(true);this.updateArguments(Math.max(0,this.argumentCount+delta));Blockly.Events.setGroup(false);},
        saveExtraState(){return {arguments:this.argumentCount};},loadExtraState(state){this.updateArguments(state.arguments??d.params.length);}};
    }
    function toolboxItem(d){return {kind:'block',type:type(d),inputs:Object.fromEntries(d.params.map((p,i)=>['ARG'+i,{shadow:{type:'js_expression',fields:{VALUE:defaults(p)}}}]))};}
    function toolbox(search=''){
        const matched=catalog.filter(d=>!search||`${d.name} ${d.category}`.toLowerCase().includes(search.toLowerCase()));
        if(search)return {kind:'categoryToolbox',contents:[{kind:'category',name:matched.length?'Results':'No matching blocks',colour:215,contents:matched.map(toolboxItem)}]};
        const labels={control:'Events & loops',motion:'Movement',sprite:'Sprites',ui:'UI',operator:'Values & math',sensing:'Sensing',clone:'Clones',camera:'Camera',lists:'Lists',sound:'Sound',canvas:'Stage',data:'Player data',json:'JSON',media:'Media',solid:'Collision','back-process':'Game'};
        return {kind:'categoryToolbox',contents:[...new Set(catalog.map(d=>d.category))].sort((a,b)=>a==='control'?-1:b==='control'?1:a.localeCompare(b)).map(category=>({kind:'category',name:labels[category]??category,colour:colours[category]??215,contents:matched.filter(d=>d.category===category).map(toolboxItem)})).concat([{kind:'category',name:'JavaScript',colour:220,contents:[{kind:'block',type:'js_expression'},{kind:'block',type:'js_code'}]}])};
    }
    function toBlock(node,workspace){
        if(node.kind!=='call'){
            const b=workspace.newBlock(node.kind==='code'?'js_code':'js_expression');b.setFieldValue(node.text,node.kind==='code'?'CODE':'VALUE');if(node.comments)b.setCommentText(node.comments);return b;
        }
        const d=catalog.find(d=>d.name===node.name&&d.reporter===node.reporter);if(!d)throw new Error('Unknown block '+node.name);
        const b=workspace.newBlock(type(d));b.updateArguments(node.args.length);b.data=JSON.stringify({hasElse:!!node.hasElse});
        node.args.forEach((arg,i)=>{const child=toBlock(arg,workspace);b.getInput('ARG'+i).connection.connect(child.outputConnection);});
        for(const [name,nodes] of [['BODY',node.body],['ELSE',node.elseBody]])if(nodes.length){
            let connection=b.getInput(name).connection;
            for(const node of nodes){const child=toBlock(node,workspace);connection.connect(child.previousConnection);connection=child.nextConnection;}
        }
        if(node.comments)b.setCommentText(node.comments);return b;
    }
    function fromBlock(b){
        const comments=b.getCommentText()||'';
        if(b.type==='js_expression'){const text=b.getFieldValue('VALUE');validateExpression(text);return {kind:'expression',text};}
        if(b.type==='js_code')return {kind:'code',text:b.getFieldValue('CODE'),comments};
        const d=defs.get(b.type);if(!d)throw new Error('Unknown editor block '+b.type);
        const args=[];
        for(let i=0;i<b.argumentCount;i++){
            const child=b.getInputTargetBlock('ARG'+i);if(!child)throw new Error(`${d.name}: fill ${d.params[i]?.name??'argument '+(i+1)}`);args.push(fromBlock(child));
        }
        function body(name){const result=[];for(let child=b.getInputTargetBlock(name);child;child=child.getNextBlock())if(child.isEnabled())result.push(fromBlock(child));return result;}
        return {kind:'call',name:d.name,reporter:d.reporter,container:d.container,hasElse:JSON.parse(b.data||'{}').hasElse??false,args,body:d.container?body('BODY'):[],elseBody:d.name==='ifBlock'?body('ELSE'):[],comments};
    }
    function load(model,workspace){
        workspace.clear();let previous=null,index=0;
        for(const node of model.blocks){
            const b=toBlock(node,workspace);
            if(previous?.nextConnection&&b.previousConnection){previous.nextConnection.connect(b.previousConnection);}else {
                b.data=JSON.stringify({...JSON.parse(b.data||'{}'),order:index++});
            }
            previous=b;
        }
        for(const b of workspace.getAllBlocks(false))b.initSvg?.();
        let eventIndex=0;
        const tops=workspace.getTopBlocks(false),hasStart=tops.some(b=>b.type==='js_whenStart');
        for(const b of tops){
            if(['js_whenBroadcast','js_whenClone'].includes(b.type)){b.setCollapsed(true);b.moveBy(hasStart?680:40,40+eventIndex++*90);}
            else b.moveBy(40,40);
            b.render?.();
        }
    }
    function arrange(workspace){
        const tops=workspace.getTopBlocks(false),start=tops.find(b=>b.type==='js_whenStart');
        let eventY=40,otherY=40;
        const eventX=start?Math.max(760,(start.getHeightWidth?.().width??600)+140):40;
        for(const b of tops){
            const event=['js_whenBroadcast','js_whenClone'].includes(b.type),x=event?eventX:40,y=event?eventY:otherY;
            const p=b.getRelativeToSurfaceXY();b.moveBy(x-p.x,y-p.y);
            const height=b.getHeightWidth?.().height??60;
            if(event)eventY+=height+36;else otherY+=height+60;
        }
    }
    function read(workspace,footer=''){
        const blocks=[];
        for(const top of workspace.getTopBlocks(true).sort((a,b)=>(JSON.parse(a.data||'{}').order??Infinity)-(JSON.parse(b.data||'{}').order??Infinity)))for(let b=top;b;b=b.getNextBlock())if(b.isEnabled()){
            if(b.outputConnection)throw new Error('Connect loose value blocks to a command, or delete them before saving.');
            blocks.push(fromBlock(b));
        }
        return {blocks,footer};
    }
    return {toolbox,load,read,fromBlock,arrange};
}
