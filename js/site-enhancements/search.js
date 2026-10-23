import {el,link,json,normalize,flagsReady,status} from './core.js';
let indexPromise,dialog,unlockBackground;
function lockBackgroundScroll(){
 const root=document.documentElement,body=document.body,x=window.scrollX,y=window.scrollY,width=root.clientWidth;
 const remember=(node,properties)=>properties.map(property=>[property,node.style.getPropertyValue(property),node.style.getPropertyPriority(property)]);
 const rootStyles=remember(root,['overflow','scroll-behavior']);
 const bodyStyles=remember(body,['position','top','left','width','overflow']);
 root.style.setProperty('overflow','hidden');
 body.style.setProperty('position','fixed');body.style.setProperty('top',`-${y}px`);body.style.setProperty('left',`-${x}px`);body.style.setProperty('width',`${width}px`);body.style.setProperty('overflow','hidden');
 return ()=>{
  const restore=(node,styles)=>styles.forEach(([property,value,priority])=>value?node.style.setProperty(property,value,priority):node.style.removeProperty(property));
  restore(body,bodyStyles);restore(root,rootStyles);
  root.style.setProperty('scroll-behavior','auto');window.scrollTo({left:x,top:y,behavior:'instant'});restore(root,rootStyles);
 };
}
async function records(){if(!indexPromise)indexPromise=json('/data/search-index.json').then(data=>data.records).catch(error=>{indexPromise=null;throw error;});return indexPromise;}
export function mountSearch(host,initial=''){
 host.replaceChildren();
 const controls=el('div',{class:'ml-search-controls'});const input=el('input',{type:'search',id:host.id+'-query',placeholder:'Character, skill, effect, equipment, book, or article…',autocomplete:'off',value:initial});
 const searchLabel=el('label',{for:input.id},'Search Mystical Legends');const field=el('div');field.append(searchLabel,input);
 const filter=el('select',{id:host.id+'-type'});for(const type of ['Everything','Character','Wiki','Skill','Effect','Weapon','Accessory','Artifact','Book'])filter.append(el('option',{value:type},type));const filterField=el('div');filterField.append(el('label',{for:filter.id},'Show'),filter);controls.append(field,filterField);
 const message=el('p',{class:'ml-muted',role:'status','aria-live':'polite'}),list=el('ul',{class:'ml-search-results'}),more=el('button',{type:'button',hidden:''},'Show more results');host.append(controls,message,list,more);
 let token=0,limit=30;
 async function search(){const thisToken=++token;message.textContent='Loading search…';try{
 const data=await records();if(thisToken!==token)return;const query=normalize(input.value),terms=query.split(' ').filter(Boolean);
 const matches=data.filter(row=>(filter.value==='Everything'||row.type===filter.value)&&terms.every(term=>normalize(row.search+' '+row.title).includes(term))).map(row=>({row,score:normalize(row.title)===query?3:normalize(row.title).startsWith(query)?2:1})).sort((a,b)=>b.score-a.score||a.row.title.localeCompare(b.row.title));list.replaceChildren();
 for(const {row} of matches.slice(0,limit)){const li=el('li');li.append(el('small',{},row.type),link(row.title,row.path));if(row.description)li.append(el('p',{},row.description));list.append(li);}
 message.textContent=matches.length?`${Math.min(limit,matches.length)} of ${matches.length} results`:'No matches. Try a name, affinity, or skill.';more.hidden=matches.length<=limit;
 if(host.closest('.ml-tools-page')){const url=new URL(location.href);if(input.value)url.searchParams.set('q',input.value);else url.searchParams.delete('q');history.replaceState(null,'',url);}
 }catch{if(thisToken!==token)return;list.replaceChildren();message.textContent='Search could not load. Try again.';const retry=el('button',{type:'button'},'Retry search');retry.onclick=search;list.append(el('li'));list.lastChild.append(retry);}}
 input.addEventListener('input',()=>{limit=30;search();});filter.addEventListener('change',()=>{limit=30;search();});more.onclick=()=>{limit+=30;search();};input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){const first=list.querySelector('a');if(first){event.preventDefault();first.focus();}}});list.addEventListener('keydown',event=>{const links=[...list.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(event.key==='ArrowDown'){event.preventDefault();links[Math.min(links.length-1,i+1)]?.focus();}if(event.key==='ArrowUp'){event.preventDefault();if(i<=0)input.focus();else links[i-1].focus();}});search();return input;
}
export async function openSearch(){if(!(await flagsReady).unifiedSearch)return;if(!dialog){dialog=el('dialog',{class:'ml-dialog','aria-labelledby':'ml-search-title'});const header=el('div',{class:'ml-dialog-header'}),close=el('button',{type:'button'},'Close');close.onclick=()=>dialog.close();header.append(el('h2',{id:'ml-search-title'},'Explore Mystical Legends'),close);const host=el('div',{id:'ml-global-search'});dialog.append(header,host);document.body.append(dialog);mountSearch(host);dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{unlockBackground?.();unlockBackground=null;});}if(dialog.open)return;unlockBackground=lockBackgroundScroll();try{dialog.showModal();dialog.querySelector('input').focus();}catch(error){unlockBackground();unlockBackground=null;throw error;}}
const page=document.getElementById('ml-search-page');if(page){if((await flagsReady).unifiedSearch)mountSearch(page,new URLSearchParams(location.search).get('q')||'');else status(page,'Website search is currently disabled.');}
