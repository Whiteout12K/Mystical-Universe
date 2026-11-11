// Layout is independent of source formatting and never changes script order.
const finite=Number.isFinite;
function fingerprint(text){let a=2166136261,b=5381;for(let i=0;i<text.length;i++){const code=text.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b,33)^code;}return text.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);}
const normalizedFingerprint=value=>typeof value==='string'&&value.startsWith('{')?fingerprint(value):value;
export function blockIdentity(block){
    const child=block.getInputTargetBlock?.('ARG0');
    return child?.type==='js_expression'?String(child.getFieldValue('VALUE')):block.type==='js_code'?block.getFieldValue('CODE'):'';
}
export function capturePositions(workspace,bridge){
    return workspace.getTopBlocks(false).map((block,index)=>{
        const {x,y}=block.getRelativeToSurfaceXY();let signature=null;try{signature=fingerprint(JSON.stringify(bridge.fromBlock(block)));}catch{}
        return {type:block.type,identity:blockIdentity(block),fingerprint:signature,index,x,y};
    });
}
export function statePositions(state){
    return (Array.isArray(state?.blocks?.blocks)?state.blocks.blocks:[]).filter(b=>finite(b.x)&&finite(b.y)).map((b,index)=>({type:b.type,identity:String((b.inputs?.ARG0?.block??b.inputs?.ARG0?.shadow)?.fields?.VALUE??b.fields?.CODE??''),fingerprint:null,index,x:b.x,y:b.y}));
}
export function restorePositions(workspace,bridge,positions){
    const saved=(Array.isArray(positions)?positions:[]).filter(p=>typeof p.type==='string'&&finite(p.x)&&finite(p.y)),blocks=workspace.getTopBlocks(false),now=capturePositions(workspace,bridge),used=new Set(),matched=new Map();
    // Reserve exact matches before fallback matches, so a newly inserted script
    // cannot steal the position of an unchanged script later in the file.
    for(const match of [(a,b)=>a.fingerprint&&a.fingerprint===normalizedFingerprint(b.fingerprint),(a,b)=>a.type===b.type&&a.identity===b.identity,(a,b)=>a.type===b.type]){
        now.forEach((position,index)=>{if(matched.has(index))return;const candidates=saved.map((value,i)=>({value,i})).filter(({value,i})=>!used.has(i)&&match(position,value)).sort((a,b)=>Math.abs(a.value.index-index)-Math.abs(b.value.index-index));if(candidates.length){used.add(candidates[0].i);matched.set(index,candidates[0].value);}});
    }
    let right=48;
    for(const [index,p] of matched){const block=blocks[index],current=block.getRelativeToSurfaceXY();block.moveBy(p.x-current.x,p.y-current.y);right=Math.max(right,p.x+(block.getHeightWidth?.().width??600)+96);}
    blocks.forEach((block,index)=>{if(matched.has(index))return;const current=block.getRelativeToSurfaceXY();block.moveBy(right-current.x,48-current.y);right+=(block.getHeightWidth?.().width??600)+96;});
}
export function captureView(workspace){return {scale:workspace.scale,scrollX:workspace.scrollX,scrollY:workspace.scrollY};}
export function validView(view){return !!view&&finite(view.scale)&&view.scale>0&&finite(view.scrollX)&&finite(view.scrollY);}
export function restoreView(workspace,view){if(!validView(view))return false;workspace.setScale(view.scale);workspace.scroll(view.scrollX,view.scrollY);return true;}
