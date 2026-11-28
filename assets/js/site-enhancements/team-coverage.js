import {el} from './core.js';
import {collectTeamEffects} from './team-effects.js';
import {selectedSkills,skillParagraphsWithStars,isStarSkill,characterSkillDefinitions,textOnly} from './character-build-model.js';
import {equipmentSections,effectDescriptions} from './equipment-catalog.js';

const categories=[
 ['healing','Healing',/\b(heal(?:s|ing)?|restor\w*[^.!;]{0,45}(?:health|hp)|regenerat\w*[^.!;]{0,30}(?:health|hp))\b/i],
 ['defense','Defense',/\b(shields?|barriers?|invincib\w*|immun\w*|(?:increas\w*|boost\w*|gain\w*)[^.!;]{0,45}defen[cs]e|defen[cs]e\s+(?:buff|boost|increase))\b/i],
 ['damage-reduction','Damage Reduction',/\b(?:damage reduction|reduc\w*[^.!;]{0,45}(?:damage taken|incoming damage|received damage)|(?:damage taken|incoming damage|received damage)[^.!;]{0,35}(?:reduc\w*|decreas\w*))\b/i],
 ['damage','Damage',/\b(?:deal\w*[^.!;]{0,90}damage|attacks?|burn|bleed|poison)\b/i],
 ['off-field-damage','Off-Field Damage',/^(?=[\s\S]*\b(?:off[ -]field|not on (?:the )?field|while inactive)\b)(?=[\s\S]*\b(?:damage|attacks?|javelins?|strik\w*|hits?)\b)/i],
 ['cleansing','Cleansing',/\b(cleanse\w*|purif\w*|(?:remov\w*|clear\w*|dispel\w*)[^.!;]{0,35}(?:debuffs?|negative effects?|ailments?))\b/i],
 ['buffs','Stat Buffs',/\b(?:(?:increas\w*|boost\w*|enhanc\w*)[^.!;]{0,65}(?:attack|defen[cs]e|speed|critical|damage|health|healing rate|resistance)|(?:attack|defen[cs]e|speed|critical|healing rate)\s+(?:boost|increase|buff))\b/i],
 ['control','Control',/\b(stun\w*|freez\w*|frozen|knockback|knockup|knock.up|immobiliz\w*|silenc\w*|taunt\w*|slow\w*|bind\w*|bound|blind\w*|sleep|paraly\w*)\b/i],
 ['resistance-reduction','Resistance Reduction',/\b(?:(?:reduc\w*|decreas\w*|lower\w*|shred\w*)[^.!;]{0,60}resistan\w*|resistan\w*[^.!;]{0,45}(?:reduc\w*|decreas\w*|lower\w*|shred\w*))\b/i],
 ['element-buff','Element Buff',/\b(?:(?:increas\w*|boost\w*|enhanc\w*|gain\w*)[^.!;]{0,80}(?:elemental|element|lightning|light|dark|fire|water|wind|earth|plant)[^.!;]{0,30}(?:damage|bonus|effectiveness)|(?:elemental|element|lightning|light|dark|fire|water|wind|earth|plant)[^.!;]{0,45}(?:damage|effectiveness)[^.!;]{0,35}(?:increas\w*|boost\w*|enhanc\w*))\b/i],
 ['resources','Resource Support',/\b(?:(?:restor\w*|gain\w*|generat\w*|increas\w*)[^.!;]{0,45}(?:mana|energy|gauge)|(?:reduc\w*|reset\w*)[^.!;]{0,30}cooldown)\b/i]
];
export function analyzeTeamCoverage(context,plan,builds={}){
 const result=categories.map(([id,label])=>({id,label,sources:[]}));
 function scan(text,owner,name,target='documented'){
  const prose=textOnly(text).replace(/&nbsp;/g,' ');
  if(!prose.trim())return;
  categories.forEach(([, ,pattern],index)=>{
   if(!pattern.test(index===0?prose.replace(/\bhealing\s+(?:rate|bonus|effectiveness|received)\b/gi,'stat'):prose))return;
   const sources=result[index].sources;
   if(!sources.some(s=>s.owner===owner&&s.name===name&&s.target===target))sources.push({owner,name,target});
  });
 }
 for(const row of collectTeamEffects(context,plan,builds)){
  const effect=context.effects[row.id];
  for(const source of row.sources)scan([effect.name,...effectDescriptions(effect)].join(' '),source.owner,isStarSkill(source.skill)?'Star Level'+(source.star?' '+source.star:''):source.name,row.target);
 }
 for(const id of new Set([...plan.team,plan.support].filter(Boolean))){
  const character=context.character(id),definitions=context.skills(id),stars=plan.stars?.[id]??builds[id]?.stars??0;
  const loadout=id===plan.support?{technical:plan.loadouts[id]?.technical||[]}:plan.loadouts[id];
  const keys=new Set([...selectedSkills(loadout),...Object.keys(characterSkillDefinitions(definitions,character)).filter(isStarSkill)]);
  for(const key of keys)for(const row of skillParagraphsWithStars(definitions[key])){
   if(isStarSkill(key)&&row.star>stars)continue;
   // Standalone effect definitions are handled above with their actual recipient.
   if(/^\s*\{\{effect:[^}]+\}\}\s*$/.test(row.text))continue;
   scan(row.text,id,isStarSkill(key)?'Star Level'+(row.star?' '+row.star:''):definitions[key]?.name||key);
  }
  const gear=plan.equipment[id]||{},counts={};for(const key of gear.artifacts||[])if(key)counts[key]=(counts[key]||0)+1;
  for(const [category,key,count] of [['weapons',gear.weapon],['accessories',gear.accessory],...Object.entries(counts).map(([key,count])=>['artifacts',key,count])]){
   const item=context.catalogs[category]?.[key];if(!item)continue;
   for(const section of equipmentSections({...item,set_bonuses:item.set_bonuses?.filter(b=>b.pieces<=count)}))for(const text of section.paragraphs||[])if(!/^\s*\{\{effect:[^}]+\}\}\s*$/.test(text))scan(text,id,item.name);
  }
 }
 if(plan.resonance){const {id,skill}=plan.resonance;for(const row of skillParagraphsWithStars(context.skills(id)[skill]))if(!/^\s*\{\{effect:[^}]+\}\}\s*$/.test(row.text))scan(row.text,id,context.skills(id)[skill]?.name||skill);}
 return result;
}
export function teamCoverage(context,plan,builds){
 const categories=analyzeTeamCoverage(context,plan,builds),covered=categories.filter(category=>category.sources.length),missing=categories.filter(category=>!category.sources.length);
 const panel=el('section',{class:'team-coverage','aria-label':'Team Coverage'}),heading=el('div',{class:'coverage-heading'});
 heading.append(el('h2',{},'Team Coverage'),el('span',{class:'coverage-count'},covered.length+' / '+categories.length+' Covered'));
 panel.append(heading);
 const list=el('dl',{class:'coverage-list'});
 for(const category of covered){
  const row=el('div',{class:'coverage-row'}),label=el('dt',{},category.label),description=el('dd');
  const owners=new Map();
  for(const source of category.sources){
   if(!owners.has(source.owner))owners.set(source.owner,new Map());
   const names=owners.get(source.owner);
   if(!names.has(source.name))names.set(source.name,new Set());
   if(source.target!=='documented')names.get(source.name).add(({self:'Self',allies:'Allies',enemies:'Opponents',unconfirmed:'Target Unspecified'})[source.target]||source.target);
  }
  for(const [owner,names] of owners){
   const entry=el('span',{class:'coverage-provider'}),character=context.character(owner);
   entry.append(el('span',{class:'coverage-owner'},character.nickname||character.name||owner),document.createTextNode(' · '));
   entry.append(el('span',{class:'coverage-sources'},[...names].map(([name,targets])=>name+(targets.size?' ('+[...targets].join(', ')+')':'')).join(', ')));
   description.append(entry);
  }
  row.append(label,description);list.append(row);
 }
 panel.append(list);
 if(missing.length){const gaps=el('p',{class:'coverage-gaps'});gaps.append(el('span',{},'Not Detected: '),document.createTextNode(missing.map(category=>category.label).join(' · ')));panel.append(gaps);}
 panel.append(el('p',{class:'coverage-note'},'Based on the selected kit. Conditional abilities count; coverage does not measure strength or uptime.'));
 return panel;
}
