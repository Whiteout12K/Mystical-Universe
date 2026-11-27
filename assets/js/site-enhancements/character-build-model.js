export const skillGroups = [
  {key: 'basic', prefix: 'B', label: 'Basic', count: 1},
  {key: 'special', prefix: 'S', label: 'Special', count: 2},
  {key: 'ultimate', prefix: 'U', label: 'Ultimate', count: 1},
  {key: 'technical', prefix: 'T', label: 'Technical', count: 1}
];
export const textOnly = value => String(value || '').replace(/<[^>]*>/g, '').replace(/\{\{effect:([^}]+)\}\}/g, (_, id) => '[' + id.replaceAll('-', ' ') + ']');
const nameKey = value => textOnly(value).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function availableSkills(character, definitions, prefix, variant = 0) {
  const listed = Array.isArray(character?.skills) ? character.skills : Object.keys(definitions || {});
  const overrides = character?.skill_variants?.[variant]?.skill_overrides || character?.skill_overrides || {};
  return [...new Set(listed.map(id => overrides[id] || id))].filter(id => new RegExp('^' + prefix + '\\d+', 'i').test(id));
}
export function loadoutLimits(character) {
  return Object.fromEntries(skillGroups.map(group => {
    const value = character?.skill_slots?.[group.key];
    return [group.key, Number.isInteger(value) && value >= 0 && value <= 12 ? value : group.count];
  }));
}
export function normalizeLoadout(input, character, definitions = {}, legacyTechnical) {
  const limits = loadoutLimits(character), result = {};
  const variant = Number.isInteger(input?.variant) && character?.skill_variants?.[input.variant] ? input.variant : 0;
  if (character?.skill_variants?.length) result.variant = variant;
  for (const group of skillGroups) {
    const available = availableSkills(character, definitions, group.prefix, variant), used = new Set();
    let requested = input?.[group.key];
    if (!Array.isArray(requested) && group.key === 'technical' && legacyTechnical) requested = [legacyTechnical];
    result[group.key] = Array.from({length: limits[group.key]}, (_, index) => {
      const candidate = Array.isArray(requested) ? requested[index] : available[index];
      const id = typeof candidate === 'string' && available.includes(candidate) && !used.has(candidate) ? candidate : '';
      if (id) used.add(id);
      return id;
    });
  }
  return result;
}
export function maxCharacterStarLevel(definitions = {}) {
  return Math.max(0,...Object.entries(definitions).filter(([key])=>/^Dupes/i.test(key)).flatMap(([,skill])=>(skill.additional||[]).map(entry=>Number(entry?.level)).filter(level=>Number.isInteger(level)&&level>0)));
}
export function selectedSkills(loadout) { return skillGroups.flatMap(group => loadout?.[group.key] || []).filter(Boolean); }
export function skillParagraphsWithStars(skill) {
  const rows = [];
  if (skill?.description) rows.push({text: skill.description, star: 0});
  for (const [key,text] of Object.entries(skill||{}).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))) if(/^description\d+$/.test(key)&&typeof text==='string')rows.push({text,star:0});
  for (const stage of skill?.stages || []) rows.push({text: stage.text || stage.description || '', star: 0});
  let star = 0;
  for (const entry of skill?.additional || []) {
    if (entry && typeof entry === 'object' && Number.isInteger(Number(entry.level))) star = Number(entry.level);
    rows.push({text: typeof entry === 'string' ? entry : entry?.text || entry?.description || '', star});
  }
  return rows;
}
// Analyze the clause around each effect separately so a self buff and an enemy
// debuff in the same paragraph do not inherit each other's recipients.
export function inferEffectTargets(text, effect, character = {}) {
  const actor = String(character.nickname || character.name || '').split(' ')[0];
  let prose = textOnly(text).replace(/&nbsp;/gi,' ').replace(/[’]/g,"'")
    .replace(/\{\{(?:nickname|name|subject|object|reflexive|possessive)(:c\d+(?::\d+)?)?\}\}/gi,(_,other)=>other?'ally':'caster');
  if(actor)prose=prose.replace(new RegExp('\\b'+actor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),'caster');
  const targets = new Set();
  const recipient = /\b(self|caster|himself|herself|themselves|themself|yourself|you|wearer|wielder|holder|equipper|user|allies|ally|teammates?|party|team|members|active character|on-field character|opponents?|enemies|enemy|foes?|targets?|attacker)\b/gi;
  const category = word => /^(?:opponent|enem|foe|target|attacker)/i.test(word)?'enemies':/^(?:allies|ally|teammate|party|team|member|active character|on-field character)/i.test(word)?'allies':'self';
  function closestGroup(value) {
    const matches=[...value.matchAll(recipient)];
    if(!matches.length)return [];
    const group=[matches.at(-1)];
    for(let i=matches.length-2;i>=0;i--){const between=value.slice(matches[i].index+matches[i][0].length,group[0].index);if(!/^[\s,]*(?:(?:and|or|both|the|other|all|nearby)[\s,]*)*$/i.test(between))break;group.unshift(matches[i]);}
    return group.map(m=>category(m[0]));
  }
  for(const match of prose.matchAll(/\[([^\]]+)\]/g)) {
    if(nameKey(match[1])!==nameKey(effect.name))continue;
    const start=match.index,end=start+match[0].length;
    const beforeAll=prose.slice(0,start),afterAll=prose.slice(end);
    const boundary=[...beforeAll.matchAll(/[.!?;](?:\s|$)/g)].at(-1);
    const before=beforeAll.slice(boundary?boundary.index+1:0);
    const after=afterAll.split(/[.!?;](?:\s|$)|\[[^\]]+\]/)[0];
    // Explicit recipients after the effect take precedence over its provider.
    const destination=after.match(/^.{0,90}?\b(?:on|to|for|among|amongst|against)\s+((?:(?:all|other|nearby|hit|trapped|the|each)\s+)*(?:self|caster|allies|ally|party|team|teammates?|members|opponents?|enemies|enemy|foes?|targets?|attacker)(?:(?:\s+and\s+|,\s*)(?:self|caster|allies|ally|party|team|opponents?|enemies))*)/i);
    if(destination){closestGroup(destination[1]).forEach(t=>targets.add(t));continue;}
    const verbs=[...before.matchAll(/\b(gain\w*|accumulat\w*|receiv\w*|obtain\w*|grant\w*|giv\w*|appl(?:y(?:ing)?|ies|ied)|inflict\w*|afflict\w*|consum\w*|clear\w*|steal\w*)\b/gi)];
    const verb=verbs.at(-1),prefix=verb?before.slice(0,verb.index).split(',').at(-1):before;
    const direct=verb?closestGroup(before.slice(verb.index+verb[0].length)):[];
    const subjects=direct.length?direct:closestGroup(prefix);
    if(verb&&/^(?:appl|inflict|afflict)/i.test(verb[0])&&/\b(?:on hit|per hit)\b/i.test(after)&&/debuff/i.test(effect.type||'')){targets.add('enemies');continue;}
    if(subjects.length){
      // "Caster inflicts [Burn]" describes an outgoing application.
      if(verb&&(/^(?:inflict|afflict)/i.test(verb[0])||/^appl/i.test(verb[0])&&/debuff/i.test(effect.type||''))&&subjects.every(t=>t==='self'))targets.add('enemies');
      else subjects.forEach(t=>targets.add(t));
    } else if(verb&&/^(?:gain|accumulat|receiv|obtain|consum|clear|steal)/i.test(verb[0]))targets.add('self');
    else if(verb&&/^(?:inflict|afflict)/i.test(verb[0]))targets.add('enemies');
    else if(/\b(?:on hit|per hit|hit opponents?|hit enemies)\b/i.test(after)&&/debuff/i.test(effect.type||''))targets.add('enemies');
    else if(/\b(?:active|present|owned|stacks?|consumed)\b/i.test(after)&&!/^\s*(?:Buff|Debuff)\s*:/i.test(after))targets.add('self');
  }
  return [...targets];
}

