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
