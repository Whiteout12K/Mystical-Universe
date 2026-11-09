// Read-only snapshots: never evaluate reporters, getters, or costume/image data.
export function previewValue(value,seen=new WeakSet(),depth=0,budget={left:1000}){
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number')return Number.isFinite(value)?value:String(value);
    if(typeof value==='string')return value.length>5000?value.slice(0,5000)+'… [truncated]':value;
    if(typeof value==='undefined')return '[undefined]';
    if(typeof value==='bigint')return value+'n';
    if(typeof value==='function')return '[Function]';
    if(typeof value==='symbol')return String(value);
    if(--budget.left<0)return '[Preview size limit]';
    if(seen.has(value))return '[Circular]';
    if(depth>=8)return '[Preview depth limit]';
    seen.add(value);
    try{
        if(value instanceof Date)return Number.isNaN(value.getTime())?'[Invalid date]':value.toISOString();
        if(value instanceof Map||value instanceof Set){
            const map=value instanceof Map,iterator=map?Map.prototype.entries.call(value):Set.prototype.values.call(value),items=[];
            for(const item of iterator){if(items.length===200){items.push('[More entries]');break;}items.push(previewValue(item,seen,depth+1,budget));}
            return {type:map?'Map':'Set',entries:items};
        }
        if(Array.isArray(value)){
            const length=Object.getOwnPropertyDescriptor(value,'length').value,result=[];
            for(let i=0;i<Math.min(length,200);i++){const d=Object.getOwnPropertyDescriptor(value,String(i));result.push(!d?'[Empty]':'value' in d?previewValue(d.value,seen,depth+1,budget):'[Getter]');}
            if(length>200)result.push(`[${length-200} more items]`);return result;
        }
        const keys=Object.keys(value),entries=keys.slice(0,200).map(key=>{
            const d=Object.getOwnPropertyDescriptor(value,key);return [key,'value' in d?previewValue(d.value,seen,depth+1,budget):'[Getter]'];
        });
        if(keys.length>200)entries.push(['…',`[${keys.length-200} more properties]`]);
        return Object.fromEntries(entries);
    }catch{return '[Unavailable]';}finally{seen.delete(value);}
}
export function variablePreview(variables){
    try{return Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(variables??{})).filter(([,d])=>d.enumerable).map(([key,d])=>[key,'value' in d?previewValue(d.value):'[Getter]']));}
    catch{return {'…':'[Unavailable]'};}
}
export function inspectorId(sprite,runId){return `${runId}:${sprite.isClone?'clone:'+sprite.cloneId:'sprite:'+sprite.name}`;}
export function spriteDetails(sprite,runId){
    const properties={};
    for(const key of ['name','cloneOf','cloneId','coordinateMode','coordinateHorizontal','coordinateVertical','x','y','width','height','scale','rotation','flipX','flipY','visible','touchable','loaded','opacity','costume','layer','effects','solidCollision','velocityX','velocityY']){
        const descriptor=Object.getOwnPropertyDescriptor(sprite,key);
        if(descriptor&&'value' in descriptor)properties[key]=previewValue(descriptor.value);
    }
    // UI dimensions are shared numeric accessors; read their stored base values.
    if(sprite.isUI){properties.uiType=sprite.uiType;properties.width=sprite.uiBaseWidth*sprite.scale;properties.height=sprite.uiBaseHeight*sprite.scale;}
    return {id:inspectorId(sprite,runId),name:sprite.isClone?sprite.cloneIdName:sprite.name,type:sprite.isUI?'UI':sprite.isClone?'Clone':'Sprite',isClone:!!sprite.isClone,source:sprite.cloneOf??null,properties,variables:variablePreview(sprite.variables),privateVariables:variablePreview(sprite.privateVariables)};
}
export function inspectorSnapshot(engine,selectedId=null){
    const active=[...Object.values(engine.sprites),...engine.clones].filter(s=>!s.deleted),runId=engine.runId;
    let selected=null;
    const sprites=active.map(s=>{
        const id=inspectorId(s,runId);if(id===selectedId)selected=s;
        return {id,name:s.isClone?s.cloneIdName:s.name,type:s.isUI?'UI':s.isClone?'Clone':'Sprite',isClone:!!s.isClone,source:s.cloneOf??null,visible:s.visible!==false};
    });
    return {runId,state:!engine.running?'Stopped':engine.paused?'Paused':'Running',sprites,selected:selected?spriteDetails(selected,runId):null};
}
