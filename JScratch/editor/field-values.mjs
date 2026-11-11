import {argumentPicker,stringLiteral} from './symbols.mjs';
import {booleanInput} from './types.mjs';
const TEXT_NAMES=new Set(['name','id','target','sprite','sprite2','spriteName','varName','message','text','path','key','property','type','effect','mode','horizontal','vertical','color','color_hex','background','foreground','textColor']);
export function fieldKind(definition,index,read=()=>null){
    if(!definition)return 'value';
    const param=definition.params[index];if(booleanInput(definition,index))return 'boolean';
    const picker=argumentPicker(definition,index,read);if(picker&&picker.kind!=='boolean')return 'text';
    if(param?.default!=null){if(stringLiteral(param.default)!==null)return 'text';if(/^\s*\[/.test(param.default))return 'array';if(/^\s*\{/.test(param.default))return 'object';}
    if(TEXT_NAMES.has(param?.name)||['join','contain'].includes(definition.name)||definition.name==='length'||definition.name==='letter'&&index===1)return 'text';
    if(['items','targets','parameters'].includes(param?.name))return 'array';
    if(definition.name==='updateData'&&index===0||definition.name==='changeDataBy'&&index===0)return 'text';
    return 'value';
}
export function emptyFieldValue(kind){return {text:'""',boolean:'false',array:'[]',object:'{}'}[kind]??'0';}
export function defaultFieldValue(definition,index){if(index===0&&['defineFunction','callFunction'].includes(definition.name))return '""';return definition.params[index]?.default??emptyFieldValue(fieldKind(definition,index));}
export function valueFieldClass(Blockly,Base,catalog){
    const definitions=new Map(catalog.map(d=>['js_'+d.name+(d.reporter?'_value':''),d]));
    return class ValueField extends Base{
        doClassValidation_(value){
            if(typeof value==='string'&&!value.trim()){
                const block=this.getSourceBlock();let kind='value';
                if(block?.type==='js_boolean_expression')kind='boolean';
                else{const parent=block?.getParent(),definition=definitions.get(parent?.type),input=parent?.inputList.find(input=>input.connection?.targetBlock()===block);
                    if(definition&&input?.name.startsWith('ARG'))kind=fieldKind(definition,Number(input.name.slice(3)),i=>stringLiteral(parent.getInputTargetBlock('ARG'+i)?.getFieldValue('VALUE')??''));}
                value=emptyFieldValue(kind);
            }
            return super.doClassValidation_(value);
        }
        getText(){return stringLiteral(this.getValue())===''?'':super.getText();}
    };
}
