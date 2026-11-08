import {parse} from './vendor/acorn.mjs';
import '../js/block-api.js';
function literal(node){
    if(node.type==='Literal')return node.value;
    if(node.type==='ArrayExpression')return node.elements.map(literal);
    if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='Literal')return -node.argument.value;
    if(node.type==='ObjectExpression')return Object.fromEntries(node.properties.map(p=>{
        if(p.type!=='Property'||p.computed||p.kind!=='init')throw new Error('Block metadata must be a literal object');
        return [p.key.name??p.key.value,literal(p.value)];
    }));
    throw new Error('Block metadata must contain literal values, not executable expressions');
}
export function readBlockDefinitions(source){
    const definitions=[];
    for(const node of parse(source,{ecmaVersion:'latest'}).body){
        const call=node.type==='ExpressionStatement'?node.expression:null;
        if(call?.type==='CallExpression'&&call.callee.name==='defineJScratchBlock')definitions.push(JScratchBlockAPI.editorDefinition(literal(call.arguments[0])));
    }
    return definitions;
}
export function mergeDefinitions(base,extensions){
    const result=new Map(base.map(d=>[d.name+':'+d.reporter,d]));
    for(const d of extensions)result.set(d.name+':'+d.reporter,d);
    return [...result.values()];
}
