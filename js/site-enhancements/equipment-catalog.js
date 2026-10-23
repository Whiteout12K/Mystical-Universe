// Pure catalogue helpers shared by the codex and its checks.
export const categories=['effects','weapons','accessories','artifacts'];
export function equipmentAnchor(category,id){return ({weapons:'weapon',accessories:'accessory',artifacts:'artifact'}[category]||'effect')+'-'+id;}
export function equipmentSections(item){return Array.isArray(item.reference_sections)?item.reference_sections:[];}
export function equipmentImage(item){return item.weapon_img||item.accessory_img||item.artifact_img||'';}
export function equipmentPieces(item){return [1,2,3,4].map((number,index)=>({number,slot:['Headgear','Chestplate','Leggings','Boots'][index],name:item[`piece_num_${number}_name`]||'',image:item[`piece_num_${number}_img`]||''}));}
export function catalogueSearchText(item){return [item.name,item.previous_name,item.type,item.weapon_type,item.restriction,item.seal_ring_name,...(item.rarities||[]),...(item.reference_notes||[]),...(item.reference_stats||[]).map(s=>s.name),...equipmentSections(item).flatMap(s=>[s.title,...s.paragraphs]),...equipmentPieces(item).map(p=>p.name)].filter(Boolean).join(' ').replace(/<[^>]*>/g,'');}
export function rarityClass(value){const key=String(value||'').toLowerCase();return ['c','un','r','sr','ssr','ur','lr'].includes(key)?key:'';}
export const elementClasses={normal:'normal',light:'light',dark:'dark',fire:'fire',water:'water',wind:'wind',earth:'earth',lightning:'lightning',plant:'plant'};
// Inline equipment definitions resolve live to the shared effect catalogue.
export function effectDescriptions(effect){return Object.entries(effect).filter(([key,value])=>/^description\d*$/.test(key)&&typeof value==='string').sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([,value])=>value);}
export function equipmentEffectDefinition(text,effects){
 const match=String(text).match(/^\[([^\]]+)\]\s+[^\n]*?\s[-–—]\s/);if(!match)return null;
 const entry=Object.entries(effects).find(([,effect])=>effect.name.toLowerCase()===match[1].toLowerCase());
 return entry?{id:entry[0],effect:entry[1]}:null;
}
