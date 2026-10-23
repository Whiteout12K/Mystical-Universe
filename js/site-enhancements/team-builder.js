import {el,link} from './core.js';
import {normalizePlan,planHash,parsePlanHash} from './team-builder-model.js';
const DRAFT='ml-team-draft-v1';
export async function setupTeamBuilder(api){
 const roster=api.roster,catalogues={},skillData={};let equipmentAvailable=true,storageWarning='',equipment={},technical={},loading=true;
 const getJSON=async path=>{const response=await fetch(path);if(!response.ok)throw Error(path);return response.json();};
 await Promise.all(Object.entries({weapons:'weapon',accessories:'accessory',artifacts:'artifact'}).map(async([key,file])=>{try{catalogues[key]=await getJSON('/images/mlg-assets/data-'+file+'.json');}catch{equipmentAvailable=false;catalogues[key]={};storageWarning='Some team data could not load. Reload before copying a team link.';}}));
 await Promise.all(Object.keys(roster).map(async id=>{try{skillData[id]=await getJSON('/images/mlg-assets/Characters/'+id.toUpperCase()+'/'+id+'.json');}catch{skillData[id]={};}}));
 const root=el('section',{class:'builder-planning','aria-label':'Team planning'}),toolbar=el('section',{class:'plan-toolbar','aria-label':'Share team'}),notice=el('p',{class:'plan-message',role:'status'}),overview=el('section',{class:'plan-section plan-overview'});
 root.append(notice,overview);document.querySelector('#abilities').after(root);document.querySelector('.builder-header').append(toolbar);
 const shareButton=el('button',{type:'button'},'Copy team link'),shareField=el('input',{id:'team-share-link',readonly:'',hidden:'','aria-label':'Team share link'});toolbar.append(shareButton,shareField);shareButton.disabled=!equipmentAvailable;
 function message(text){notice.textContent=text;}
 function safeRead(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{storageWarning='Your previous draft could not be loaded. You can still copy a team link.';return fallback;}}
 function saveStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{message('This browser could not save the team. Copy a team link to keep your selections.');return false;}}
 function state(){return normalizePlan({...api.getState(),equipment,technical},roster,catalogues,skillData);}
 function apply(raw){const plan=normalizePlan(raw,roster,catalogues,skillData);equipment=plan.equipment;technical=plan.technical;api.setState(plan);document.querySelector('#team-select').value='';api.refresh();}
 shareButton.addEventListener('click',async()=>{const url=new URL(location.href);url.hash=planHash(state());shareField.value=url.href;shareField.hidden=false;try{await navigator.clipboard.writeText(url.href);message('Team link copied. It includes character order, support, and Resonance.');}catch{shareField.focus();shareField.select();message('Copy the selected link to share this team.');}});
 const picker=document.querySelector('#character-picker'),pickerTop=document.querySelector('.picker-top'),mini=el('div',{class:'picker-current-team','aria-label':'Current team'}),search=el('input',{type:'search',id:'team-character-search',placeholder:'Search name, element, role…','aria-label':'Search characters'});
 pickerTop.after(mini,search);search.addEventListener('input',filterPicker);
 function filterPicker(){const query=search.value.trim().toLowerCase();for(const button of document.querySelectorAll('[data-character]')){const c=roster[button.dataset.character];button.hidden=![c?.name,...(c?.affinity||[]),...(c?.role||[]),...(c?.specialty||[])].join(' ').toLowerCase().includes(query);}}
 function miniTeam(plan){mini.replaceChildren();plan.team.forEach((id,index)=>{const button=el('button',{type:'button'},(index+1)+': '+(roster[id]?.nickname||roster[id]?.name||'Empty'));button.addEventListener('click',()=>api.openPicker(index));mini.append(button);});const support=el('button',{type:'button'},'Support: '+(roster[plan.support]?.nickname||'Empty'));support.addEventListener('click',api.openSupportPicker);mini.append(support);}
 function renderMember(id,index,isSupport,plan){
  const c=roster[id],card=el('article',{class:'plan-member','data-member':id}),head=el('div',{class:'plan-member-heading'}),identity=el('div',{class:'plan-member-identity'}),portrait=el('div',{class:'plan-member-portrait','aria-hidden':'true'}),copy=el('div');
  if(c.profile_image){const image=el('img',{src:c.profile_image,alt:'',loading:'lazy'});image.addEventListener('error',()=>image.remove(),{once:true});portrait.append(image);}
  const title=el('h3');title.append(link(c.name,'/webpages/game-c.html?char='+id));copy.append(el('span',{class:'plan-position'},isSupport?'Support':'Slot '+(index+1)),title,el('p',{class:'plan-member-meta'},[...(c.affinity||[]),...(c.role||[])].join(' · ')||'Role and element not specified'));identity.append(portrait,copy);head.append(identity);
  const actions=el('div',{class:'plan-member-actions'});if(!isSupport)for(const [delta,label,symbol]of [[-1,'Move left','←'],[1,'Move right','→']]){const button=el('button',{type:'button','aria-label':label+' — '+c.name,title:label},symbol);button.disabled=index+delta<0||index+delta>2;button.addEventListener('click',()=>{const p=state();[p.team[index],p.team[index+delta]]=[p.team[index+delta],p.team[index]];apply(p);});actions.append(button);}
  const replace=el('button',{type:'button','aria-label':'Replace '+c.name},'Swap');replace.addEventListener('click',()=>isSupport?api.openSupportPicker():api.openPicker(index));actions.append(replace);head.append(actions);card.append(head);
  const contributions=[...new Set(c.specialty||[])],tags=el('div',{class:'plan-contribution-tags','aria-label':c.name+' specialties'});for(const tag of contributions)tags.append(el('span',{},tag));card.append(tags);return card;
 }
 function render(){const focused=document.activeElement?.getAttribute('aria-label');const plan=state();equipment=plan.equipment;technical=plan.technical;overview.replaceChildren(el('h2',{},'Team overview'));for(const [index,id]of plan.team.entries())if(id)overview.append(renderMember(id,index,false,plan));if(plan.support)overview.append(renderMember(plan.support,0,true,plan));if(!plan.team.some(Boolean))overview.append(el('p',{},'Select a character slot above to start planning.'));miniTeam(plan);filterPicker();if(focused){const target=[...root.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')===focused);target?.focus({preventScroll:true});}if(!loading&&equipmentAvailable)saveStorage(DRAFT,plan);}
 function resetExtras(){equipment={};technical={};}
 
 document.querySelector('#support-slot').setAttribute('aria-label','Choose support character');
 for(const slot of document.querySelectorAll('.team-slot,#support-slot')){slot.tabIndex=0;slot.setAttribute('role','button');slot.addEventListener('keydown',event=>{if(event.target===slot&&['Enter',' '].includes(event.key)){event.preventDefault();slot.click();}});}
 const originalRender=render;function accessibleRender(){originalRender();document.querySelectorAll('.team-slot').forEach((slot,index)=>slot.setAttribute('aria-label','Choose character '+(index+1)+(roster[api.getState().team[index]]?' — '+roster[api.getState().team[index]].name:'')));}
 let initial=null;try{initial=parsePlanHash(location.hash);}catch(error){message(error.message+' Your local draft was kept.');}if(!initial)initial=safeRead(DRAFT,null);
 if(initial)apply(initial);loading=false;accessibleRender();if(storageWarning)message(storageWarning);
 window.addEventListener('hashchange',()=>{try{const plan=parsePlanHash(location.hash);if(plan){apply(plan);message('Shared team loaded.');}}catch(error){message(error.message);}});
 return {render:accessibleRender,resetExtras,skillData};
}
