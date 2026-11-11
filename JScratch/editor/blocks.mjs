import {accents} from './theme.mjs';
import {validateExpression,isLiteralField} from './model.mjs';
import {blockTitle,argumentLabel,blockPrefix,infixSymbols,blockSearchText} from './labels.mjs';
import {reporterType,booleanInput,booleanLiteral} from './types.mjs';
import {stringLiteral} from './symbols.mjs';
import {installParameters,definitionParameters,definitionName,parameterNames,parameterReporterModel} from './parameters.mjs';
import {defaultFieldValue,valueFieldClass} from './field-values.mjs';
import {smartFieldClass} from './smart-fields.mjs';
export function installBlocks(Blockly,catalog,options={}){
    const ValueField=valueFieldClass(Blockly,options.library?smartFieldClass(Blockly,catalog,options.library):Blockly.FieldTextInput,catalog);
    const defs=new Map(),colours=accents;let functions=[];
    const parameters=installParameters(Blockly);
    const type=d=>'js_'+d.name+(d.reporter?'_value':'');
    const hat=d=>['whenStart','whenBroadcast','whenClone','defineFunction'].includes(d.name);
    Blockly.Blocks.js_expression={init(){this.appendDummyInput().appendField(new ValueField('0'),'VALUE');this.setOutput(true,'Value');this.setStyle("js_value");this.setTooltip('A JavaScript value: text, a number, an array, or an expression. Use Boolean blocks for conditions.');}};
    Blockly.Blocks.js_boolean_expression={init(){this.appendDummyInput('TITLE').appendField(new ValueField('false'),'VALUE');this.setOutput(true,'Boolean');this.setStyle('js_operator');this.setTooltip('A Boolean condition: true / false, or an advanced JavaScript expression.');}};
    Blockly.Blocks.js_boolean_test={init(){this.appendDummyInput('TITLE').appendField('test');this.appendValueInput('VALUE');this.setOutput(true,'Boolean');this.setInputsInline(true);this.setStyle('js_operator');this.setTooltip('Test whether a variable or value is truthy.');},saveExtraState(){return {legacy:!!this.legacyCondition};},loadExtraState(state){this.legacyCondition=!!state.legacy;}};
    Blockly.Blocks.js_code={init(){this.appendDummyInput('TITLE').appendField('JavaScript').appendField(new Blockly.FieldTextInput(''),'CODE');this.setPreviousStatement(true);this.setNextStatement(true);this.setStyle("js_code");this.setTooltip('Preserved JavaScript outside the visual block API.');}};
    for(const d of catalog){
        defs.set(type(d),d);
        Blockly.Blocks[type(d)]={init(){
            const title=this.appendDummyInput('TITLE'),prefix=blockPrefix(d);if(prefix)title.appendField(prefix);
            this.setStyle("js_"+(colours[d.category]?d.category:"custom"));
            if(d.reporter)this.setOutput(true,reporterType(d));else if(!hat(d)){this.setPreviousStatement(true);this.setNextStatement(true);}
            this.updateArguments(d.params.length);
            if(d.container){this.appendStatementInput('BODY').appendField('do');if(d.name==='ifBlock')this.appendStatementInput('ELSE').appendField('else');}
            this.setInputsInline(true);
            this.setTooltip(d.name+'('+d.params.map(p=>p.name).join(', ')+(d.rest?', …':'')+')'+(d.name==='spriteCoordinateMode'?' — world: camera space; canvas: full declared box edges; screen: visible edges, bounded by the declared canvas box. All offsets measure to the sprite center.':''));
        },
        customContextMenu(options){
            if(!d.container&&!infixSymbols[d.name]&&!['not'].includes(d.name)){options.push({text:"Add argument",enabled:true,callback:()=>this.changeArgumentCount(1)});options.push({text:"Remove last argument",enabled:this.argumentCount>0,callback:()=>this.changeArgumentCount(-1)});}
        },
        updateArguments(n){
            this.argumentCount??=0;
            while(this.argumentCount>n)this.removeInput('ARG'+(--this.argumentCount));
            while(this.argumentCount<n){const i=this.argumentCount++;const label=argumentLabel(d,i);const input=this.appendValueInput('ARG'+i);if(booleanInput(d,i))input.setCheck('Boolean');if(label)input.appendField(label,'LABEL'+i);if(this.getInput('BODY'))this.moveInputBefore('ARG'+i,'BODY');else if(this.getInput('EXTRA'))this.moveInputBefore('ARG'+i,'EXTRA');}
        },
        syncParameters(initial=null){if(d.name==='defineFunction')parameters.sync(this,initial);},
        syncFunction(fill=true){
            if(d.name==='defineFunction'){this.syncParameters();return;}
            if(d.name!=='callFunction')return;
            const child=this.getInputTargetBlock('ARG0'),name=child?.type==='js_expression'?stringLiteral(child.getFieldValue('VALUE')):null,definition=functions.find(f=>f.name===name)??(!child?this.functionSignature:null);
            if(!definition)return;
            // Keep extra connected arguments visible so signature edits never discard code.
            const count=definition.parameters.length+1;if(fill)this.updateArguments(Math.max(count,this.argumentCount));
            for(let i=1;i<this.argumentCount;i++){
                let field=this.getField('LABEL'+i);if(!field){this.getInput('ARG'+i).appendField('', 'LABEL'+i);field=this.getField('LABEL'+i);}
                field.setValue(definition.parameters[i-1]??'extra '+i);
                if(fill&&i<count&&!this.getInputTargetBlock('ARG'+i))this.getInput('ARG'+i).connection.setShadowState({type:'js_expression',fields:{VALUE:'0'}});
            }
        },
        onchange(event){if(!event.isUiEvent&&['callFunction','defineFunction'].includes(d.name)&&!this.isInFlyout)this.syncFunction();},
        changeArgumentCount(delta){if(d.container)return;Blockly.Events.setGroup(true);this.updateArguments(Math.max(0,this.argumentCount+delta));Blockly.Events.setGroup(false);},
        saveExtraState(){return {arguments:this.argumentCount,...(d.name==='defineFunction'?{parameters:definitionParameters(this)}:{})};},loadExtraState(state){this.updateArguments(state.arguments??d.params.length);this.functionSignature=state.signature??null;if(d.name==='defineFunction')this.syncParameters(state.parameters??null);else this.syncFunction(false);}};
    }
    function toolboxItem(d){return {kind:'block',type:type(d),inputs:Object.fromEntries(d.params.map((p,i)=>['ARG'+i,{shadow:{type:booleanInput(d,i)?'js_boolean_expression':'js_expression',fields:{VALUE:defaultFieldValue(d,i)}}}]))};}
    function toolbox(search=''){
        const customItems=functions.filter(f=>!search||f.name.toLowerCase().includes(search.toLowerCase())).map(f=>({kind:'block',type:'js_callFunction',extraState:{arguments:f.parameters.length+1,signature:f},inputs:Object.fromEntries([['ARG0',{shadow:{type:'js_expression',fields:{VALUE:JSON.stringify(f.name)}}}],...f.parameters.map((p,i)=>['ARG'+(i+1),{shadow:{type:'js_expression',fields:{VALUE:'0'}}}])])}));
        const matched=catalog.filter(d=>!search||blockSearchText(d).toLowerCase().includes(search.toLowerCase()));
        const booleanItems=[{kind:'block',type:'js_boolean_expression',fields:{VALUE:'true'}},{kind:'block',type:'js_boolean_expression',fields:{VALUE:'false'}},{kind:'block',type:'js_boolean_test',inputs:{VALUE:{shadow:{type:'js_expression',fields:{VALUE:'0'}}}}}];
        const matchedBooleans=booleanItems.filter((_,i)=>['boolean true','boolean false','test boolean condition value'][i].includes(search.toLowerCase()));
        if(search)return {kind:'categoryToolbox',contents:[{kind:'category',name:(matched.length||customItems.length||matchedBooleans.length)?'Results':'No matching blocks',colour:215,contents:[...matchedBooleans,...customItems,...matched.map(toolboxItem)]}]};
        const labels={custom:'My blocks',control:'Events & loops',motion:'Movement',sprite:'Sprites',ui:'UI',operator:'Vars & math',sensing:'Sensing',clone:'Clones',camera:'Camera',lists:'Lists',sound:'Sound',canvas:'Stage',data:'Player data',json:'JSON',media:'Media',solid:'Collision','back-process':'Game'};
        return {kind:'categoryToolbox',contents:[...new Set(catalog.map(d=>d.category))].sort((a,b)=>a==='control'?-1:b==='control'?1:a.localeCompare(b)).map(category=>({kind:'category',name:labels[category]??category,colour:colours[category]??215,contents:[...(category==='operator'?booleanItems:[]),...(category==='custom'?customItems:[]),...matched.filter(d=>d.category===category).map(toolboxItem)]})).concat([{kind:'category',name:'JavaScript',colour:220,contents:[{kind:'block',type:'js_expression'},{kind:'block',type:'js_code'}]}])};
    }
    function toBlock(node,workspace,scope=null,expectedBoolean=false){
        if(expectedBoolean&&node.kind==='call'&&reporterType(catalog.find(d=>d.name===node.name&&d.reporter)??{name:node.name})!=='Boolean'){
            const adapter=workspace.newBlock('js_boolean_test'),child=toBlock(node,workspace,scope);adapter.legacyCondition=true;adapter.getInput('VALUE').connection.connect(child.outputConnection);return adapter;
        }
        if(node.kind==='call'&&node.name==='functionValue'&&node.args.length===1&&node.args[0].kind==='expression'&&scope?.names.includes(stringLiteral(node.args[0].text))){
            const b=workspace.newBlock('js_parameter');b.setFieldValue(stringLiteral(node.args[0].text),'NAME');b.parameterOwner=scope.name;return b;
        }
        if(node.kind!=='call'){
            const b=workspace.newBlock(node.kind==='code'?'js_code':expectedBoolean||booleanLiteral(node.text)?'js_boolean_expression':'js_expression');b.setFieldValue(node.text,node.kind==='code'?'CODE':'VALUE');if(node.comments)b.setCommentText(node.comments);return b;
        }
        const d=catalog.find(d=>d.name===node.name&&d.reporter===node.reporter);if(!d)throw new Error('Unknown block '+node.name);
        if(d.name==='defineFunction')scope={name:stringLiteral(node.args[0]?.text??''),names:parameterNames(node.args[1]?.text??'')??[]};
        const b=workspace.newBlock(type(d));b.updateArguments(node.args.length);b.data=JSON.stringify({hasElse:!!node.hasElse});
        node.args.forEach((arg,i)=>{const child=toBlock(arg,workspace,scope,booleanInput(d,i));b.getInput('ARG'+i).connection.connect(child.outputConnection);if(workspace.rendered&&arg.kind==='expression'&&isLiteralField(arg.text))child.setShadow(true);});b.syncFunction(false);
        for(const [name,nodes] of [['BODY',node.body],['ELSE',node.elseBody]])if(nodes.length){
            let connection=b.getInput(name).connection;
            for(const node of nodes){const child=toBlock(node,workspace,scope);connection.connect(child.previousConnection);connection=child.nextConnection;}
        }
        if(node.comments)b.setCommentText(node.comments);return b;
    }
    function fromBlock(b){
        const comments=b.getCommentText()||'';
        if(['js_expression','js_boolean_expression'].includes(b.type)){const text=b.getFieldValue('VALUE');validateExpression(text);return {kind:'expression',text};}
        if(b.type==='js_boolean_test'){const child=b.getInputTargetBlock('VALUE');if(!child)throw new Error('Fill the test value.');const value=fromBlock(child),parent=b.getParent(),input=parent?.inputList.find(i=>i.connection?.targetBlock()===b);if(b.legacyCondition&&input?.connection?.getCheck()?.includes('Boolean'))return value;const negate=arg=>({kind:'call',name:'not',reporter:true,container:false,args:[arg],body:[],elseBody:[],comments:''});return negate(negate(value));}
        if(b.type==='js_parameter'){
            let definition=b.getParent();while(definition&&definition.type!=='js_defineFunction')definition=definition.getParent();
            const name=b.getFieldValue('NAME');if(!definition||definitionName(definition)!==b.parameterOwner||!definitionParameters(definition)?.includes(name))throw new Error('Parameter '+name+' belongs inside custom block '+b.parameterOwner+'.');
            return parameterReporterModel(name);
        }
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
            if(['js_whenBroadcast','js_whenClone'].includes(b.type)){b.moveBy(hasStart?680:40,40+eventIndex++*90);}
            else b.moveBy(40,40);
            b.render?.();
        }
    }
    function expandAll(workspace){for(const b of workspace.getAllBlocks(false)){if(workspace.rendered&&['js_expression','js_boolean_expression'].includes(b.type)&&b.getParent()&&isLiteralField(b.getFieldValue('VALUE')))b.setShadow(true);if(b.isCollapsed())b.setCollapsed(false);if(defs.has(b.type)){b.setInputsInline(true);b.syncFunction?.(false);}}}
    function arrange(workspace){
        const tops=workspace.getTopBlocks(false).sort((a,b)=>a.type==='js_whenStart'?-1:b.type==='js_whenStart'?1:(JSON.parse(a.data||'{}').order??0)-(JSON.parse(b.data||'{}').order??0));
        let x=48;
        for(const b of tops){
            const p=b.getRelativeToSurfaceXY();b.moveBy(x-p.x,48-p.y);
            x+=(b.getHeightWidth?.().width??600)+96;
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
    return {toolbox,load,read,fromBlock,arrange,expandAll,setFunctions(list){functions=list;}};
}
