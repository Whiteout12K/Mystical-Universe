import {el,link,json,normalize,rich,status,flagsReady} from './core.js';
import {categories,equipmentAnchor,equipmentSections,equipmentImage,equipmentPieces,catalogueSearchText,rarityClass,elementClasses,effectDescriptions,equipmentEffectDefinition} from './equipment-catalog.js';
const host=document.getElementById('ml-game-codex');
const names={effects:'Effects',weapons:'Weapons',accessories:'Accessories',artifacts:'Artifact sets'};
if(host)await start();
async function start(){
 try{
 const [effects,weapons,accessories,artifacts,rules,flags]=await Promise.all([
  json('/images/mlg-assets/data-effects.json'),json('/images/mlg-assets/data-weapon.json'),json('/images/mlg-assets/data-accessory.json'),json('/images/mlg-assets/data-artifact.json'),json('/images/mlg-assets/equipment-rules.json'),flagsReady]);
 const catalogs={effects,weapons,accessories,artifacts},effectNames=new Map(Object.entries(effects).map(([id,e])=>[normalize(e.name),id]));
 let category=flags.effectsGlossary===false?'weapons':'effects';
 const requested=new URLSearchParams(location.search).get('category');if(categories.includes(requested))category=requested;if(category==='effects'&&flags.effectsGlossary===false)category='weapons';
 const tabs=el('nav',{class:'codex-tabs','aria-label':'Codex sections'});
 for(const key of categories){const button=el('button',{type:'button','data-category':key,'aria-pressed':String(key===category)},names[key]);if(key==='effects'&&flags.effectsGlossary===false)button.disabled=true;button.append(el('span',{class:'codex-tab-count'},String(Object.keys(catalogs[key]).length)));tabs.append(button);}
 const controls=el('div',{class:'codex-controls'}),input=el('input',{type:'search',id:'codex-search',placeholder:'Search names, stats, bonuses, or descriptions…'}),type=el('select',{id:'codex-type'}),rarity=el('select',{id:'codex-rarity'});
 for(const [control,label]of [[input,'Search this section'],[type,'Type'],[rarity,'Rarity']]){const wrap=el('div');wrap.append(el('label',{for:control.id},label),control);controls.append(wrap);}
 const message=el('p',{role:'status',class:'ml-muted codex-results'}),ruleHost=el('div',{class:'codex-rule-host'}),grid=el('div',{class:'ml-effect-grid codex-grid'});
 host.replaceChildren(tabs,controls,message,ruleHost,grid);
 function formatted(value,autoValues=true){
  const fragment=rich(value),walker=document.createTreeWalker(fragment,NodeFilter.SHOW_TEXT),texts=[];while(walker.nextNode())texts.push(walker.currentNode);
  for(const text of texts){const replacement=document.createDocumentFragment();for(const part of text.textContent.split(/(\{\{effect:[^}]+\}\}|\[[^\]\n]+\]|[+−-]?\d+(?:\.\d+)?%?)/g)){
   const token=part.match(/^\{\{effect:([^}]+)\}\}$/),bracket=part.match(/^\[([^\]]+)\]$/),id=token?.[1]||(bracket&&effectNames.get(normalize(bracket[1])));
   if(id&&effects[id]){const effect=effects[id],a=el('a',{href:'#'+id,class:'ml-effect-reference'}),label=el('b',{class:effect.class||id},part.startsWith('{{')?effect.name:part);a.append(label);replacement.append(a);}
   else if(bracket&&elementClasses[normalize(bracket[1])])replacement.append(el('b',{class:elementClasses[normalize(bracket[1])]},part));
   else if(autoValues&&/^[+−-]?\d+(?:\.\d+)?%?$/.test(part)&&!text.parentElement?.closest('b,strong'))replacement.append(el('b',{class:'codex-value'},part));
   else replacement.append(document.createTextNode(part));
  }text.replaceWith(replacement);}
  return fragment;
 }
 function imageFrame(path,cls='codex-art'){const frame=el('div',{class:cls});if(path){const image=el('img',{src:path,alt:'',loading:'lazy'});image.addEventListener('error',()=>image.remove(),{once:true});frame.append(image);}else frame.setAttribute('aria-hidden','true');return frame;}
 function rulesPanel(){ruleHost.replaceChildren();if(category==='effects')return;const record=rules[category];if(!record)return;const details=el('details',{class:'codex-rules'});details.append(el('summary',{},record.title));const body=el('div',{class:'codex-rule-body'});let list=null;for(const paragraph of record.paragraphs){if(paragraph.startsWith('* ')){if(!list){list=el('ul');body.append(list);}list.append(el('li',{},paragraph.slice(2)));}else{list=null;body.append(el('p',{},paragraph));}}details.append(body);ruleHost.append(details);}
 function filters(){const values=category==='effects'?Object.values(effects).map(e=>e.type):category==='weapons'?Object.values(weapons).map(e=>e.weapon_type):[];type.replaceChildren(el('option',{value:''},'All types'));for(const value of [...new Set(values.filter(Boolean))].sort())type.append(el('option',{value},value));type.parentElement.hidden=!values.length;rarity.replaceChildren(el('option',{value:''},'All rarities'));for(const value of ['SSR','SR','R','UR','LR'])if(Object.values(catalogs[category]).some(e=>(e.rarities||[e.rarity]).includes(value)))rarity.append(el('option',{value},value));rarity.parentElement.hidden=category==='effects';}
 function effectCard(id,item,embedded=false){
 if(embedded){
  const row=el('div',{class:'codex-embedded-effect','data-effect':id}),copy=el('div',{class:'codex-effect-text'}),name=link('','#'+id);
  name.className='ml-effect-reference';name.append(el('b',{class:item.class||id},'['+item.name+']'));copy.append(name);
  effectDescriptions(item).forEach((text,index)=>{const paragraph=el('div',{class:'codex-skill-copy'});if(index===0)paragraph.append(el('span',{class:String(item.type).toLowerCase()==='buff'?'buff':'debuff'},item.type||'Mechanic'),': ');paragraph.append(formatted(text,false));copy.append(paragraph);});
  row.append(imageFrame(item.icon,'codex-effect-art'),copy);return row;
 }
 const card=el(embedded?'section':'article',{class:embedded?'codex-embedded-effect':'ml-effect-card',...(embedded?{'data-effect':id}:{id})}),heading=el(embedded?'h4':'h2'),label=link(item.name,'#'+id);
 label.className=item.class||id;heading.append(imageFrame(item.icon,'codex-effect-art'),label);card.append(heading,el('p',{class:'ml-muted codex-effect-type'},item.type||'Mechanic'));
 for(const text of effectDescriptions(item)){const p=el('p',{class:'codex-skill-copy'});p.append(formatted(text,!embedded));card.append(p);}
 if(!embedded)card.append(link('Open effect details','/ml-game/apps/effect.html?effect='+encodeURIComponent(id)));return card;
 }
 function gearCard(id,item){const anchor=equipmentAnchor(category,id),card=el('article',{class:'ml-effect-card codex-equipment',id:anchor}),header=el('div',{class:'codex-card-header'}),heading=el('h2');heading.append(link(item.name,'#'+anchor));const rarityLine=el('span',{class:'codex-category'}),rarities=(item.rarities||[item.rarity]).filter(Boolean);rarities.forEach((r,index)=>{if(index)rarityLine.append(' / ');rarityLine.append(el('span',{class:'codex-rarity '+rarityClass(r)},r));});rarityLine.append(' · '+(item.weapon_type||item.type));header.append(rarityLine,heading);
 const content=el('div',{class:'codex-equipment-body'}),tone=rarityClass(item.rarity);if(category!=='artifacts'&&tone){card.classList.add('codex-rarity-card');card.append(el('span',{class:'codex-rarity-wash rarity-'+tone,'aria-hidden':'true'}));}card.append(content);content.append(header);
 if(category!=='artifacts')content.append(imageFrame(equipmentImage(item)));
 else if(equipmentImage(item))content.append(imageFrame(equipmentImage(item)));
 if(item.restriction)content.append(el('p',{class:'codex-restriction'},item.restriction));
 if(item.seal_ring_name)content.append(el('p',{class:'codex-seal'},'Seal Ring — '+item.seal_ring_name));
 if(item.reference_stats?.length){const table=el('table',{class:'codex-stat-table'}),caption=el('caption',{},'Equipment stats');table.append(caption);const head=el('thead'),row=el('tr');for(const text of ['Stat','Level 1','Level 100'])row.append(el('th',{scope:'col'},text));head.append(row);table.append(head);const body=el('tbody');for(const stat of item.reference_stats){const tr=el('tr');tr.append(el('th',{scope:'row'},stat.name));for(const key of ['level_1','level_100'])tr.append(el('td',{},'+'+stat[key].toLocaleString()+stat.unit));body.append(tr);}table.append(body);content.append(table);}
 if(category==='artifacts'){const pieces=el('div',{class:'codex-pieces','aria-label':'Set pieces'});for(const piece of equipmentPieces(item)){const row=el('div',{class:'codex-piece'}),copy=el('div');copy.append(el('span',{class:'codex-piece-slot'},piece.slot),el('span',{class:'codex-piece-name'},piece.name||'Name not specified'));row.append(imageFrame(piece.image,'codex-piece-art'),copy);pieces.append(row);}content.append(pieces);}
 for(const section of equipmentSections(item)){const group=el('section',{class:'codex-item-section'});const title=el('h3',{class:'codex-skill-title'}),split=section.title.match(/^Weapon Skill:\s*(.+)$/);if(split){title.append(el('span',{class:'skill-type'},'Weapon Skill'),el('span',{class:'skill-name'},split[1]));}else title.textContent=section.title;group.append(title);if(!section.paragraphs.length||(section.title==='Weapon Skill'&&section.paragraphs.every(p=>/^(Cooldown|Energy Gauge):/.test(p))))group.append(el('p',{class:'ml-muted'},'Details have not been specified yet.'));for(const text of section.paragraphs){const definition=equipmentEffectDefinition(text,effects);if(definition){group.append(effectCard(definition.id,definition.effect,true));continue;}const p=el('p',{class:'codex-skill-copy'+(/^(?:Cooldown|Energy Gauge|Mana Cost|>)/.test(text)?' skill-meta':'')});p.append(formatted(text,false));group.append(p);}content.append(group);}
 for(const text of item.reference_notes||[])content.append(el('p',{class:'codex-source-detail'},text));return card;}
 function render(){grid.replaceChildren();const query=normalize(input.value);let count=0;for(const [id,item]of Object.entries(catalogs[category]).sort(([,a],[,b])=>a.name.localeCompare(b.name))){const description=category==='effects'?effectDescriptions(item).join(' '):catalogueSearchText(item);const itemType=category==='effects'?item.type:item.weapon_type;if(type.value&&itemType!==type.value||rarity.value&&!(item.rarities||[item.rarity]).includes(rarity.value)||!normalize(item.name+' '+id+' '+description).includes(query))continue;grid.append(category==='effects'?effectCard(id,item):gearCard(id,item));count++;}const unit={effects:count===1?'effect':'effects',weapons:count===1?'weapon':'weapons',accessories:count===1?'accessory':'accessories',artifacts:count===1?'artifact set':'artifact sets'}[category];message.textContent=count+' '+unit+(count?'':' — try a different search');}
 function switchCategory(next,{clear=true}={}){if(next==='effects'&&flags.effectsGlossary===false)return;category=next;controls.dataset.category=next;grid.dataset.category=next;if(clear)input.value='';tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));filters();rulesPanel();render();}
 function revealHash(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!id)return;let targetCategory=effects[id]?'effects':null;for(const key of categories.slice(1))if(Object.keys(catalogs[key]).some(k=>equipmentAnchor(key,k)===id))targetCategory=key;if(!targetCategory)return;switchCategory(targetCategory);requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'start'}));}
 tabs.addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(!button||button.disabled)return;switchCategory(button.dataset.category);history.replaceState(null,'',location.pathname+'?category='+category);});
 for(const control of [input,type,rarity])control.addEventListener(control===input?'input':'change',render);window.addEventListener('hashchange',revealHash);switchCategory(category);if(location.hash)requestAnimationFrame(revealHash);
 }catch(error){console.error(error);status(host,'The codex could not load. Refresh to try again.');}
}
