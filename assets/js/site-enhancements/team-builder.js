import {teamEffects} from './team-effects.js';
import {loadCharacterBuild,saveCharacterBuild} from './character-build-storage.js';
import {el,link} from './core.js';
import {normalizePlan,planHash,parsePlanHash,parseTeamLink} from './team-builder-model.js';
import {buildCatalog} from './build-catalog.js';
import {loadoutControls,equipmentControls} from './character-build-ui.js';
const DRAFT='ml-team-draft-v1';
export async function setupTeamBuilder(api){
 const roster=api.roster,context=await buildCatalog(),catalogues=context.catalogs,skillData=Object.fromEntries(Object.keys(roster).map(id=>[id,context.skills(id)]));
 const profileBuilds=Object.fromEntries(await Promise.all(Object.keys(roster).filter(id=>/^c\d+$/.test(id)).map(async id=>[id,await loadCharacterBuild(id)])));
 let equipmentAvailable=true,storageWarning='',equipment={},technical={},loadouts={},loading=true;
 const root=el('section',{class:'builder-planning','aria-label':'Team planning'}),toolbar=el('section',{class:'plan-toolbar','aria-label':'Share team'}),notice=el('p',{class:'plan-message',role:'status'}),overview=el('section',{class:'plan-section plan-overview'});
 root.append(notice,overview);document.querySelector('#abilities').after(root);document.querySelector('.builder-header').append(toolbar);
 const shareButton=el('button',{type:'button'},'Copy team link'),shareField=el('input',{id:'team-share-link',readonly:'',hidden:'','aria-label':'Team share link'});const importForm=el('form',{class:'team-link-import','aria-label':'Load shared team'}),pasteField=el('input',{type:'text',id:'paste-team-link',placeholder:'Paste team link','aria-label':'Paste team link',autocomplete:'off',spellcheck:'false'}),loadButton=el('button',{type:'submit'},'Load');
 importForm.append(pasteField,loadButton);toolbar.append(shareButton,importForm,shareField);shareButton.disabled=!equipmentAvailable;
 importForm.addEventListener('submit',event=>{event.preventDefault();try{const plan=parseTeamLink(pasteField.value);apply(plan);pasteField.value='';pasteField.removeAttribute('aria-invalid');message('Team loaded with selected skills and equipment.');}catch(error){pasteField.setAttribute('aria-invalid','true');message(error.message);}});

 function message(text){notice.textContent=text;}
 function safeRead(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{storageWarning='Your previous draft could not be loaded. You can still copy a team link.';return fallback;}}
 function saveStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{message('This browser could not save the team. Copy a team link to keep your selections.');return false;}}
 function persistBuild(id,plan){profileBuilds[id]={...profileBuilds[id],loadout:plan.loadouts[id],gear:plan.equipment[id]};saveCharacterBuild(id,{loadout:plan.loadouts[id],gear:plan.equipment[id]}).then(message).catch(()=>message('Build could not be saved.'));}
 function state(){const current=api.getState();for(const id of [...current.team,current.support].filter(Boolean)){if(!loadouts[id]&&profileBuilds[id]?.loadout)loadouts[id]=profileBuilds[id].loadout;if(!equipment[id]&&profileBuilds[id]?.gear)equipment[id]=profileBuilds[id].gear;}return normalizePlan({...current,equipment,technical,loadouts},roster,catalogues,skillData);}
 function apply(raw){const defaults={loadouts:{},equipment:{}};for(const id of [...(raw.team||[]),raw.support].filter(Boolean)){if(profileBuilds[id]?.loadout)defaults.loadouts[id]=profileBuilds[id].loadout;if(profileBuilds[id]?.gear)defaults.equipment[id]=profileBuilds[id].gear;}const plan=normalizePlan({...raw,loadouts:{...defaults.loadouts,...raw.loadouts},equipment:{...defaults.equipment,...raw.equipment}},roster,catalogues,skillData);equipment=plan.equipment;technical=plan.technical;loadouts=plan.loadouts;api.setState(plan);if(location.hash.startsWith('#team='))history.replaceState(null,'',location.pathname+location.search+planHash(plan));document.querySelector('#team-select').value='';api.refresh();}
 shareButton.addEventListener('click',async()=>{const url=new URL(location.href);url.hash=planHash(state());shareField.value=url.href;shareField.hidden=false;try{await navigator.clipboard.writeText(url.href);message('Team link copied with characters, skill loadouts, equipment, support, and Resonance.');}catch{shareField.focus();shareField.select();message('Copy the selected link to share this team.');}});
 const picker=document.querySelector('#character-picker'),pickerTop=document.querySelector('.picker-top'),mini=el('div',{class:'picker-current-team','aria-label':'Current team'}),search=el('input',{type:'search',id:'team-character-search',placeholder:'Search name, element, role…','aria-label':'Search characters'});
 pickerTop.after(mini,search);search.addEventListener('input',filterPicker);
 function filterPicker(){const query=search.value.trim().toLowerCase();for(const button of document.querySelectorAll('[data-character]')){const c=roster[button.dataset.character];button.hidden=![c?.name,...(c?.affinity||[]),...(c?.role||[]),...(c?.specialty||[])].join(' ').toLowerCase().includes(query);}}
 function miniTeam(plan){mini.replaceChildren();plan.team.forEach((id,index)=>{const button=el('button',{type:'button'},(index+1)+': '+(roster[id]?.nickname||roster[id]?.name||'Empty'));button.addEventListener('click',()=>api.openPicker(index));mini.append(button);});const support=el('button',{type:'button'},'Support: '+(roster[plan.support]?.nickname||'Empty'));support.addEventListener('click',api.openSupportPicker);mini.append(support);}
 function renderMember(id,index,isSupport,plan){
  const c=roster[id],card=el('article',{class:'plan-member','data-member':id}),head=el('div',{class:'plan-member-heading'}),identity=el('div',{class:'plan-member-identity'}),portrait=el('div',{class:'plan-member-portrait','aria-hidden':'true'}),copy=el('div');
  if(c.profile_image){const image=el('img',{src:c.profile_image,alt:'',loading:'lazy'});image.addEventListener('error',()=>image.remove(),{once:true});portrait.append(image);}
  const title=el('h3');title.append(link(c.name,'/webpages/game-c.html?'+new URLSearchParams({char:id}))); copy.append(el('span',{class:'plan-position'},isSupport?'Support':'Slot '+(index+1)),title,el('p',{class:'plan-member-meta'},[...(c.affinity||[]),...(c.role||[])].join(' · ')||'Role and element not specified'));identity.append(portrait,copy);head.append(identity);
  const actions=el('div',{class:'plan-member-actions'});if(!isSupport)for(const [delta,label,symbol]of [[-1,'Move left','←'],[1,'Move right','→']]){const button=el('button',{type:'button','aria-label':label+' — '+c.name,title:label},symbol);button.disabled=index+delta<0||index+delta>2;button.addEventListener('click',()=>{const p=state();[p.team[index],p.team[index+delta]]=[p.team[index+delta],p.team[index]];apply(p);});actions.append(button);}
  const replace=el('button',{type:'button','aria-label':'Replace '+c.name},'Swap');replace.addEventListener('click',()=>isSupport?api.openSupportPicker():api.openPicker(index));actions.append(replace);head.append(actions);card.append(head);
  const contributions=[...new Set(c.specialty||[])],tags=el('div',{class:'plan-contribution-tags','aria-label':c.name+' specialties'});for(const tag of contributions)tags.append(el('span',{},tag));card.append(tags);
  const builds=el('details',{class:'character-builds plan-member-build','data-build-member':id});
  builds.append(el('summary',{},'Skills & equipment'));
  const chosen=plan.loadouts[id];
  builds.append(loadoutControls(c,skillData[id],chosen,next=>{const updated=state();updated.loadouts[id]=next;updated.technical[id]=next.technical[0]||'';apply(updated);persistBuild(id,updated);},{support:isSupport}));
  builds.append(equipmentControls(context,id,plan.equipment[id],next=>{const updated=state();updated.equipment[id]=next;apply(updated);persistBuild(id,updated);}));
  if(context.guides[id]?.tree)builds.append(link('Explore Skill Tree','/webpages/game-c.html?char='+id+'&view=tree'));
  card.append(builds);return card;
 }
 function render(){const opened=[...overview.querySelectorAll('[data-build-member][open]')].map(node=>node.dataset.buildMember);const focused=document.activeElement?.getAttribute('aria-label');const plan=state();equipment=plan.equipment;technical=plan.technical;loadouts=plan.loadouts;overview.replaceChildren(el('h2',{},'Team Overview'));for(const [index,id]of plan.team.entries())if(id)overview.append(renderMember(id,index,false,plan));if(plan.support)overview.append(renderMember(plan.support,0,true,plan));if(!plan.team.some(Boolean))overview.append(el('p',{},'Select a character slot above to start planning.'));const sharedURL=new URL(location.href);sharedURL.hash=planHash(plan);shareField.value=sharedURL.href;overview.append(teamEffects(context,plan,profileBuilds));miniTeam(plan);filterPicker();for(const id of opened){const details=overview.querySelector('[data-build-member="'+id+'"]');if(details)details.open=true;}if(focused){const target=[...root.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')===focused);target?.focus({preventScroll:true});}if(!loading&&equipmentAvailable)saveStorage(DRAFT,plan);}
 function resetExtras(){equipment={};technical={};loadouts={};}
 
 document.querySelector('#support-slot').setAttribute('aria-label','Choose support character');
 for(const slot of document.querySelectorAll('.team-slot,#support-slot')){slot.tabIndex=0;slot.setAttribute('role','button');slot.addEventListener('keydown',event=>{if(event.target===slot&&['Enter',' '].includes(event.key)){event.preventDefault();slot.click();}});}
 const originalRender=render;function accessibleRender(){originalRender();document.querySelectorAll('.team-slot').forEach((slot,index)=>slot.setAttribute('aria-label','Choose character '+(index+1)+(roster[api.getState().team[index]]?' — '+roster[api.getState().team[index]].name:'')));}
 let initial=null;try{initial=parsePlanHash(location.hash);}catch(error){message(error.message+' Your local draft was kept.');}if(!initial)initial=safeRead(DRAFT,null);
 if(initial)apply(initial);loading=false;accessibleRender();if(storageWarning)message(storageWarning);
 window.addEventListener('hashchange',()=>{try{const plan=parsePlanHash(location.hash);if(plan){apply(plan);message('Shared team loaded.');}}catch(error){message(error.message);}});
 return {render:accessibleRender,resetExtras,skillData,abilitySkills:id=>[...(state().loadouts[id]?.technical||[]).filter(Boolean),...(roster[id]?.skills||[]).filter(key=>/^Dupes/i.test(key))]};
}
