// Equipment progression shared by profile cards and character stat totals.
const number=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const level=(v,max)=>Math.max(1,Math.min(max,Math.floor(number(v,1))));
export const equipmentStatKey=value=>String(value||'').replace(/\s*\([a-o](?:,\s*\d+)?\)\s*$/i,'').trim().toLowerCase().replace(/[\s-]+/g,'_');
export function getEquipmentStatEntries(info,atLevel){
 const f=info?.stat_change_by_level||{},lv=level(atLevel,100),rows=[];
 for(let i=1;i<=2;i++){
  const name=f['main_'+i],reference=info?.reference_stats?.[i-1],base=number(reference?.level_1,number(f['main_'+i+'_value'],NaN));
  if(!name||!Number.isFinite(base))continue;
  // Explicit codex endpoints take precedence over legacy growth weights.
  const end=number(reference?.level_100,NaN),value=Number.isFinite(end)?base+(end-base)*(lv-1)/99:base*(1+number(f.main_stat_weight)*(lv-1));
  rows.push({name:equipmentStatKey(name),base,value,type:reference?.unit||f['main_'+i+'_type']||'+'});
 }
 return rows;
}
export function getArtifactMainStat(info,p,atLevel,rules){
 const f=info?.stat_change_by_level||{},name=equipmentStatKey(p?.main??f.main),rule=rules?.main_stats?.[name],base=number(rule?.value,number(p?.main_value??f.main_value,NaN));
 if(!name||!Number.isFinite(base))return null;
 return {name,base,value:base*level(atLevel,rules?.max_level||20),type:rule?.type??p?.main_type??f.main_type??''};
}
export function getArtifactSubStats(p,rules){
 const rows=[];for(let i=1;i<=4;i++){
  const name=equipmentStatKey(p?.['sub_'+i]),rule=rules?.substats?.[name],base=number(rule?.value,number(p?.['sub_'+i+'_value'],NaN));
  if(!name||!Number.isFinite(base))continue;
  const rolls=Math.max(0,Math.min(rules?.max_substat_upgrades??5,Math.floor(number(p?.['sub_'+i+'_rolls']))));
  rows.push({name,base,value:base*(rolls+1),rolls,type:rule?.type??p?.['sub_'+i+'_type']??'+'});
 }
 return rows;
}
