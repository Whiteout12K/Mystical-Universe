import {parse} from './vendor/acorn.mjs';
import {argumentPicker,namedPicker} from './symbols.mjs';
const executable=name=>name!=='sample.js'&&!name.startsWith('reference/');
const literal=node=>node?.type==='Literal'&&typeof node.value==='string'?node.value:null;
function visit(node,fn,scope={}){if(!node||typeof node!=='object')return;scope=fn(node,scope)??scope;for(const [key,value] of Object.entries(node))if(!['loc','start','end'].includes(key)){if(Array.isArray(value))value.forEach(child=>visit(child,fn,scope));else if(value&&typeof value==='object')visit(value,fn,scope);}}
export function functionDefinitions(sources){
    const definitions=[];
    for(const {name:file,source} of sources.filter(s=>executable(s.name)))try{visit(parse(source,{ecmaVersion:'latest'}),node=>{
        if(node.type!=='CallExpression'||node.callee.name!=='defineFunction')return;
        const name=literal(node.arguments[0]),parameters=node.arguments[1];
        if(name&&parameters?.type==='ArrayExpression'&&parameters.elements.every(p=>literal(p)!==null))definitions.push({name,parameters:parameters.elements.map(literal),file});
    });}catch{}
    return definitions;
}
export function indexReferences(sources,catalog){
    const definitions=new Map(catalog.map(d=>[d.name,d])),references=[],warnings=[],spriteLists=new Set();
    for(const {name,source} of sources.filter(s=>executable(s.name)))try{visit(parse(source,{ecmaVersion:'latest'}),node=>{if(node.type==='CallExpression'&&node.callee.name==='spriteCollisionTargets'&&node.arguments[1]?.callee?.name==='getList')spriteLists.add(literal(node.arguments[1].arguments[0]));});}catch{}
    const add=(file,source,node,spec,call,replacement=null)=>{const value=literal(node);if(value===null)return;references.push({file,start:node.start,end:node.end,line:node.loc.start.line,column:node.loc.start.column+1,value,...spec,call,preview:source.split('\n')[node.loc.start.line-1].trim(),replacement});};
    for(const {name:file,source} of sources.filter(s=>executable(s.name))){
        let ast;try{ast=parse(source,{ecmaVersion:'latest',locations:true});}catch(error){warnings.push({file,message:'Cannot inspect invalid JavaScript: '+error.message});continue;}
        visit(ast,(node,scope)=>{
            if(node.type==='CallExpression'){
                const def=node.callee.type==='Identifier'?definitions.get(node.callee.name):null;
                if(!def){warnings.push({file,message:'JavaScript call may contain references that require manual review.'});return scope;}
                const read=i=>literal(node.arguments[i]);
                if(def.name==='whenClone')scope={...scope,clone:read(0)};
                if(def.name==='defineFunction')scope={...scope,method:read(0)};
                for(let i=0;i<Math.min(def.params.length,node.arguments.length);i++){
                    const spec=argumentPicker(def,i,read,scope.clone,scope.method);if(!namedPicker(spec))continue;
                    if(read(i)!==null)add(file,source,node.arguments[i],spec,def.name);
                    else warnings.push({file,kind:spec.kind,message:`${def.name}: computed ${spec.kind} needs manual review.`});
                }
                if(def.name==='defineFunction'&&node.arguments[1]?.type==='ArrayExpression')for(const item of node.arguments[1].elements)add(file,source,item,{kind:'functionLocal',scope:read(0)},def.name);
                if(def.name==='spriteCollisionTargets'){
                    const target=node.arguments[1];for(const item of target?.type==='ArrayExpression'?target.elements:[target])if(literal(item)!==null)add(file,source,item,{kind:'sprite',scope:''},def.name);
                }
                if(['makeList','setList','addToList','insertInList','replaceInList'].includes(def.name)&&spriteLists.has(read(0))){const values=node.arguments.at(-1);for(const item of values?.type==='ArrayExpression'?values.elements:[values])add(file,source,item,{kind:'sprite',scope:''},def.name);}
            }
            if(node.type==='MemberExpression'&&node.object?.type==='MemberExpression'&&node.object.object?.name==='ENGINE'&&['sprites','variables'].includes(node.object.property?.name)){
                const kind=node.object.property.name==='sprites'?'sprite':'variable';
                if(node.computed){if(literal(node.property)!==null)add(file,source,node.property,{kind,scope:''},'JavaScript');else warnings.push({file,kind,message:'Computed runtime lookup needs manual review.'});}
                else references.push({file,start:node.object.end,end:node.end,line:node.loc.start.line,column:node.loc.start.column+1,value:node.property.name,kind,scope:'',call:'JavaScript',preview:source.split('\n')[node.loc.start.line-1].trim(),member:true});
            }
            return scope;
        });
    }
    return {references,warnings};
}
export function renameReferences(sources,catalog,spec,oldName,newName){
    newName=newName.trim();if(!newName)throw new Error('Enter a new name.');
    if(oldName===newName)throw new Error('Choose a different name.');
    const index=indexReferences(sources,catalog),matches=index.references.filter(r=>r.kind===spec.kind&&(r.scope??'')===(spec.scope??'')&&r.value===oldName);
    if(index.references.some(r=>r.kind===spec.kind&&(r.scope??'')===(spec.scope??'')&&r.value===newName))throw new Error('That name is already used in this scope.');
    if(index.warnings.some(w=>w.message.startsWith('Cannot inspect')))throw new Error('Fix invalid project JavaScript before renaming.');
    const changed=[];
    for(const file of sources){const edits=matches.filter(r=>r.file===file.name).sort((a,b)=>b.start-a.start);if(!edits.length)continue;let source=file.source;const seen=new Set();for(const edit of edits){if(seen.has(edit.start))continue;seen.add(edit.start);source=source.slice(0,edit.start)+(edit.member?'['+JSON.stringify(newName)+']':JSON.stringify(newName))+source.slice(edit.end);}parse(source,{ecmaVersion:'latest'});changed.push({name:file.name,source,previous:file.source});}
    return {changed,matches,warnings:index.warnings.filter(w=>!w.kind||w.kind===spec.kind)};
}
