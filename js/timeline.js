(() => {
 const track=document.getElementById('timeline'),viewport=document.getElementById('tree-viewport'),nav=document.getElementById('era-links'),toggle=document.getElementById('toggleAll'),panel=document.getElementById('jump-panel'),search=document.getElementById('jump-search'),opener=document.getElementById('open-jump');
 const colors={alliance:'#72c7d7',conflict:'#d0575e',magic:'#a67ad0',discovery:'#c9a84c'};
 const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
 let destinations=[],category='all',highlight=null,firstArc=null,drag=null;
 function syncToggle(){toggle.textContent=[...track.querySelectorAll('details')].some(d=>!d.open)?'Expand events':'Collapse events';}
 function jump(id,updateHash=true){
  const target=document.getElementById(id);if(!target||!track.contains(target))return;
  if(target.tagName==='DETAILS')target.open=true;
  if(panel.open)panel.close();
  highlight?.classList.remove('tree-target');highlight=target;target.classList.add('tree-target');
  const box=target.getBoundingClientRect(),view=viewport.getBoundingClientRect();
  viewport.scrollTo({left:viewport.scrollLeft+box.left-view.left-(viewport.clientWidth-box.width)/2,top:viewport.scrollTop+box.top-view.top-36,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  target.tabIndex=-1;target.focus({preventScroll:true});
  if(updateHash)history.replaceState(null,'',`#${id}`);
 }
 function renderJump(){
  const query=search.value.trim().toLocaleLowerCase();nav.replaceChildren();
  const matches=destinations.filter(d=>(category==='all'||d.kind===category)&&`${d.title} ${d.context}`.toLocaleLowerCase().includes(query));
  document.getElementById('jump-count').textContent=matches.length?`${matches.length} points`:'No matching points. Try another search.';
  for(const entry of matches){const link=node('a','',entry.title);link.href=`#${entry.id}`;link.append(node('span','jump-context',`${{arc:'Major arc',event:'Event',character:'Character',side:'Side story'}[entry.kind]} · ${entry.context}`));link.onclick=e=>{e.preventDefault();jump(entry.id);};nav.append(link);}
 }
 function openPanel(){panel.showModal();opener.setAttribute('aria-expanded','true');search.focus();}
 opener.onclick=openPanel;document.getElementById('close-jump').onclick=()=>panel.close();
 panel.addEventListener('close',()=>opener.setAttribute('aria-expanded','false'));
 panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)panel.close();}});
 search.addEventListener('input',renderJump);
 document.querySelectorAll('.jump-filters button').forEach(button=>button.onclick=()=>{category=button.dataset.kind;document.querySelectorAll('.jump-filters button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderJump();});
 const zoom=document.getElementById('tree-zoom');
 function setZoom(){track.style.setProperty('--tree-zoom',Number(zoom.value)/100);document.getElementById('zoom-value').textContent=`${zoom.value}%`;}
 zoom.addEventListener('input',setZoom);
 document.getElementById('reset-view').onclick=()=>{zoom.value=100;setZoom();if(firstArc)jump(firstArc,false);};
 // Drag only the grid and connectors, preserving selection and native card controls.
 viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||e.target.closest('.arc-card,.tree-branch,button,a,input,summary'))return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');});
 viewport.addEventListener('pointermove',e=>{if(drag){viewport.scrollLeft=drag.left-(e.clientX-drag.x);viewport.scrollTop=drag.top-(e.clientY-drag.y);}});
 const endDrag=()=>{drag=null;viewport.classList.remove('dragging');};
 ['pointerup','pointercancel','lostpointercapture'].forEach(event=>viewport.addEventListener(event,endDrag));
 function eventCard(event,id,kind,context){
  const details=node('details','chronicle-event');details.id=id;details.style.setProperty('--event-color',colors[event.type]||colors.discovery);
  details.append(node('summary','',event.title||'Untitled event'));
  const body=node('div','event-body');body.append(node('p','',event.description));const meta=node('div','event-meta');
  for(const value of [event.date,event.location].filter(Boolean))meta.append(node('span','',value));
  if(event.characters?.length){body.append(node('p','',`Characters: ${event.characters.join(', ')}`));}
  body.append(meta);details.append(body);details.addEventListener('toggle',syncToggle);
  destinations.push({id,title:event.title||'Untitled event',context,kind});return details;
 }
 async function load(){
  track.setAttribute('aria-busy','true');track.replaceChildren(node('p','','Opening the archive…'));nav.replaceChildren();toggle.disabled=true;destinations=[];firstArc=null;
  try{
   const response=await fetch('/webpages/list-timeline.json',{cache:'no-cache'});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.timeline))throw Error();
   track.replaceChildren();const items=[...data.timeline].sort((a,b)=>(a.order??0)-(b.order??0));
   for(const [i,item] of items.entries()){
    const article=node('article','tree-arc');article.id=`era-${i+1}`;
    const card=node('div','arc-card');card.id=`arc-${i+1}`;if(!firstArc)firstArc=card.id;
    card.append(node('p','era-label',item.era||`Arc ${i+1}`));
    if(item.storyRole==='side-story'||item.storyRole==='prequel')card.append(node('span','arc-badge',item.storyRole==='prequel'?'Prequel':'Side story'));
    if(item.status==='tentative')card.append(node('span','arc-badge','Tentative continuation'));
    card.append(node('h2','',item.title||'Untitled arc'),node('p','era-date',item.date||'Date unknown'),node('p','era-summary',item.summary));article.append(card);
    destinations.push({id:card.id,title:item.title,context:item.era,kind:'arc'});
    if(item.storyRole==='side-story'||item.storyRole==='prequel')destinations.push({id:card.id,title:item.title,context:item.era,kind:'side'});
    const branches=node('div','tree-branches'),events=node('section','tree-branch'),characters=node('section','tree-branch'),sides=node('section','tree-branch');
    events.append(node('h3','','Events'));characters.append(node('h3','','Characters involved'));sides.append(node('h3','','Side stories & context'));
    const people=new Map();let eventCount=0,sideCount=0;
    for(const [j,event] of (item.events||[]).entries()){
     const id=`event-${i+1}-${j+1}`,isSide=event.storyRole==='side-story';
     (isSide?sides:events).append(eventCard(event,id,isSide?'side':'event',item.title));if(isSide)sideCount++;else eventCount++;
     for(const person of event.characters||[]){if(!people.has(person))people.set(person,id);}
    }
    const chips=node('div','character-links');
    for(const [person,id] of people){const button=node('button','character-chip',person);button.type='button';button.title=`Find ${person} in the timeline`;button.onclick=()=>{category='character';search.value=person;document.querySelectorAll('.jump-filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind==='character')));renderJump();openPanel();};chips.append(button);destinations.push({id,title:person,context:item.title,kind:'character'});}
    characters.append(people.size?chips:node('p','branch-empty','No characters named in this part of the outline.'));
    if(!eventCount)events.append(node('p','branch-empty','No main events recorded.'));
    if(!sideCount)sides.append(node('p','branch-empty',item.storyRole==='side-story'||item.storyRole==='prequel'?'This entire arc is a separate story thread. Its events are listed on the left.':'No separate side-story events recorded.'));
    branches.append(events,characters,sides);article.append(branches);track.append(article);
   }
   if(!items.length)track.append(node('p','','No chronicle entries have been recorded.'));
   toggle.disabled=!track.querySelector('details');syncToggle();renderJump();
   requestAnimationFrame(()=>{const hash=location.hash.slice(1);if(hash&&document.getElementById(hash))jump(hash,false);else viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);});
  }catch{track.replaceChildren(node('p','','The archive could not be opened.'));const retry=node('button','chronicle-toggle','Try again');retry.type='button';retry.onclick=load;track.append(retry);}
  finally{track.setAttribute('aria-busy','false');}
 }
 toggle.addEventListener('click',()=>{const details=[...track.querySelectorAll('details')],open=details.some(d=>!d.open);details.forEach(d=>d.open=open);syncToggle();});
 window.addEventListener('hashchange',()=>jump(location.hash.slice(1),false));
 load();
})();
