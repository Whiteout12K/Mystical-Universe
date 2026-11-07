// Validated, versioned team plans. These describe selections, not simulated combat.
export const PLAN_VERSION=1;
export const plain=value=>String(value||'').replace(/<[^>]*>/g,'').replace(/\{\{effect:([^}]+)\}\}/g,(_,id)=>'['+id.replaceAll('-',' ')+']');
export function skillParagraphs(skill){return [skill?.description,...Object.entries(skill||{}).filter(([k,v])=>/^description\d+$/.test(k)&&typeof v==='string').map(([,v])=>v),...(skill?.additional||[]).map(a=>a.text||a.description)].filter(Boolean);}
export function canEquip(character,item){if(!character||!item)return false;if(item.weapon_type&&!character.weapon_type?.includes(item.weapon_type))return false;if(item.restriction&&/angelor/i.test(item.restriction)&&!character.species?.includes('Angelor'))return false;return true;}
export function normalizePlan(raw,roster,catalogues,skillData={}){
 const used=new Set(),valid=id=>typeof id==='string'&&Object.hasOwn(roster,id)&&!used.has(id);
 const team=Array.from({length:3},(_,i)=>{const id=raw?.team?.[i];if(!valid(id))return '';used.add(id);return id;});
 const support=valid(raw?.support)?raw.support:'';if(support)used.add(support);
 let resonance=null;const r=raw?.resonance;
 if(r&&Object.hasOwn(roster,r.id)&&roster[r.id].skills?.includes(r.skill)&&/^T\d+$/.test(r.skill))resonance={id:r.id,skill:r.skill};
 const equipment={},technical={};
 for(const id of used){const input=raw?.equipment?.[id]||{},gear={weapon:'',accessory:'',artifacts:['','','','']};
  for(const [key,kind]of [['weapon','weapons'],['accessory','accessories']])if(Object.hasOwn(catalogues[kind]||{},input[key])&&canEquip(roster[id],catalogues[kind][input[key]]))gear[key]=input[key];
  gear.artifacts=Array.from({length:4},(_,i)=>Object.hasOwn(catalogues.artifacts||{},input.artifacts?.[i])?input.artifacts[i]:'');equipment[id]=gear;
  const selected=raw?.technical?.[id],listed=roster[id].skills?.filter(s=>/^T\d+$/.test(s))||[],available=listed.filter(s=>skillData[id]?.[s]);
  technical[id]=listed.includes(selected)?selected:(available[0]||'');
 }
 return {version:PLAN_VERSION,team,support,resonance,equipment,technical};
}
export function planHash(plan){return '#team='+encodeURIComponent(JSON.stringify(plan));}
export function parsePlanHash(hash){if(!hash.startsWith('#team='))return null;if(hash.length>30000)throw Error('The team link is too large.');const value=JSON.parse(decodeURIComponent(hash.slice(6)));if(value.version!==PLAN_VERSION||!Array.isArray(value.team))throw Error('This team link uses an unsupported format.');return value;}
export function artifactBonuses(gear,artifacts){const counts=new Map();for(const id of gear?.artifacts||[])if(artifacts[id])counts.set(id,(counts.get(id)||0)+1);return [...counts].flatMap(([id,count])=>(artifacts[id].set_bonuses||[]).filter(b=>count>=b.pieces).map(b=>({id,count,...b})));}
export function resonanceAssessment(plan,roster,skillData){
 const r=plan.resonance;if(!r)return {status:'Choose a Resonance skill',notes:['One Technical Skill can be shared with the team.'],eligible:[]};
 const skill=skillData[r.id]?.[r.skill],owner=roster[r.id],members=plan.team.filter(id=>roster[id]);
 if(!skill)return {status:'Skill details unavailable',notes:['This skill is listed in the roster but its description has not been added yet. Eligibility cannot be checked.'],eligible:[]};
 const sourceNotes=skillParagraphs(skill).filter(p=>/Resonance/i.test(plain(p))).map(plain),notes=[...sourceNotes];
 const ability=skillParagraphs(skill).some(p=>/^Ability\s*:/i.test(plain(p))),ownerPresent=members.includes(r.id);
 let eligible=ownerPresent?[r.id]:[];
 const rule=r.id+':'+r.skill;
 if(rule==='c1:T1')eligible=members.filter(id=>roster[id].species?.some(s=>['Water Spirit','Naiad'].includes(s)));
 else if(rule==='c1:T2')eligible=ownerPresent?[r.id]:members.filter(id=>roster[id].affinity?.includes('Light')).slice(0,1);
 else if(rule==='c2:T1')eligible=members.filter(id=>id===r.id||(roster[id].affinity?.includes('Dark')&&roster[id].species?.some(s=>['Icelorian','Gostlynger'].includes(s))));
 else if(rule==='c5:T2')eligible=members.filter(id=>id===r.id||roster[id].affiliation?.includes('Mystical Legends'));
 else if(rule==='c7:T1')eligible=members;
 else if(!ability&&!sourceNotes.some(p=>/Exclusive to/i.test(p)))eligible=members;
 if(ability&&!ownerPresent&&!['c1:T1','c5:T2','c7:T1'].includes(rule))notes.push('The owner is outside the main team. Ability activation requires the owner unless the skill explicitly grants another character access.');
 if(rule==='c6:T1')notes.push('Banner bonuses apply to Tempest Aquia cohort members while the banner survives.');
 if(rule==='c8:T1')notes.push('Blue Legion bonuses require fellow Blue Legion members; casting the Ability requires its owner in the main team.');
 if(rule==='c9:T1')notes.push('The health-meter bonus requires Black Rampart membership and Surge. Full-team health and healing are also conditions.');
 if(r.id==='c10')notes.push('Lightning-based attacks or unlocked elemental infusions must meet the conditions in the description. Element affinity alone does not confirm them.');
 notes.push('Conditional effects activate only when their written requirements are met. Support-slot placement does not count as main-team presence for Ability activation.');
 if(ownerPresent)notes.push(plan.technical?.[r.id]===r.skill?'The same Technical Skill is selected personally and for Resonance. Duplicate bonuses stack where the skill rules allow.':'The owner can keep a different personal Technical Skill alongside Resonance.');
 return {status:eligible.length?'Requirements to review':'No eligible main-team activator identified',notes,eligible,skill,owner};
}
export function equipmentInteractions(id,gear,roster,catalogues,skillData){
 const notes=[],paragraphs=Object.values(skillData[id]||{}).flatMap(skillParagraphs),text=plain(paragraphs.join(' '));
 // Explicit interactions are explained as conditions, never assumed active bonuses.
 if(gear?.weapon==='w1'&&/\[Shield\]/i.test(text))notes.push({text:'Gladius Lucis reacts when the wearer’s Shield breaks or ends. This character has Shield references; review the skill and health-consumption conditions.',kind:'weapons',id:'w1'});
 if(gear?.accessory==='a1'&&/\[Shield\]/i.test(text))notes.push({text:'Rune of the Spellcaster extends party buffs when enough Shield is gained. Shield references in this character’s skills may help meet that threshold.',kind:'accessories',id:'a1'});
 if(gear?.weapon==='w2'&&/\[Freeze\]|\[Flash\]/i.test(text))notes.push({text:'Icelorian Blade extends Freeze and rewards Flash stacks. The character’s descriptions reference one or both effects; their application conditions still apply.',kind:'weapons',id:'w2'});
 if((gear?.artifacts||[]).filter(x=>x==='o1').length>=4&&roster[id]?.affinity?.some(x=>['Water','Earth'].includes(x)))notes.push({text:'The full Mistywood set can extend Plant Tether when the triggering Special Skill is Water or Earth. This character has a matching affinity; check the actual equipped skill’s element.',kind:'artifacts',id:'o1'});
 if((gear?.artifacts||[]).filter(x=>x==='o3').length>=2)notes.push({text:'The Angel’s Gown converts healing rate into health and defense. Its four-piece sharing effect requires a field from a Special Skill.',kind:'artifacts',id:'o3'});
 return notes;
}
