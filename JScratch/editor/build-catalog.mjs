// Run from any directory: node JScratch/editor/build-catalog.mjs
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parse} from './vendor/acorn.mjs';
import {readBlockDefinitions,mergeDefinitions} from './definitions.mjs';
import {makeProject} from './project.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function walk(n,fn){if(!n||typeof n!=='object')return;fn(n);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(x=>walk(x,fn));else if(v&&typeof v==='object')walk(v,fn);}}
const sample=fs.readFileSync(root+'program/sample.js','utf8'),names=new Set(),functions=new Map();
walk(parse(sample,{ecmaVersion:'latest'}),n=>{if(n.type==='CallExpression'&&n.callee.type==='Identifier')names.add(n.callee.name);});
for(const file of fs.readdirSync(root+'js').filter(f=>f.endsWith('.js'))){
    const source=fs.readFileSync(root+'js/'+file,'utf8'),ast=parse(source,{ecmaVersion:'latest'});
    for(const statement of ast.body){
        const entries=statement.type==='FunctionDeclaration'?[[statement.id.name,statement]]:statement.type==='VariableDeclaration'?statement.declarations.filter(n=>n.id.type==='Identifier'&&n.init).map(n=>[n.id.name,n.init]):[];
        for(const [name,node] of entries){
            if(!['FunctionDeclaration','ArrowFunctionExpression','FunctionExpression','CallExpression'].includes(node.type))continue;
            let params=node.params,reporter=false;
            if(!params&&node.type==='CallExpression'&&['binaryNum','compare','boolBinary'].includes(node.callee.name)){params=[{name:'value'},{name:'value2'}];reporter=true;}
            if(!params)continue;
            const returns=new Set();
            walk(node.body,n=>{
                if(n.type==='CallExpression'&&['createReporter','operator','sensingValue'].includes(n.callee.name))reporter=true;
                if(n.type==='ReturnStatement'&&n.argument?.type==='CallExpression')returns.add(n.argument.callee.name);
                if(n.type==='Property'&&n.key.name==='type'&&['operator','variable','spriteVariable'].includes(n.value.value))reporter=true;
            });
            functions.set(name,{name,category:file.replace('.js',''),params:params.filter(p=>p.type!=='RestElement').map(p=>({name:p.type==='AssignmentPattern'?p.left.name:p.name,default:p.type==='AssignmentPattern'?source.slice(p.right.start,p.right.end):null})),rest:params.some(p=>p.type==='RestElement'),reporter,returns});
        }
    }
}
for(let i=0;i<functions.size;i++)for(const d of functions.values())if([...d.returns].some(name=>functions.get(name)?.reporter))d.reporter=true;
const catalog=[...functions.values()].filter(d=>names.has(d.name)).map(({returns,...d})=>({...d,container:d.rest&&['repeat','forever','ifBlock','repeatUntil','whileBlock','whenBroadcast','whenStart','whenClone','withoutScreenRefresh'].includes(d.name)}));
catalog.find(d=>d.name==='cameraZoom').reporter=false;
catalog.push({...catalog.find(d=>d.name==='cameraZoom'),reporter:true,params:[]});
const complete=mergeDefinitions(catalog,readBlockDefinitions(fs.readFileSync(root+'js/extensions.js','utf8')));
fs.writeFileSync(root+'editor/catalog.json',JSON.stringify(complete,null,2)+'\n');
console.log(`Updated ${catalog.length} editor block definitions.`);

function scan(dir,prefix=''){
    const files=[],folders=[];
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
        if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
        const path=prefix+entry.name;
        if(entry.isDirectory()){folders.push(path);const nested=scan(dir+'/'+entry.name,path+'/');files.push(...nested.files);folders.push(...nested.folders);}
        else if(entry.name.endsWith('.js'))files.push(path);
    }
    return {files,folders};
}
const project=scan(root+'program');
fs.writeFileSync(root+'program/project.json',JSON.stringify(makeProject(project.files,project.folders),null,2)+'\n');