export function effectReferences(character, definitions, effects, loadout, stars = 16, allSkills = false) {
  const aliases = new Map(Object.entries(effects).map(([id, effect]) => [nameKey(effect.name || id), id]));
  const keys = allSkills ? Object.keys(definitions) : [...selectedSkills(loadout), ...Object.keys(definitions).filter(key => /^Dupes/i.test(key))];
  const found = new Map();
  for (const key of [...new Set(keys)]) {
    const skill = definitions[key];
    if (!skill) continue;
    for (const row of skillParagraphsWithStars(skill)) {
      if (/^Dupes/i.test(key) && row.star > stars) continue;
      const ids = new Set();
      for (const match of row.text.matchAll(/\{\{effect:([^}]+)\}\}/g)) if (Object.hasOwn(effects, match[1])) ids.add(match[1]);
      for (const match of textOnly(row.text).matchAll(/\[([^\]]+)\]/g)) { const id = aliases.get(nameKey(match[1])); if (id) ids.add(id); }
      for (const id of ids) {
        const configured = skill.effect_targets?.[id] || character.effect_targets?.[key]?.[id];
        const allowedTargets = ['self', 'allies', 'enemies'];
        let targets = [];
        if (Array.isArray(configured)) targets = configured.filter(target => allowedTargets.includes(target));
        else if (configured && typeof configured === 'object') {
          targets = Object.entries(configured)
            .filter(([target, minimum]) => allowedTargets.includes(target) && Number.isInteger(minimum) && row.star >= minimum)
            .map(([target]) => target);
        }
        if (!configured) targets = inferEffectTargets(row.text, effects[id], character);
        if (!targets.length) targets.push('unconfirmed');
        for (const target of targets) {
          const identity = id + ':' + target;
          if (!found.has(identity)) found.set(identity, {id, target, sources: []});
          const sources = found.get(identity).sources;
          if (!sources.some(source => source.skill === key && source.star === row.star)) sources.push({skill: key, star: row.star, name: skill.name || key, text: row.text});
        }
      }
    }
  }
  const records = [...found.values()], confirmed = new Set();
  const sourceKey = (id, source) => id + ':' + source.skill + ':' + source.star;
  for (const record of records) {
    if (record.target === 'unconfirmed') continue;
    for (const source of record.sources) confirmed.add(sourceKey(record.id, source));
  }
  return records.map(record => record.target !== 'unconfirmed' ? record : {
    ...record, sources: record.sources.filter(source => !confirmed.has(sourceKey(record.id, source)))
  }).filter(record => record.sources.length);
}
export function legalEquipment(character, item) {
  if (!item) return false;
  if (item.weapon_type && !character.weapon_type?.includes(item.weapon_type)) return false;
  return !item.restriction || !/angelor/i.test(item.restriction) || character.species?.includes('Angelor');
}
