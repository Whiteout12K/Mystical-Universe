import {parse} from './vendor/acorn.mjs';
import {stringLiteral} from './symbols.mjs';

// Read syntax only: definitions and parameter expressions are never evaluated.
export function parameterNames(source){
    try{const node=parse('('+source+'\n)',{ecmaVersion:'latest'}).body[0].expression;
        if(node.type!=='ArrayExpression'||node.elements.some(p=>p?.type!=='Literal'||typeof p.value!=='string'||!p.value.trim()))return null;
        const names=node.elements.map(p=>p.value);return new Set(names).size===names.length?names:null;
    }catch{return null;}
}
export function definitionParameters(block){const value=block.getInputTargetBlock('ARG1');return value?.type==='js_expression'?parameterNames(value.getFieldValue('VALUE')):null;}
export function definitionName(block){return stringLiteral(block.getInputTargetBlock('ARG0')?.getFieldValue('VALUE')??'');}
export function parameterReporterModel(name){return {kind:'call',name:'functionValue',reporter:true,container:false,args:[{kind:'expression',text:JSON.stringify(name)}],body:[],elseBody:[],comments:''};}
export function installParameters(Blockly){
    Blockly.Blocks.js_parameter={
        init(){this.appendDummyInput('TITLE').appendField(new Blockly.FieldLabelSerializable('argument'),'NAME');this.setOutput(true,'Value');this.setStyle('js_custom');this.setTooltip('A parameter of this custom block. Drag another copy from its definition header.');},
        saveExtraState(){return {owner:this.parameterOwner??null};},loadExtraState(state){this.parameterOwner=state.owner??null;},
    };
    function reporter(field){
        const definition=field.getSourceBlock(),workspace=definition.workspace,owner=definitionName(definition);
        return Blockly.serialization.blocks.append({type:'js_parameter',fields:{NAME:field.getValue()},extraState:{owner}},workspace);
    }
    class ParameterField extends Blockly.Field{
        constructor(name){super(name);this.EDITABLE=false;this.SERIALIZABLE=false;this.setTooltip('Drag a copy into this custom block. Enter creates a copy.');}
        initView(){
            super.initView();const root=this.getSvgRoot();root.classList.add('jscratch-parameter-chip');root.setAttribute('role','button');root.setAttribute('tabindex','0');root.setAttribute('aria-label','Drag parameter '+this.getValue());
            root.addEventListener('pointerdown',event=>this.startCopy(event),true);
            root.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();const definition=this.getSourceBlock();if(definition.isInFlyout||definition.workspace.isReadOnly())return;const group=Blockly.Events.getGroup();if(!group)Blockly.Events.setGroup(true);try{const copy=reporter(this),p=definition.getRelativeToSurfaceXY();copy.moveBy(p.x+40,p.y+definition.getHeightWidth().height+24);copy.select();}finally{Blockly.Events.setGroup(group);}});
        }
        positionBorderRect_(){super.positionBorderRect_();this.getBorderRect()?.setAttribute('rx','14');this.getBorderRect()?.setAttribute('ry','14');}
        startCopy(down){
            if(down.button!==0)return;const definition=this.getSourceBlock(),workspace=definition.workspace;
            if(definition.isInFlyout||workspace.isReadOnly())return;
            this.pendingCleanup?.();if(!Blockly.Touch.checkTouchIdentifier(down))return;
            down.preventDefault();down.stopImmediatePropagation();
            const cleanup=(release=true)=>{if(release)Blockly.Touch.clearTouchIdentifier();document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);this.pendingCleanup=null;};
            const up=event=>{if(event.pointerId===down.pointerId)cleanup();};
            const move=event=>{
                if(event.pointerId!==down.pointerId||Math.hypot(event.clientX-down.clientX,event.clientY-down.clientY)<5)return;
                cleanup(false);if(definition.isDeadOrDying()){Blockly.Touch.clearTouchIdentifier();return;}
                const rect=this.getSvgRoot().getBoundingClientRect(),group=Blockly.Events.getGroup();if(!group)Blockly.Events.setGroup(true);
                const copy=reporter(this),point=Blockly.utils.svgMath.screenToWsCoordinates(workspace,new Blockly.utils.Coordinate(rect.left,rect.top));copy.moveBy(point.x,point.y);
                // Hand off to Blockly's native dragger for snapping, zoom conversion,
                // touch handling and grouped undo. The header stays in place.
                const gesture=workspace.getGesture(down);
                if(!gesture){Blockly.Touch.clearTouchIdentifier();copy.dispose();Blockly.Events.setGroup(group);return;}
                gesture.handleBlockStart(down,copy);gesture.handleWsStart(down,workspace);gesture.handleMove(event);
            };
            this.pendingCleanup=cleanup;document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
        }
        dispose(){this.pendingCleanup?.();super.dispose();}
    }
    class AddParameterField extends Blockly.Field{
        constructor(){super('＋ argument');this.SERIALIZABLE=false;this.setTooltip('Add a parameter and its draggable reporter.');}
        isClickable(){return true;}
        showEditor_(){
            const definition=this.getSourceBlock();if(definition.isInFlyout)return;
            Blockly.dialog.prompt('New parameter name','',name=>{
                if(name===null||definition.isDeadOrDying())return;name=name.trim();if(!name)return;
                const names=definitionParameters(definition),value=definition.getInputTargetBlock('ARG1');
                if(!names){Blockly.dialog.alert('Use a literal list of unique parameter names first.');return;}
                if(names.includes(name)){Blockly.dialog.alert('That parameter already exists in this block.');return;}
                const group=Blockly.Events.getGroup();if(!group)Blockly.Events.setGroup(true);
                try{value.setFieldValue(JSON.stringify([...names,name]),'VALUE');definition.syncParameters();}finally{Blockly.Events.setGroup(group);}
            });
        }
    }
    function sync(definition,initial=null){
        const names=definitionParameters(definition)??initial;
        // Keep malformed or computed source visible for normal expression editing.
        definition.getInput('ARG1')?.setVisible(names===null);
        const signature=JSON.stringify(names);if(signature===definition.parameterSignature)return;
        definition.parameterSignature=signature;
        for(const input of [...definition.inputList])if(input.name.startsWith('PARAMETER'))definition.removeInput(input.name);
        if(names!==null)names.forEach((name,i)=>{definition.appendDummyInput('PARAMETER'+i).appendField(new ParameterField(name),'PARAMETER'+i);definition.moveInputBefore('PARAMETER'+i,'BODY');});
        if(!definition.getInput('ADD_PARAMETER')){definition.appendDummyInput('ADD_PARAMETER').appendField(new AddParameterField());definition.moveInputBefore('ADD_PARAMETER','BODY');}
        definition.moveInputBefore('ADD_PARAMETER','BODY');
    }
    return {sync};
}
