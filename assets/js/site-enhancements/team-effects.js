import {el} from './core.js';
import {effectReferences} from './character-build-model.js';
import {equipmentSections} from './equipment-catalog.js';

export function collectTeamEffects(context, plan, builds = {}) {
  const rows = new Map();
  function add(record, owner, source, href) {
    const key = record.target + ':' + record.id;
    if (!rows.has(key)) rows.set(key, {...record, sources:[]});
    const sources = rows.get(key).sources;
    for (const entry of record.sources) {
      const item = {owner, ...entry, ...(source ? {name:source,href} : {})};
      if (!sources.some(s => s.owner === item.owner && s.skill === item.skill && s.star === item.star && s.name === item.name)) sources.push(item);
    }
  }
  for (const id of [...new Set([...plan.team, plan.support].filter(Boolean))]) {
    const character = context.character(id), definitions = context.skills(id);
    const loadout = id === plan.support ? {technical:plan.loadouts[id]?.technical || []} : plan.loadouts[id];
    for (const row of effectReferences(character, definitions, context.effects, loadout, builds[id]?.stars ?? 16)) add(row,id);
    const gear = plan.equipment[id] || {};
    const items = [['weapons',gear.weapon],['accessories',gear.accessory],...Object.entries((gear.artifacts||[]).reduce((a,k)=>(k&&(a[k]=(a[k]||0)+1),a),{})).map(([k,n])=>['artifacts',k,n])];
    for (const [category,key,count] of items) {
      const item = context.catalogs[category]?.[key];
      if (!item) continue;
      const sections = equipmentSections({...item,set_bonuses:item.set_bonuses?.filter(b=>b.pieces<=count)});
      const description = sections.flatMap(s=>s.paragraphs||[]).join(' ');
      for (const row of effectReferences({}, {equipment:{name:item.name,description}}, context.effects, {basic:['equipment']})) add(row,id,item.name,'/webpages/game-codex.html#'+({weapons:'weapon',accessories:'accessory',artifacts:'artifact'}[category])+'-'+key);
    }
  }
  if (plan.resonance) {
    const {id,skill} = plan.resonance;
    for (const row of effectReferences(context.character(id),{[skill]:context.skills(id)[skill]},context.effects,{technical:[skill]})) add(row,id);
  }
  return [...rows.values()];
}
export function teamEffects(context, plan, builds) {
  const panel = el('section',{class:'character-builds team-effects'});
  panel.append(el('h2',{},'Team Effects'));
  const rows = collectTeamEffects(context,plan,builds);
  for (const [target,label] of [['self','Self'],['allies','Allies'],['enemies','Opponents'],['unconfirmed','Other / target unspecified']]) {
    const entries=rows.filter(row=>row.target===target);
    if (!entries.length) continue;
    const group=el('section');group.append(el('h3',{},label));
    const paragraph=el('p',{class:'team-effect-list'});
    entries.forEach((row,index) => {
      if(index) paragraph.append(document.createTextNode(', '));
      const effect=context.effects[row.id],link=el('a',{href:'/webpages/game-codex.html#'+encodeURIComponent(row.id)});
      link.append(el('b',{class:effect.class||row.id},'['+effect.name+']'));
      paragraph.append(link);
    });
    group.append(paragraph);
    panel.append(group);
  }
  if(!rows.length)panel.append(el('p',{class:'build-muted'},'Select team skills to see their documented effects.'));
  return panel;
}
