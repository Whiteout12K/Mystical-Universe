import {el} from './core.js';
import {skillGroups, availableSkills, loadoutLimits, normalizeLoadout, legalEquipment} from './character-build-model.js';

export function gameSkillURL(id, skill) { return '/webpages/game-c.html?' + new URLSearchParams(skill.startsWith('tree-')?{char:id,view:'tree',node:skill.slice(5)}:{char:id,skill}); }
function skillIconButton(character, definitions, key, caption) {
        const title = key ? (definitions[key] ? definitions[key].name || key : key + ' · Details pending') : 'Unselected';
        const button = el('button', {type: 'button', class: 'build-skill-choice', title, 'aria-label': caption || title});
        if (key && character.skills_path) {
          const image = el('img', {src: /^Dupes/i.test(key) ? '/images/mlg-assets/Stars/dupe.svg' : character.skills_path + '/skill_b/' + key.split('-')[0].toLowerCase() + '.svg', alt: '', loading: 'lazy'});
          image.addEventListener('error', () => { image.remove(); button.append(el('span', {}, key)); }, {once: true});
          button.append(image);
        } else button.append(el('span', {}, key || '+'));
        return button;
      }
export function loadoutControls(character, definitions, loadout, onChange, {support = false} = {}) {
  const host = el('div', {class: 'build-skill-controls'}), limits = loadoutLimits(character);
  if (character.skill_variants?.length) {
    const label=el('label',{},'Character variant'),select=el('select',{'aria-label':character.name+' variant'});
    character.skill_variants.forEach((variant,index)=>select.append(el('option',{value:index},variant.name||variant.nickname)));
    select.value=loadout.variant||0;
    select.addEventListener('change',()=>onChange(normalizeLoadout({variant:Number(select.value)},character,definitions)));
    label.append(select);host.append(label);
  }
  for (const group of skillGroups) {
    const options = availableSkills(character, definitions, group.prefix, loadout.variant);
    for (let index = 0; index < limits[group.key]; index++) {
      const unavailable = support && group.key !== 'technical';
      const wrapper = el('fieldset', {class: 'build-skill-picker' + (unavailable ? ' build-skill-unavailable' : '')});
      wrapper.disabled = unavailable;
      if(unavailable) wrapper.title = 'Support characters cannot use this skill type.';
      const label = group.label + (limits[group.key] > 1 ? ' ' + (index + 1) : '');
      const pickerId = 'build-picker-' + character.id + '-' + group.key + '-' + index;
      wrapper.append(el('legend', {}, label));

      const selected = loadout[group.key][index] || '';
      const trigger = skillIconButton(character, definitions, selected, 'Choose ' + character.name + ' ' + label);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', pickerId);
      const menu = el('div', {id: pickerId, class: 'build-skill-options', role: 'group', 'aria-label': character.name + ' ' + label + ' choices', hidden: ''});
      for (const key of options) {
        const option = skillIconButton(character, definitions, key);
        option.setAttribute('aria-pressed', String(key === selected));
        option.disabled = loadout[group.key].some((chosen, slot) => slot !== index && chosen === key);
        option.addEventListener('click', () => {
          const next = structuredClone(loadout);
          next[group.key][index] = key;
          onChange(normalizeLoadout(next, character, definitions));
        });
        menu.append(option);
      }
      const clear = el('button', {type: 'button', class: 'build-skill-clear'}, 'Clear');
      clear.addEventListener('click', () => {
        const next = structuredClone(loadout);next[group.key][index] = '';
        onChange(normalizeLoadout(next, character, definitions));
      });
      menu.append(clear);
      trigger.addEventListener('click', () => {
        const open = menu.hidden;
        host.querySelectorAll('.build-skill-options').forEach(node => { node.hidden = true; });
        host.querySelectorAll('[aria-expanded]').forEach(node => node.setAttribute('aria-expanded', 'false'));
        menu.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
      });
      menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }
      });
      wrapper.append(trigger, menu);
      host.append(wrapper);
    }
  }
  return host;
}
export function equipmentControls(context, id, gear, onChange) {
  const character = context.character(id), host = el('div', {class: 'build-equipment-controls'});
  for (const [category, label, field] of [['weapons', 'Weapon', 'weapon'], ['accessories', 'Accessory', 'accessory'], ['artifacts', 'Artifact set', 'artifacts']]) {
    const wrapper = el('label', {}, label), select = el('select', {'aria-label': character.name + ' ' + label});
    select.append(el('option', {value: ''}, category === 'artifacts' ? 'No full set / mixed pieces' : 'None'));
    for (const [key, item] of Object.entries(context.catalogs[category])) if (legalEquipment(character, item)) select.append(el('option', {value: key}, item.name));
    select.value = category === 'artifacts' ? (gear.artifacts?.every(key => key === gear.artifacts[0]) ? gear.artifacts[0] : '') : gear[field] || '';
    select.addEventListener('change', () => {
      const next = structuredClone(gear);
      next[field] = category === 'artifacts' ? Array(4).fill(select.value) : select.value;
      onChange(next);
    });
    wrapper.append(select);
    host.append(wrapper);
  }
  return host;
}
