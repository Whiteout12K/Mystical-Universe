import {textOnly,isStarSkill,skillParagraphsWithStars} from './character-build-model.js';
import {catalogueSearchText,effectDescriptions} from './equipment-catalog.js';
// Source-derived game records replace generated snapshots; wiki and book records
// remain supplied by the site's automatically generated publishing index.
export function liveSearchRecords(context,records){
 const result=records.filter(row=>!['Character','Skill','Effect','Weapon','Accessory','Artifact'].includes(row.type));
 const add=(type,title,path,text)=>result.push({type,title:textOnly(title),path,description:textOnly(text).slice(0,260),search:textOnly(title+' '+text)});
 for(const id of Object.keys(context.roster).filter(id=>/^c\d+[a-z]*$/i.test(id))){
  const c=context.character(id);if(!c)continue;
  const base=c.base_character||id,characterPath='/webpages/game-c.html?char='+base+(base!==id?'#'+id.slice(base.length):'');
  add('Character',c.name||id,characterPath,[c.nickname,...['affinity','role','specialty','affiliation','species','attributes'].flatMap(key=>c[key]||[])].join(' '));
  for(const [key,skill] of Object.entries(context.skills(id))){
   const title=(c.nickname||c.name||id)+' · '+(isStarSkill(key)?'Star Level':skill.name||key);
   add('Skill',title,'/webpages/apps/skill.html?'+new URLSearchParams({char:base,form:id,skill:key}),skillParagraphsWithStars(skill).map(row=>row.text).join(' '));
  }
 }
 for(const [id,effect] of Object.entries(context.effects))if(effect?.name)add('Effect',effect.name,'/webpages/game-codex.html#'+encodeURIComponent(id),effectDescriptions(effect).join(' '));
 for(const [category,type,anchor] of [['weapons','Weapon','weapon'],['accessories','Accessory','accessory'],['artifacts','Artifact','artifact']])for(const [id,item] of Object.entries(context.catalogs[category]||{}))if(item?.name)add(type,item.name,'/webpages/game-codex.html#'+anchor+'-'+id,catalogueSearchText(item,context.effects));
 return result;
}
