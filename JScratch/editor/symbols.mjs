import {parse} from './vendor/acorn.mjs';
export function stringLiteral(source){
    try{const ast=parse('('+source+'\n)',{ecmaVersion:'latest'}),node=ast.body[0].expression;return node.type==='Literal'&&typeof node.value==='string'?node.value:null;}catch{return null;}
}
const VARS=new Set(['makeVar','setVar','getVar','changeVarBy','deleteVar']);
const ENUMS={spriteCoordinateMode:{1:['world','canvas','screen']},coordinatePlane:{1:['left','right'],2:['top','bottom']},facing:{1:['left','right','up','down']},spriteEffect:{1:['brightness','ghost','color']},spriteChangeEffect:{1:['brightness','ghost','color']},keyPressed:{0:['w','a','s','d','uparrow','downarrow','leftarrow','rightarrow','space','enter','escape','leftclick','rightclick']}};
export function argumentPicker(def,index,read,cloneOwner=null,functionOwner=null){
    const param=def.params[index],name=param?.name,fn=def.name;
    const ownerIndex=typeof param?.owner==='string'?def.params.findIndex(p=>p.name===param.owner):0;
    let owner=read(Math.max(0,ownerIndex));if(owner==='self')owner=cloneOwner??'@self';
    if(['defineFunction','callFunction'].includes(fn)&&index===0)return {kind:'function',scope:''};
    if(['functionValue','setFunctionValue'].includes(fn)&&index===0)return {kind:'functionLocal',scope:functionOwner??'@dynamic'};
    if(param?.options)return {kind:'choice',options:param.options};
    if(param?.picker)return {kind:param.picker,scope:['costume','spriteVar'].includes(param.picker)?owner??'@dynamic':''};
    if(ENUMS[fn]?.[index])return {kind:'choice',options:ENUMS[fn][index]};
    if(['uiSet','uiGet','uiBind','uiUnbind'].includes(fn)&&index===1)return {kind:'choice',options:['x','y','scale','rotation','visible','opacity','layer','text','value','max','width','height','radius','color','background','foreground','textColor','coordinateMode']};
    if(fn==='uiSet'&&index===2&&['color','background','foreground','textColor'].includes(read(1)))return {kind:'color'};
    if(['color','color_hex','background','foreground','textColor'].includes(name))return {kind:'color'};
    if(['enabled','visible'].includes(name))return {kind:'boolean'};
    if(['whenBroadcast','broadcast','broadcastAndWait','stopScripts'].includes(fn)&&index===0)return {kind:'broadcast',scope:''};
    if(VARS.has(fn)&&index===0)return {kind:'variable',scope:''};
    if(name==='varName')return {kind:'spriteVar',scope:owner??'@dynamic'};
    if((fn==='spriteCostume'||fn==='uiImage')&&index===1)return {kind:'costume',scope:owner??'@dynamic'};
    if(fn==='canvasCostume'&&index===0)return {kind:'costume',scope:'@stage'};
    if(name==='spriteName'||['sprite','sprite2'].includes(name))return {kind:'sprite',scope:''};
    if(['sprite','motion','camera','clone','solid'].includes(def.category)&&['name','target'].includes(name))return {kind:'sprite',scope:''};
    if(def.category==='ui'&&name==='id')return {kind:'sprite',scope:''};
    if(def.category==='lists'&&name==='name')return {kind:'list',scope:''};
    if(def.category==='sound'&&name==='name')return {kind:'sound',scope:''};
    if(def.category==='json'&&name==='name')return {kind:'json',scope:''};
    return null;
}
export const namedPicker=spec=>!!spec&&!['color','choice','boolean'].includes(spec.kind);
const key=spec=>JSON.stringify([spec.kind,spec.scope??'']);
export class SymbolLibrary{
    constructor(catalog,{sources=()=>[],onChange=()=>{},data=null}={}){this.catalog=new Map(catalog.map(d=>[d.name,d]));this.sources=sources;this.onChange=onChange;this.items=new Map();this.references=new Map();this.dynamic=new Set();this.unknown=new Map();this.revision=0;this.merge(data);}
    merge(data){let changed=false;for(const [bucket,values] of Object.entries(data?.items??{})){try{const [kind,scope]=JSON.parse(bucket);if(typeof kind!=='string'||typeof scope!=='string'||!Array.isArray(values))continue;}catch{continue;}const set=this.items.get(bucket)??new Set();for(const value of values)if(typeof value==='string'&&value&&!set.has(value)){set.add(value);changed=true;}this.items.set(bucket,set);}if(changed)this.changed();}
    export(){return {version:1,items:Object.fromEntries([...this.items].map(([bucket,values])=>[bucket,[...values].sort()]))};}
    changed(){this.revision++;this.onChange(this.export());}
    add(spec,value){value=String(value).trim();if(!value)return false;const bucket=key(spec),set=this.items.get(bucket)??new Set();if(set.has(value))return true;set.add(value);this.items.set(bucket,set);this.changed();return true;}
    refresh(){
        this.references.clear();this.dynamic.clear();this.unknown.clear();let discovered=false;const spriteLists=new Set(),listValues=new Map(),dynamicLists=new Set();
        const reference=(spec,value)=>{if(!value)return;const bucket=key(spec),counts=this.references.get(bucket)??new Map();counts.set(value,(counts.get(value)??0)+1);this.references.set(bucket,counts);const set=this.items.get(bucket)??new Set();if(!set.has(value)){set.add(value);this.items.set(bucket,set);discovered=true;}};
        const walk=(node,cloneOwner=null,unrecognized=false,functionOwner=null)=>{
            if(!node||typeof node!=='object')return;
            if(node.type==='Literal'&&typeof node.value==='string'&&unrecognized)this.unknown.set(node.value,(this.unknown.get(node.value)??0)+1);
            let unknown=unrecognized;
            if(node.type==='CallExpression'){
                const def=node.callee.type==='Identifier'?this.catalog.get(node.callee.name):null;
                unknown=unknown||!def;
                if(def){
                    const read=i=>node.arguments[i]?.type==='Literal'&&typeof node.arguments[i].value==='string'?node.arguments[i].value:null;
                    if(def.name==='whenClone')cloneOwner=read(0);
                    if(def.name==='defineFunction'){functionOwner=read(0);for(const item of node.arguments[1]?.elements??[])if(typeof item?.value==='string')reference({kind:'functionLocal',scope:functionOwner},item.value);}
                    for(let i=0;i<Math.min(node.arguments.length,def.params.length);i++){
                        const spec=argumentPicker(def,i,read,cloneOwner,functionOwner);if(!namedPicker(spec))continue;
                        const value=read(i);if(value!==null)reference(spec,value);else this.dynamic.add(spec.kind);
                    }
                    if(['makeList','setList','addToList','insertInList','replaceInList'].includes(def.name)){
                        const list=read(0),items=node.arguments.at(-1),values=items?.type==='ArrayExpression'?items.elements:[items],set=listValues.get(list)??new Set();
                        for(const item of values){if(item?.type==='Literal'&&item.value!==null)set.add(String(item.value));else dynamicLists.add(list);}
                        listValues.set(list,set);
                    }
                    if(def.name==='spriteCollisionTargets'){
                        const target=node.arguments[1];
                        if(target?.type==='ArrayExpression')for(const item of target.elements){if(item?.type==='Literal'&&item.value!==null)reference({kind:'sprite',scope:''},String(item.value));else this.dynamic.add('sprite');}
                        else if(target?.type==='Literal')reference({kind:'sprite',scope:''},String(target.value));
                        else if(target?.type==='CallExpression'&&target.callee.name==='getList'&&typeof target.arguments[0]?.value==='string')spriteLists.add(target.arguments[0].value);
                        else this.dynamic.add('sprite');
                    }
                }
            }
            if(node.type==='MemberExpression'&&['sprites','variables','privateVariables'].includes(node.object?.property?.name)){
                if(!node.computed&&node.property.type==='Identifier')this.unknown.set(node.property.name,(this.unknown.get(node.property.name)??0)+1);
                else if(node.property.type!=='Literal'){if(node.object.property.name==='sprites')this.dynamic.add('sprite');else{this.dynamic.add('variable');this.dynamic.add('spriteVar');}}
            }
            if(node.type==='MemberExpression'&&node.computed&&node.property?.type==='Literal'&&typeof node.property.value==='string')this.unknown.set(node.property.value,(this.unknown.get(node.property.value)??0)+1);
            for(const [prop,value] of Object.entries(node))if(prop!=='start'&&prop!=='end'){if(Array.isArray(value))for(const child of value)walk(child,cloneOwner,unknown,functionOwner);else if(value&&typeof value==='object')walk(value,cloneOwner,unknown,functionOwner);}
        };
        for(const {name,source} of this.sources()){
            if(name==='sample.js'||name.startsWith('reference/'))continue;
            try{walk(parse(source,{ecmaVersion:'latest'}));}catch{this.dynamic.add('*');}
        }
        for(const list of spriteLists){for(const value of listValues.get(list)??[])reference({kind:'sprite',scope:''},value);if(dynamicLists.has(list)||dynamicLists.has(null))this.dynamic.add('sprite');}
        if(discovered)this.changed();
    }
    names(spec){this.refresh();return [...(this.items.get(key(spec))??[])].sort((a,b)=>a.localeCompare(b));}
    uses(spec,value){const count=this.references.get(key(spec))?.get(value)??0;const uncertain=this.dynamic.has('*')||this.dynamic.has(spec.kind)||spec.scope==='@dynamic'||((spec.kind==='costume'||spec.kind==='spriteVar')&&(this.references.get(key({...spec,scope:'@dynamic'}))?.get(value)??0)>0);return {count:count+(this.unknown.get(value)??0),uncertain};}
    rename(spec,oldName,newName){
        const bucket=key(spec),items=this.items.get(bucket);if(items?.delete(oldName))items.add(newName);
        if(['sprite','function'].includes(spec.kind))for(const [bucket,values] of [...this.items]){const [kind,scope]=JSON.parse(bucket);if(scope===oldName&&(['costume','spriteVar'].includes(kind)&&spec.kind==='sprite'||kind==='functionLocal'&&spec.kind==='function')){const target=key({kind,scope:newName}),merged=this.items.get(target)??new Set();for(const value of values)merged.add(value);this.items.set(target,merged);this.items.delete(bucket);}}
        this.changed();
    }
    remove(spec,value){this.refresh();const usage=this.uses(spec,value);if(usage.count||usage.uncertain)return false;const removed=this.items.get(key(spec))?.delete(value);if(removed)this.changed();return !!removed;}
}
