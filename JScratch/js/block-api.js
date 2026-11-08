/* Declarative extension metadata shared by runtime, editor and catalog builder. */
(function(root){
    const reserved=new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public'.split(' '));
    function jsonValue(value,seen=new Set()){
        if(value===null||typeof value==='string'||typeof value==='boolean')return true;
        if(typeof value==='number')return Number.isFinite(value);
        if(typeof value!=='object'||seen.has(value))return false;
        if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
        seen.add(value);const valid=Object.values(value).every(v=>jsonValue(v,seen));seen.delete(value);return valid;
    }
    function normalize(definition){
        if(!definition||! /^[A-Za-z_$][\w$]*$/.test(definition.name??''))throw new Error('A block needs a valid JavaScript name');
        if(reserved.has(definition.name))throw new Error('A block name cannot be a JavaScript keyword');
        if(!['command','reporter','container'].includes(definition.kind))throw new Error('Block kind must be command, reporter or container');
        if(definition.label!==undefined&&typeof definition.label!=='string')throw new Error('Block label must be text');
        if(definition.category!==undefined&&! /^[a-z][a-z0-9-]*$/.test(definition.category))throw new Error('Block category must be a simple lowercase key');
        const params=definition.params??[];
        if(!Array.isArray(params)||params.some(p=>!p||! /^[A-Za-z_$][\w$]*$/.test(p.name??''))||new Set(params.map(p=>p.name)).size!==params.length)throw new Error('Block parameters need unique valid names');
        if(params.some(p=>p.label!==undefined&&typeof p.label!=='string'))throw new Error('Parameter label must be text');
        if(params.some(p=>Object.hasOwn(p,'default')&&!jsonValue(p.default)))throw new Error('Parameter defaults must be literal JSON values');
        if(params.some(p=>['type','operator','blocks','_id','__proto__','constructor','prototype'].includes(p.name)))throw new Error('Reserved block parameter');
        return {...definition,category:definition.category??'custom',params};
    }
    function editorDefinition(definition){
        const d=normalize(definition);
        return {name:d.name,label:d.label??d.name,category:d.category,reporter:d.kind==='reporter',container:d.kind==='container',rest:d.kind==='container',params:d.params.map(p=>({name:p.name,label:p.label,default:Object.hasOwn(p,'default')?JSON.stringify(p.default):null}))};
    }
    root.JScratchBlockAPI={normalize,editorDefinition};
})(globalThis);
