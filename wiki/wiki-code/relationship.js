/* Capitalize word starts without treating accents or parenthetical suffixes as boundaries. */
function formatWikiRelationshipLabel(label){
  return label.replace(/(^|[\s-])(\p{L})/gu,(_,separator,letter)=>separator+letter.toUpperCase());
}
/* Normalize relationship lines without hiding spoiler-marked connections. */
function wikiRelationshipLines(relations){
  return relations.replace(/\{\{Spoiler\|([\s\S]*?)\}\}/gi,'$1').split('\n').flatMap(line=>{
    const colon=line.indexOf(':');if(colon<0)return [];
    return line.slice(colon+1).split(/<br\s*\/?>/i).map(value=>line.slice(0,colon)+': '+value.trim());
  });
}
/* Keep named relationship entries visible before their articles are published. */
function expandWikiRelationshipProfiles(published){
  const profiles=[...published],canon=value=>value.toLowerCase().replace(/^fandom:/,'').split('/').pop().replace(/\.html?$/,'').replace(/[^a-z0-9]/g,'');
  const known=new Map();
  for(const profile of profiles)for(const name of [profile.title,profile.path])known.set(canon(name),profile);
  for(const profile of published)for(const line of wikiRelationshipLines(profile.relations)){
    const colon=line.indexOf(':');if(colon<0)continue;
    const value=line.slice(colon+1),links=[...value.matchAll(/\[\[([^\]]+)\]\]/g)];
    const entries=links.length?links.map(match=>match[1].split('|')):[[value.replace(/\([^)]*\)/g,'').trim()]];
    for(const [target,label] of entries){
      const title=(label||target.replace(/^fandom:/,'').split('/').pop().replace(/_/g,' ')).trim();
      if(!title||/^(?:unnamed|unknown|none|n\/a)\b/i.test(title))continue;
      const keys=[canon(target),canon(title)];
      const existing=keys.map(key=>known.get(key)).find(Boolean);
      if(existing){if(existing.unpublished&&!existing.aliases.includes(target))existing.aliases.push(target);for(const key of keys)known.set(key,existing);continue;}
      const pending={title,path:'',image:'',portrait:'',affiliations:[],relations:'',unpublished:true,aliases:[target]};
      profiles.push(pending);for(const key of keys)known.set(key,pending);
    }
  }
  return profiles.sort((a,b)=>a.title.localeCompare(b.title));
}
/* Connections come from documented family/leader fields and shared affiliations. */
(async () => {
  const host=document.getElementById('wiki-relationship-map');if(!host)return;
  host.textContent='Loading character relationships…';
  const published=await window.wikiCharacterArchive,profiles=expandWikiRelationshipProfiles(published);if(!profiles.length){host.textContent='The character archive could not be loaded. Please refresh to try again.';return;}
  host.replaceChildren();
  const make=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
  const tools=make('div');tools.className='wiki-map-tools';
  const search=make('select');search.setAttribute('aria-label','Jump to a character');search.append(new Option('Choose a character',''));profiles.forEach((p,i)=>search.append(new Option(p.title,String(i))));
  const minus=make('button','−'),plus=make('button','+'),reset=make('button','Reset view');for(const b of [minus,plus,reset])b.type='button';minus.setAttribute('aria-label','Zoom out');plus.setAttribute('aria-label','Zoom in');
  const filter=make('select');filter.setAttribute('aria-label','Relationship type');filter.append(new Option('All connections','all'),new Option('Personal relationships','personal'),new Option('Shared affiliations','affiliation'));
  const selectors=make('div');selectors.className='wiki-map-selectors';selectors.append(search,filter);
  const zoomControls=make('div');zoomControls.className='wiki-map-zoom';zoomControls.setAttribute('role','group');zoomControls.setAttribute('aria-label','Map view controls');reset.textContent='Reset';reset.setAttribute('aria-label','Reset view');zoomControls.append(minus,plus,reset);
  tools.append(selectors,zoomControls);
  for(const control of [search,filter,minus,plus,reset])control.disabled=true;
  const pageActions=document.querySelector('.wiki-article-footer .wiki-actions');
  if(pageActions){pageActions.classList.add('wiki-map-page-actions');tools.append(pageActions);}
  const guide=make('p','Drag to pan · Scroll or pinch to zoom · Solid: personal · Dashed: affiliations · Closest: family & spiritual bonds.');guide.className='wiki-map-guide';
  const viewport=make('div');viewport.className='wiki-map-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','Scrollable character relationship map');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1800 1500');svg.setAttribute('role','group');svg.setAttribute('aria-label','Character relationships');viewport.append(svg);
  const arranging=make('div','Arranging connections…');arranging.className='wiki-map-loading';arranging.setAttribute('role','status');viewport.append(arranging);
  const drawer=make('details');drawer.className='wiki-map-drawer';drawer.hidden=true;
  const tab=make('summary'),tabName=make('span','View Character Relationships'),tabHint=make('span','Relationships');tabHint.className='wiki-map-tab-hint';tab.append(tabName,tabHint);tab.setAttribute('aria-controls','wiki-map-selected-details');
  const details=make('div');details.id='wiki-map-selected-details';details.className='wiki-map-details';details.setAttribute('role','region');details.setAttribute('aria-label','Selected character relationships');
  const help=make('details');help.className='wiki-map-help';help.append(make('summary','Map guide'),guide);
  const stage=make('div');stage.className='wiki-map-stage';stage.append(tools,help,viewport);
  drawer.append(tab,details);host.append(stage,drawer);
  const edges=[];const canon=x=>x.toLowerCase().replace(/fandom:/g,'').replace(/[^a-z0-9]/g,'');
  function ties(from,to){
    const matches=[];
    const names=new Set([canon(to.title),canon(to.path.split('/').pop()),...(to.aliases||[]).map(name=>canon(name.replace(/^fandom:/,'').split('/').pop()))].filter(Boolean));
    for(const line of wikiRelationshipLines(from.relations)){
      const colon=line.indexOf(':');if(colon<0)continue;
      const field=line.slice(0,colon).replace(/^Subordinates$/,'Subordinate'),value=line.slice(colon+1);
      const entries=[...value.matchAll(/\[\[([^\]]+)\]\]\s*(?:\(([^)]+)\))?/g)];
      if(entries.length){for(const entry of entries){const [target,label]=entry[1].split('|');const key=target.replace(/^fandom:/,'').split('/').pop();if(!names.has(canon(key))&&!names.has(canon(label||'')))continue;const role=entry[2]||'';matches.push({role:['Relatives','Relationships'].includes(field)?role:field+' '+role,mutual:/\b(mutual|reciprocated|both sides)\b/i.test(role)});}}
      else{const role=value.match(/\(([^)]+)\)/)?.[1]||'';const name=value.replace(/\([^)]*\)/g,'').trim();if(names.has(canon(name)))matches.push({role:['Relatives','Relationships'].includes(field)?role:field+' '+role,mutual:/\b(mutual|reciprocated|both sides)\b/i.test(role)});}
    }
    return matches.filter(tie=>! /\b(friend|friends|friendship|ally|allies)\b/i.test(tie.role)||/\b(rivals?|rivalry)\b/i.test(tie.role));
  }
  const normalizeRole=role=>role.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const former=role=>/\b(former|ex(?:[-\s]|$)|previous|past)\b/i.test(normalizeRole(role));
  const engagement=role=>/\b(fiancee?|betrothed|engaged)\b/.test(normalizeRole(role));
  const romantic=role=>engagement(role)||/\b(love interests?|crush|girlfriend|boyfriend|partner|husband|wife|spouse|lover)\b/i.test(role);
  const feelings=role=>/\b(love interests?|crush)\b/i.test(role);
  const family=role=>!former(role)&&(/\b(mother|father|parent|son|daughter|child|brother|sister|sibling|uncle|aunt|cousin|nephew|niece|grandmother|grandfather|grandparent|grandchild|ancestor|descendant|relative|family|husband|wife|spouse)\b/i.test(role)||engagement(role));
  const spiritual=role=>/\b(host|vess[ea]l|anchored spirit|spiritual bond|(?:deity|demon)[\s-]+contract)\b/i.test(role);
  const hierarchy=role=>/\b(leader|subordinates?)\b/i.test(role);
  const rival=role=>/\b(rivals?|rivalry)\b/i.test(role);
  function listRole(own,reverse){
    const direct=own.find(t=>romantic(t.role))||own.find(t=>family(t.role))||own.find(t=>spiritual(t.role))||own.find(t=>hierarchy(t.role))||own.find(t=>rival(t.role));
    if(direct)return direct.role.trim().toLowerCase();
    const other=reverse.find(t=>romantic(t.role))||reverse.find(t=>family(t.role))||reverse.find(t=>spiritual(t.role))||reverse.find(t=>hierarchy(t.role))||reverse.find(t=>rival(t.role));
    if(!other)return '';
    const role=other.role.toLowerCase();
    if(hierarchy(role))return /subordinates?/.test(role)?'leader':'subordinate';
    const contract=role.match(/\b(deity|demon)[\s-]+contract\b/i);
    if(contract)return contract[1].toLowerCase()+' contract';
    if(spiritual(role))return /vess[ea]l/.test(role)?'host':/host/.test(role)?'vessel':'spiritual bond';
    const prefix=former(role)?'former ':'';
    if(rival(role))return prefix+'rival';
    if(engagement(role))return prefix+'fiancé(e)';
    if(feelings(role))return prefix+'love interest';
    if(romantic(role))return prefix+(/husband|wife|spouse/.test(role)?'spouse':'partner');
    if(/mother|father|parent/.test(role))return 'child';
    if(/son|daughter|child/.test(role))return 'parent';
    if(/brother|sister|sibling/.test(role))return 'sibling';
    if(/ancestor/.test(role))return 'descendant';
    if(/descendant/.test(role))return 'ancestor';
    return 'relative';
  }
  for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){
    const a=profiles[i],b=profiles[j],ab=ties(a,b),ba=ties(b,a);let personal='';
    const ar=ab.find(t=>romantic(t.role)),br=ba.find(t=>romantic(t.role));
    if(ar||br){
      if(!former(ar?.role||'')&&!former(br?.role||'')&&(ar&&br||ar?.mutual||br?.mutual)&&(feelings(ar?.role||'')||feelings(br?.role||'')))personal=a.title+' and '+b.title+' have feelings for each other.';
      else{const tie=ar||br,from=ar?a:b,to=ar?b:a;
        personal=feelings(tie.role)?from.title+(former(tie.role)?' previously had feelings for ':' has feelings for ')+to.title+'; reciprocal feelings are not documented.':to.title+' is '+from.title+'’s '+tie.role.trim().toLowerCase()+'.';}
    }
    if(!personal)for(const [from,to,found] of [[a,b,ab],[b,a,ba]]){const tie=found.find(t=>family(t.role)||spiritual(t.role)||hierarchy(t.role)||rival(t.role));if(tie){personal=to.title+' is '+tie.role+' of '+from.title;break;}}
    const shared=window.wikiAffiliations.shared(a.affiliations,b.affiliations);if(personal||shared.length)edges.push({i,j,shared,loveInterest:ab.concat(ba).some(t=>feelings(t.role)&&!former(t.role)),type:personal?'personal':'affiliation',former:!!personal&&ab.concat(ba).filter(t=>romantic(t.role)||rival(t.role)).length>0&&ab.concat(ba).filter(t=>romantic(t.role)||rival(t.role)).every(t=>former(t.role)),close:ab.concat(ba).some(t=>family(t.role)||spiritual(t.role)),label:personal?personal+(shared.length?' · Shared affiliations: '+shared.join(', '):''):shared.join(', '),listLabels:{[i]:personal?listRole(ab,ba):shared.join(', '),[j]:personal?listRole(ba,ab):shared.join(', ')}});
  }
  let points=profiles.map(()=>({x:0,y:0}));
  viewport.setAttribute('aria-busy','true');svg.style.visibility='hidden';
  details.textContent='Arranging character connections…';
  const lineGroup=document.createElementNS(ns,'g');svg.append(lineGroup);
  for(const e of edges){const line=document.createElementNS(ns,'line');for(const [key,value] of Object.entries({x1:points[e.i].x,y1:points[e.i].y,x2:points[e.j].x,y2:points[e.j].y}))line.setAttribute(key,value);line.classList.add('wiki-map-line',e.type);if(e.close)line.classList.add('close');const title=document.createElementNS(ns,'title');title.textContent=profiles[e.i].title+' — '+profiles[e.j].title+': '+e.label;line.append(title);lineGroup.append(line);e.element=line;}
  const nodes=profiles.map((p,i)=>{const g=document.createElementNS(ns,'g');g.setAttribute('transform',`translate(${points[i].x} ${points[i].y})`);g.classList.add('wiki-map-node');if(p.unpublished){g.classList.add('wiki-map-node-unpublished');const note=document.createElementNS(ns,'title');note.textContent=p.title+' — Wiki page not yet available';g.append(note);}g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label','Show relationships for '+p.title);const c=document.createElementNS(ns,'circle');c.setAttribute('r','38');g.append(c);if(p.portrait||p.image||p.portraitReady){const clip=document.createElementNS(ns,'clipPath');clip.id='map-portrait-'+i;const shape=document.createElementNS(ns,'circle');shape.setAttribute('r','34');clip.append(shape);g.append(clip);const image=document.createElementNS(ns,'image');if(p.portrait||p.image)image.setAttribute('href',p.portrait||p.image);p.portraitReady?.then(portrait=>{if(portrait)image.setAttribute('href',portrait);});image.setAttribute('x','-34');image.setAttribute('y','-34');image.setAttribute('width','68');image.setAttribute('height','68');image.setAttribute('preserveAspectRatio','xMidYMin slice');image.setAttribute('clip-path','url(#map-portrait-'+i+')');g.append(image);}const label=document.createElementNS(ns,'text');label.setAttribute('y','62');label.setAttribute('text-anchor','middle');label.textContent=p.title;g.append(label);g.addEventListener('click',()=>select(i,true));g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(i,true);}});svg.append(g);return g;});
  // Measure the actual names, including loaded fonts, before reserving space.
  await document.fonts.ready;
  const bounds=nodes.map(node=>{const b=node.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height};});
  // Reuse only layouts whose character names, connections, and measured labels
  // still match. Editing a relationship automatically invalidates this cache.
  const layoutKey=JSON.stringify(['bonds-v7',profiles.map(p=>p.title),edges.map(({i,j,type,close,former,loveInterest})=>[i,j,type,close,former,loveInterest]),bounds]);
  let cached;
  try{cached=JSON.parse(localStorage.getItem('ml-wiki-relationship-layout'));}catch{}
  if(cached?.key===layoutKey&&Array.isArray(cached.points)&&cached.points.length===profiles.length&&cached.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))points=cached.points;
  else{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    points=await window.layoutWikiRelationships(profiles.length,edges,bounds);
    try{localStorage.setItem('ml-wiki-relationship-layout',JSON.stringify({key:layoutKey,points}));}catch{}
  }
  const shiftX=80-Math.min(...points.map((point,i)=>point.x+bounds[i].x));
  const shiftY=80-Math.min(...points.map((point,i)=>point.y+bounds[i].y));
  points.forEach((point,i)=>{point.x+=shiftX;point.y+=shiftY;nodes[i].setAttribute('transform',`translate(${point.x} ${point.y})`);});
  const mapWidth=Math.max(600,...points.map((point,i)=>point.x+bounds[i].x+bounds[i].width+80));
  const mapHeight=Math.max(500,...points.map((point,i)=>point.y+bounds[i].y+bounds[i].height+80));
  svg.setAttribute('viewBox',`0 0 ${mapWidth} ${mapHeight}`);
  edges.forEach(edge=>{for(const [key,value] of Object.entries({x1:points[edge.i].x,y1:points[edge.i].y,x2:points[edge.j].x,y2:points[edge.j].y}))edge.element.setAttribute(key,value);});
  let active=-1,zoom=.7;
  function matchesFilter(edge){return filter.value==='all'||filter.value===edge.type||filter.value==='affiliation'&&edge.shared.length>0;}
  function refresh(){edges.forEach(e=>{e.element.style.display=matchesFilter(e)?'':'none';e.element.classList.toggle('affiliation',e.type==='affiliation'||filter.value==='affiliation');e.element.classList.toggle('active',active===e.i||active===e.j);});nodes.forEach((n,i)=>{n.classList.toggle('active',i===active);n.setAttribute('aria-pressed',String(i===active));n.classList.toggle('muted',active>=0&&i!==active&&!edges.some(e=>(matchesFilter(e))&&(e.i===active&&e.j===i||e.j===active&&e.i===i)));});}
  function clearSelection(){active=-1;search.value='';refresh();drawer.open=false;drawer.hidden=true;details.replaceChildren();}
  function profileLink(profile){const node=make(profile.unpublished?'span':'a',profile.title);if(profile.unpublished){node.className='wiki-map-unpublished';node.title='Wiki page not yet available';node.setAttribute('aria-disabled','true');}else node.href=profile.path;return node;}
  function select(i,toggle=false){if(toggle&&active===i){clearSelection();return;}active=i;search.value=String(i);refresh();drawer.hidden=false;details.replaceChildren();const link=profileLink(profiles[i]);const list=make('ul');for(const e of edges.filter(e=>(e.i===i||e.j===i)&&(matchesFilter(e))).sort((a,b)=>(a.type==='personal'?0:1)-(b.type==='personal'?0:1)||profiles[a.i===i?a.j:a.i].title.localeCompare(profiles[b.i===i?b.j:b.i].title))){const other=profiles[e.i===i?e.j:e.i],item=make('li'),a=profileLink(other);item.append(a,document.createTextNode(': '+(filter.value==='affiliation'||e.type==='affiliation'?e.shared.join(', '):formatWikiRelationshipLabel(e.listLabels[i])+(e.type==='personal'&&e.shared.length?' · '+e.shared.join(', '):''))));list.append(item);}details.append(link,list.children.length?list:make('p','No documented connections to the other listed characters yet.'));tabHint.textContent=list.children.length+' connection'+(list.children.length===1?'':'s');}
  drawer.addEventListener('toggle',()=>{if(active>=0){viewport.scrollLeft=points[active].x*zoom-viewport.clientWidth/2;viewport.scrollTop=points[active].y*zoom-viewport.clientHeight/2;}});
  function size(){svg.style.width=mapWidth*zoom+'px';svg.style.height=mapHeight*zoom+'px';}
  function scale(value,anchorX=viewport.clientWidth/2,anchorY=viewport.clientHeight/2){const old=zoom;const x=(viewport.scrollLeft+anchorX)/old,y=(viewport.scrollTop+anchorY)/old;zoom=Math.max(.35,Math.min(1.6,value));size();viewport.scrollLeft=x*zoom-anchorX;viewport.scrollTop=y*zoom-anchorY;}
  const localPoint=(x,y)=>{const rect=viewport.getBoundingClientRect();return {x:x-rect.left-viewport.clientLeft,y:y-rect.top-viewport.clientTop};};
  let gesturing=false;
  viewport.addEventListener('wheel',event=>{event.preventDefault();if(gesturing)return;const point=localPoint(event.clientX,event.clientY);const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);scale(zoom*Math.exp(-Math.max(-150,Math.min(150,delta))*.003),point.x,point.y);},{passive:false});
  plus.addEventListener('click',()=>scale(zoom+.15));minus.addEventListener('click',()=>scale(zoom-.15));reset.addEventListener('click',()=>{clearSelection();zoom=.7;size();viewport.scrollLeft=(mapWidth*zoom-viewport.clientWidth)/2;viewport.scrollTop=(mapHeight*zoom-viewport.clientHeight)/2;details.replaceChildren();});
  search.addEventListener('change',()=>{if(search.value===''){clearSelection();return;}const i=Number(search.value);select(i);viewport.scrollLeft=points[i].x*zoom-viewport.clientWidth/2;viewport.scrollTop=points[i].y*zoom-viewport.clientHeight/2;});filter.addEventListener('change',()=>{refresh();if(active>=0)select(active);});
  viewport.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();clearSelection();}});
  const pointers=new Map();let drag=null,pinch=null,suppressClick=false,tapNode=null;
  const beginPinch=()=>{const [a,b]=[...pointers.values()];const point=localPoint((a.x+b.x)/2,(a.y+b.y)/2);pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,x:(viewport.scrollLeft+point.x)/zoom,y:(viewport.scrollTop+point.y)/zoom};drag=null;suppressClick=true;};
  viewport.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&(event.button!==0||event.target.closest('.wiki-map-node')))return;
    if(!pointers.size){suppressClick=false;tapNode=event.pointerType==='mouse'?null:event.target.closest('.wiki-map-node');}
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});viewport.setPointerCapture(event.pointerId);
    if(pointers.size===2)beginPinch();
    else if(pointers.size===1)drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
  });
  viewport.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&pointers.size>=2){const [a,b]=[...pointers.values()];const point=localPoint((a.x+b.x)/2,(a.y+b.y)/2);zoom=Math.max(.35,Math.min(1.6,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));size();viewport.scrollLeft=pinch.x*zoom-point.x;viewport.scrollTop=pinch.y*zoom-point.y;}
    else if(drag&&drag.id===event.pointerId){const dx=drag.x-event.clientX,dy=drag.y-event.clientY;if(Math.hypot(dx,dy)>6)suppressClick=true;viewport.scrollLeft=drag.left+dx;viewport.scrollTop=drag.top+dy;}
  });
  const endPointer=event=>{if(event.type==='pointerup'&&pointers.size===1&&tapNode&&!suppressClick){select(nodes.indexOf(tapNode),true);suppressClick=true;}tapNode=null;pointers.delete(event.pointerId);pinch=null;drag=null;if(pointers.size===1){const [id,point]=[...pointers.entries()][0];drag={id,x:point.x,y:point.y,left:viewport.scrollLeft,top:viewport.scrollTop};}else if(pointers.size>=2)beginPinch();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,endPointer);
  viewport.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
  // Safari trackpads can report gesture events instead of wheel events.
  let gestureZoom=zoom;
  viewport.addEventListener('gesturestart',event=>{event.preventDefault();gesturing=true;gestureZoom=zoom;},{passive:false});
  viewport.addEventListener('gesturechange',event=>{event.preventDefault();if(pointers.size>=2)return;const point=localPoint(event.clientX,event.clientY);scale(gestureZoom*event.scale,point.x,point.y);},{passive:false});
  viewport.addEventListener('gestureend',event=>{event.preventDefault();gesturing=false;},{passive:false});
  for(const control of [search,filter,minus,plus,reset])control.disabled=false;
  size();refresh();arranging.remove();svg.style.visibility='';viewport.setAttribute('aria-busy','false');details.replaceChildren();requestAnimationFrame(()=>{viewport.scrollLeft=(mapWidth*zoom-viewport.clientWidth)/2;viewport.scrollTop=(mapHeight*zoom-viewport.clientHeight)/2;});
})();
