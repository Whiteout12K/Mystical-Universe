(() => {
 const track=document.getElementById('timeline'),viewport=document.getElementById('tree-viewport'),nav=document.getElementById('era-links'),toggle=document.getElementById('toggleAll'),panel=document.getElementById('jump-panel'),search=document.getElementById('jump-search'),opener=document.getElementById('open-jump');
 const colors={alliance:'#72c7d7',conflict:'#d0575e',magic:'#a67ad0',discovery:'#c9a84c'};
 const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
 let destinations=[],category='arc',highlight=null,firstArc=null,drag=null,eventIndex=new Map(),connectionIndex=new Map();
 function syncToggle(){toggle.textContent=[...track.querySelectorAll('.chronicle-event')].some(d=>!d.open)?'Expand events':'Collapse events';}
 function jump(id,updateHash=true,mark=true){
  const target=document.getElementById(id);if(!target||!track.contains(target))return;
  if(target.tagName==='DETAILS')target.open=true;
  if(panel.open)panel.close();
  highlight?.classList.remove('tree-target');highlight=mark?target:null;if(mark)target.classList.add('tree-target');
  const box=target.getBoundingClientRect(),view=viewport.getBoundingClientRect();
  const inset=Math.max(96,document.querySelector('.tree-toolbar').getBoundingClientRect().bottom-view.top+16);
  viewport.scrollTo({left:viewport.scrollLeft+box.left-view.left-(viewport.clientWidth-box.width)/2,top:viewport.scrollTop+box.top-view.top-inset,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  if(mark){target.tabIndex=-1;target.focus({preventScroll:true});}
  if(updateHash)history.replaceState(null,'',`#${id}`);
 }
 function renderJump(){
  const query=search.value.trim().toLocaleLowerCase();nav.replaceChildren();
  const matches=destinations.filter(d=>(category==='all'||d.kind===category)&&`${d.title} ${d.context}`.toLocaleLowerCase().includes(query));
  document.getElementById('jump-count').textContent=matches.length?`${matches.length} points`:'No matching points. Try another search.';
  for(const entry of matches){const link=node('a','',entry.title);link.href=`#${entry.id}`;link.append(node('span','jump-context',`${{arc:'Major arc',event:'Event',character:'Character',side:'Side story'}[entry.kind]} · ${entry.context}`));link.onclick=e=>{e.preventDefault();jump(entry.id);};nav.append(link);}
 }
 function openPanel(){panel.showModal();opener.setAttribute('aria-expanded','true');}
 opener.onclick=openPanel;document.getElementById('close-jump').onclick=()=>panel.close();
 panel.addEventListener('close',()=>opener.setAttribute('aria-expanded','false'));
 panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)panel.close();}});
 search.addEventListener('input',renderJump);
 document.querySelectorAll('.jump-filters button').forEach(button=>button.onclick=()=>{category=button.dataset.kind;document.querySelectorAll('.jump-filters button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderJump();});
 const zoom=document.getElementById('tree-zoom');
 function setZoom(){
  const old=Number(track.style.getPropertyValue('--tree-zoom'))||1,next=Number(zoom.value)/100;
  const x=(viewport.scrollLeft+viewport.clientWidth/2)/old,y=(viewport.scrollTop+viewport.clientHeight/2)/old;
  track.style.setProperty('--tree-zoom',next);document.getElementById('zoom-value').textContent=`${zoom.value}%`;
  viewport.scrollLeft=x*next-viewport.clientWidth/2;viewport.scrollTop=y*next-viewport.clientHeight/2;
 }
 zoom.addEventListener('input',setZoom);
 document.getElementById('reset-view').onclick=()=>{zoom.value=100;setZoom();if(firstArc)jump(firstArc,false);};
 // Drag only the grid and connectors, preserving selection and native card controls.
 viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||e.target.closest('.arc-card,.tree-branch,button,a,input,summary'))return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');});
 viewport.addEventListener('pointermove',e=>{if(drag){viewport.scrollLeft=drag.left-(e.clientX-drag.x);viewport.scrollTop=drag.top-(e.clientY-drag.y);}});
 const endDrag=()=>{drag=null;viewport.classList.remove('dragging');};
 ['pointerup','pointercancel','lostpointercapture'].forEach(event=>viewport.addEventListener(event,endDrag));
 function eventCard(event,id,kind,context,sequence){
  const details=node('details','chronicle-event');details.id=id;details.style.setProperty('--event-color',colors[event.type]||colors.discovery);
  const summary=node('summary','');
  const title=node('span','event-title');title.append(node('span','',event.title||'Untitled event'));summary.append(node('span','event-step',String(sequence).padStart(2,'0')),title);details.append(summary);
  const timing=event.timing==='history'?'Earlier history':event.timing==='time-travel'?'Time travel':kind==='side'?'Side story':'Story event';
  title.append(node('span','event-kind',timing==='Story event'?({alliance:'Alliance',conflict:'Conflict',magic:'Magic',discovery:'Discovery'}[event.type]||timing):timing));
  if(event.date)title.append(node('span','event-time',`${event.date}${event.timing==='history'?' · Recalled here':''}`));
  const body=node('div','event-body');body.append(node('p','',event.description));const meta=node('div','event-meta');
  if(event.location)meta.append(node('span','',`Location: ${event.location}`));
  if(event.characters?.length){body.append(node('p','',`Characters: ${event.characters.join(', ')}`));}
  body.append(meta);
  const connections=connectionIndex.get(event.title)||[];
  if(connections.length){
   const links=node('nav','event-connections');links.setAttribute('aria-label','Connected events');links.append(node('p','','Connected history'));
   for(const relation of connections){const destination=eventIndex.get(relation.title);if(!destination)continue;const link=node('a','',`${relation.label} →`);link.href=`#${destination}`;link.title=relation.title;link.onclick=e=>{e.preventDefault();jump(destination);};links.append(link);}
   body.append(links);
  }
  details.append(body);details.addEventListener('toggle',syncToggle);
  destinations.push({id,title:event.title||'Untitled event',context,kind});return details;
 }
 async function load(){
  track.setAttribute('aria-busy','true');track.replaceChildren(node('p','','Opening the archive…'));nav.replaceChildren();toggle.disabled=true;destinations=[];firstArc=null;
  try{
   const response=await fetch('/webpages/list-timeline.json',{cache:'no-cache'});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.timeline))throw Error();
   track.replaceChildren();const items=[...data.timeline].sort((a,b)=>(a.order??0)-(b.order??0));
   eventIndex=new Map();items.forEach((item,i)=>(item.events||[]).forEach((event,j)=>eventIndex.set(event.title,`event-${i+1}-${j+1}`)));
   connectionIndex=new Map();
   for(const item of items)for(const event of item.events||[]){
    if(!connectionIndex.has(event.title))connectionIndex.set(event.title,[]);
    connectionIndex.get(event.title).push(...(event.relatedEvents||[]));
    for(const relation of event.relatedEvents||[]){if(!connectionIndex.has(relation.title))connectionIndex.set(relation.title,[]);connectionIndex.get(relation.title).push({title:event.title,label:`Related history: ${event.title}`});}
   }
   for(const [i,item] of items.entries()){
    const article=node('article','tree-arc');article.id=`era-${i+1}`;
    const card=node('div','arc-card');card.id=`arc-${i+1}`;if(!firstArc)firstArc=card.id;
    card.append(node('p','era-label',item.era||`Arc ${i+1}`));
    if(item.storyRole==='side-story'||item.storyRole==='prequel')card.append(node('span','arc-badge',item.storyRole==='prequel'?'Prequel':'Side story'));
    if(item.status==='tentative')card.append(node('span','arc-badge','Tentative continuation'));
    card.append(node('h2','',item.title||'Untitled arc'),node('p','era-date',item.date||'Date unknown'),node('p','era-summary',item.summary));article.append(card);
    destinations.push({id:card.id,title:item.title,context:item.era,kind:'arc'});
    if(item.storyRole==='side-story'||item.storyRole==='prequel')destinations.push({id:card.id,title:item.title,context:item.era,kind:'side'});
    const eventList=node('div','arc-events');eventList.setAttribute('aria-label',`Event sequence in ${item.title}`);
    const people=new Map();
    for(const [j,event] of (item.events||[]).entries()){
     const id=`event-${i+1}-${j+1}`,isSide=event.storyRole==='side-story',historical=event.timing==='history';
     const slot=node('div',`event-slot${isSide||historical?' event-branch':''}${historical?' event-history':''}`);
     slot.append(eventCard(event,id,isSide?'side':'event',item.title,j+1));eventList.append(slot);
     for(const person of event.characters||[]){if(!people.has(person))people.set(person,id);}
    }
    const chips=node('div','character-links');
    for(const [person,id] of people){const button=node('button','character-chip',person);button.type='button';button.title=`Find ${person} in the timeline`;button.onclick=()=>{category='character';search.value=person;document.querySelectorAll('.jump-filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind==='character')));renderJump();openPanel();};chips.append(button);destinations.push({id,title:person,context:item.title,kind:'character'});}
    const characters=node('details','arc-characters');characters.append(node('summary','',`Characters involved (${people.size})`));characters.append(people.size?chips:node('p','branch-empty','No characters named in this part of the outline.'));card.append(characters);
    if(!(item.events||[]).length)eventList.append(node('p','branch-empty','No events recorded for this arc.'));
    const count=(item.events||[]).length;
    const eventHeading=node('h3','arc-events-heading',`${count} ${count===1?'event':'events'}`);eventHeading.append(node('span','','Read top to bottom'));
    const rail=node('div','arc-rail');rail.setAttribute('aria-hidden','true');
    const eventPanel=node('section','arc-event-panel');eventPanel.setAttribute('aria-label',`Events in ${item.title}`);eventPanel.append(eventHeading,eventList);
    if(item.status==='tentative')article.classList.add('arc-tentative');
    article.append(rail,eventPanel);track.append(article);
   }
   if(!items.length)track.append(node('p','','No chronicle entries have been recorded.'));
   toggle.disabled=!track.querySelector('.chronicle-event');syncToggle();renderJump();
   requestAnimationFrame(()=>{const hash=location.hash.slice(1);if(hash&&document.getElementById(hash))jump(hash,false);else if(firstArc)jump(firstArc,false,false);});
  }catch{track.replaceChildren(node('p','','The archive could not be opened.'));const retry=node('button','chronicle-toggle','Try again');retry.type='button';retry.onclick=load;track.append(retry);}
  finally{track.setAttribute('aria-busy','false');}
 }
 toggle.addEventListener('click',()=>{const details=[...track.querySelectorAll('.chronicle-event')],open=details.some(d=>!d.open);details.forEach(d=>d.open=open);syncToggle();});
 window.addEventListener('hashchange',()=>jump(location.hash.slice(1),false));
 load();
})();
