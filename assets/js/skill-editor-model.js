// Skill documents keep the same keys and nested objects as the character files.
export const clone = value => structuredClone(value);
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateDocument(value) {
  if (!isObject(value)) throw Error('Use a character JSON object containing skill IDs such as B1, S1, T1, and Dupes.');
  for (const [id, skill] of Object.entries(value)) {
    if (!isObject(skill)) throw Error(`${id} must be a skill object.`);
    for (const key of ['name', 'type', 'description']) {
      if (skill[key] !== undefined && typeof skill[key] !== 'string') throw Error(`${id}.${key} must be text.`);
    }
    if (skill.description_style !== undefined && !isObject(skill.description_style)) throw Error(`${id}.description_style must be a style object.`);
    for (const key of ['stages', 'additional']) {
      if (skill[key] === undefined) continue;
      if (!Array.isArray(skill[key])) throw Error(`${id}.${key} must be a list.`);
      for (const entry of skill[key]) {
        if (typeof entry !== 'string' && !isObject(entry)) throw Error(`${id}.${key} entries must be text or objects.`);
        if (isObject(entry)) {
          for (const field of ['name', 'text', 'description']) if (entry[field] !== undefined && typeof entry[field] !== 'string') throw Error(`${id}.${key}.${field} must be text.`);
          if (entry.style !== undefined && !isObject(entry.style)) throw Error(`${id}.${key}.style must be an object.`);
        }
        if (isObject(entry) && entry.level !== undefined && (!Number.isInteger(Number(entry.level)) || Number(entry.level) < 1 || Number(entry.level) > 16)) throw Error(`${id} star levels must be integers from 1 to 16.`);
      }
    }
    if (skill.star_tiers !== undefined) {
      if (!Array.isArray(skill.star_tiers)) throw Error(`${id}.star_tiers must be a list.`);
      for (const tier of skill.star_tiers) {
        if (!isObject(tier) || !Array.isArray(tier.stars)) throw Error(`${id} named tiers must contain a stars list.`);
        for (const star of tier.stars) if (!isObject(star) || typeof star.text !== 'string') throw Error(`${id} tier stars must contain text.`);
      }
    }
    if (skill.base_damage !== undefined) {
      if (!isObject(skill.base_damage) || Object.values(skill.base_damage).some(n => typeof n !== 'number' || !Number.isFinite(n))) throw Error(`${id}.base_damage must contain numeric values.`);
    }
    if (skill.max_level !== undefined && (!Number.isInteger(skill.max_level) || skill.max_level < 1)) throw Error(`${id}.max_level must be a positive integer.`);
    if (skill.level_multiplier !== undefined && (typeof skill.level_multiplier !== 'number' || !Number.isFinite(skill.level_multiplier))) throw Error(`${id}.level_multiplier must be a number, such as 0.1 for 10% per level.`);
  }
  return value;
}
export function parseDocument(text) { return validateDocument(JSON.parse(text)); }
export function skillWarnings(document, effects) {
  const warnings = [];
  for (const [id, skill] of Object.entries(document)) {
    const text = JSON.stringify(skill);
    for (const match of text.matchAll(/\{\{effect:([^}]+)\}\}/g)) {
      if (!Object.hasOwn(effects, match[1].trim())) warnings.push(`${id}: effect “${match[1]}” is missing from the effect list.`);
    }
    // JSON encoding escapes the quotes around HTML attributes.
    for (const match of text.matchAll(/data-dmg=\\?["']([^"'\\]+)\\?["']/g)) {
      if (!Object.hasOwn(skill.base_damage || {}, match[1])) warnings.push(`${id}: dynamic value “${match[1]}” needs a base value.`);
    }
  }
  return [...new Set(warnings)];
}
// Match the authored C5–C11 layout: inline styles, compact paragraph objects,
// and a blank line between skills and numbered Star Level groups.
export function serializeDocument(document) {
  const data=validateDocument(document),pad=depth=>' '.repeat(depth);
  // Render scalar maps explicitly so punctuation inside HTML/string values is untouched.
  const style=value=>'{'+Object.entries(value).map(([key,item])=>JSON.stringify(key)+': '+JSON.stringify(item)).join(', ')+'}';
  function valueText(value,depth,key=''){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(!Array.isArray(value)&&/(?:^|_)style$/.test(key)&&Object.values(value).every(item=>item===null||typeof item!=='object'))return style(value);
    if(Array.isArray(value)){
      if(!value.length)return '[]';
      const paragraphs=key==='stages'||key==='additional';
      const lines=value.map((item,index)=>{
        const gap=paragraphs&&index>0&&item&&typeof item==='object'&&item.level!==undefined?'\n':'';
        if(paragraphs&&isObject(item)){
          const fields=Object.entries(item);
          if(!fields.length)return gap+pad(depth+2)+'{}';
          return gap+pad(depth+2)+'{'+fields.map(([name,entry],i)=>(i?'\n'+pad(depth+4):'')+JSON.stringify(name)+': '+valueText(entry,depth+4,name)+(i<fields.length-1?',':'')).join('')+'}';
        }
        return gap+pad(depth+2)+valueText(item,depth+2);
      });
      return '[\n'+lines.join(',\n')+'\n'+pad(depth)+']';
    }
    const entries=Object.entries(value);
    if(!entries.length)return '{}';
    return '{\n'+entries.map(([name,entry])=>pad(depth+2)+JSON.stringify(name)+': '+valueText(entry,depth+2,name)).join(',\n')+'\n'+pad(depth)+'}';
  }
  const skills=Object.entries(data);
  if(!skills.length)return '{}\n';
  return '{\n\n'+skills.map(([id,skill])=>'  '+JSON.stringify(id)+': '+valueText(skill,2)).join(',\n\n')+'\n\n}\n';
}

// Display groups preserve the flat authored array and its original indices.
export function groupSkillParagraphs(entries = []) {
  const groups=[];
  for(const [index,entry] of entries.entries()){
    const level=typeof entry==='object'&&entry!==null&&entry.level!==undefined?Number(entry.level):null;
    if(!groups.length||level!==null&&groups.at(-1).level!==level)groups.push({level,entries:[]});
    groups.at(-1).entries.push({entry,index});
  }
  return groups;
}
