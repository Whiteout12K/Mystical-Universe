// Visual connection types only; the runtime API and generated JS stay unchanged.
export const BOOLEAN_REPORTERS=new Set(['gThan','lThan','gEqThan','lEqThan','equal','and','or','not','contain','touchingMouse','touchingSprite','spriteHasColor','touchingStageColor','keyPressed','isMobile','isClone','getLoggedIn','jsonLoaded','jsonExists','listContains','solidEnabled','solidBlocked','uiExists']);
export function reporterType(definition){return definition.output==='boolean'||definition.output!=='value'&&BOOLEAN_REPORTERS.has(definition.name)?'Boolean':'Value';}
export function booleanInput(definition,index){
    const p=definition.params[index];if(p?.type)return p.type==='boolean';
    return p?.picker==='boolean'||['condition','enabled','visible'].includes(p?.name)||['true','false'].includes(p?.default)||(['and','or','not'].includes(definition.name)&&index<(definition.name==='not'?1:2));
}
export const booleanLiteral=source=>/^\s*(true|false)\s*$/.test(source??'');
// Upgrade before Blockly connects saved inputs; stricter checks must never
// disconnect an old variable/number condition or discard an unfinished script.
export function migrateWorkspaceTypes(state,catalog){
    const definitions=new Map(catalog.map(d=>['js_'+d.name+(d.reporter?'_value':''),d]));
    const result=structuredClone(state);
    function visit(block,expectedBoolean=false){
        if(!block)return block;
        if(block.type==='js_expression'&&(expectedBoolean||booleanLiteral(block.fields?.VALUE)))block.type='js_boolean_expression';
        const definition=definitions.get(block.type);
        for(const [name,input] of Object.entries(block.inputs??{}))for(const key of ['block','shadow'])if(input[key])input[key]=visit(input[key],!!definition&&name.startsWith('ARG')&&booleanInput(definition,Number(name.slice(3))));
        if(block.next?.block)block.next.block=visit(block.next.block);
        const isBoolean=['js_boolean_expression','js_boolean_test'].includes(block.type)||definition?.reporter&&reporterType(definition)==='Boolean';
        return expectedBoolean&&!isBoolean?{type:'js_boolean_test',extraState:{legacy:true},inputs:{VALUE:{block}}}:block;
    }
    for(const block of result?.blocks?.blocks??[])visit(block);
    return result;
}
