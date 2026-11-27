import {json, resolveCharacter} from './core.js';
let pending;
export function buildCatalog() {
  if (!pending) pending = Promise.all([
    json('/images/mlg-assets/data-character.json'), json('/data/skill-catalog.json'), json('/images/mlg-assets/data-effects.json'),
    json('/images/mlg-assets/data-weapon.json'), json('/images/mlg-assets/data-accessory.json'), json('/images/mlg-assets/data-artifact.json'), json('/data/character-build-rules.json')
  ]).then(([roster, catalog, effects, weapons, accessories, artifacts, guides]) => ({
    roster, effects, catalogs: {weapons, accessories, artifacts}, guides,
    character: id => { const character=resolveCharacter(roster,id); return character ? {...character,effect_targets:guides[id]?.effect_targets||character.effect_targets} : null; },
    skills: id => catalog.sources[roster[id]?.base_character || id] || {}
  })).catch(error => { pending = null; throw error; });
  return pending;
}

// Refresh authored skill data when opening Used by; never require an index rebuild
// for skill renames, descriptions, effect references, or star-level edits.
let refreshingSkills;
export function refreshBuildSkills(context) {
  if(refreshingSkills)return refreshingSkills;
  const sources=[...new Set(Object.keys(context.roster).filter(id=>!id.startsWith('#')&&Object.keys(context.skills(id)).length).map(id=>context.roster[id]?.base_character||id))];
  refreshingSkills=Promise.all(sources.map(async id=>{
    const path=context.character(id)?.skills_path||'/images/mlg-assets/Characters/'+id.toUpperCase();
    const response=await fetch(path+(id==='c4'?'/skill-tree.json':'/'+id+'.json'),{cache:'no-cache'});
    if(response.status===404)return [id,{}];
    if(!response.ok)throw Error('Skill data could not refresh.');
    const data=await response.json();
    return [id,id==='c4'?Object.fromEntries(Object.entries(data.nodes||{}).map(([key,node])=>['tree-'+key,node])):data];
  })).then(entries=>{
    const live=Object.fromEntries(entries);
    return {...context,skills:id=>live[context.roster[id]?.base_character||id]||{}};
  }).finally(()=>{refreshingSkills=null;});
  return refreshingSkills;
}
