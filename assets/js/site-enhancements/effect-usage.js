import {el,link} from './core.js';
import {buildCatalog} from './build-catalog.js';
import {effectReferences} from './character-build-model.js';
import {gameSkillURL} from './character-build-ui.js';
import {equipmentAnchor} from './equipment-catalog.js';
export function usedBy(effectId) {
  const details=el('details',{class:'build-used-by'});
  details.append(el('summary',{},'Used by'));
  let loaded=false,loading=false;
  details.addEventListener('toggle',async()=>{
    if(!details.open||loaded||loading)return;
    loading=true;
    details.querySelector(':scope > div')?.remove();
    const body=el('div',{role:'status'},'Finding related skills…');details.append(body);
    try{
      const context=await buildCatalog();body.replaceChildren();
      for(const [id,character]of Object.entries(context.roster)){
        if(id.startsWith('#'))continue;
        const references=effectReferences(character,context.skills(id),context.effects,null,16,true).filter(record=>record.id===effectId);
        const sources=new Map(references.flatMap(record=>record.sources).map(source=>[source.skill+':'+source.star,source]));
        for(const source of sources.values())body.append(link(character.name+' · '+(source.star?'Star '+source.star:source.name),gameSkillURL(id,source.skill)));
      }
      for(const [category,catalog]of Object.entries(context.catalogs))for(const [id,item]of Object.entries(catalog)){
        if(JSON.stringify(item).includes('{{effect:'+effectId+'}}')||JSON.stringify(item).includes('['+context.effects[effectId]?.name+']'))body.append(link(item.name,'/webpages/game-codex.html#'+equipmentAnchor(category,id)));
      }
      if(!body.childElementCount)body.textContent='No character skills or equipment reference this effect yet.';
      loaded=true;
    }catch{body.textContent='Related skills could not load. Close and reopen to retry.';}
    finally{loading=false;}
  });
  return details;
}
