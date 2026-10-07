/* Connections come from documented family/leader fields and shared affiliations. */
(async () => {
  const host=document.getElementById('wiki-relationship-map');if(!host)return;
  host.textContent='Loading character relationships…';
  const profiles=await window.wikiCharacterArchive;if(!profiles.length){host.textContent='The character archive could not be loaded. Please refresh to try again.';return;}
  host.replaceChildren();
  const make=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
  const tools=make('div');tools.className='wiki-map-tools';
  const search=make('select');search.setAttribute('aria-label','Jump to a character');search.append(new Option('Choose a character',''));profiles.forEach((p,i)=>search.append(new Option(p.title,String(i))));
  const minus=make('button','−'),plus=make('button','+'),reset=make('button','Reset view');for(const b of [minus,plus,reset])b.type='button';minus.setAttribute('aria-label','Zoom out');plus.setAttribute('aria-label','Zoom in');
  const filter=make('select');filter.setAttribute('aria-label','Relationship type');filter.append(new Option('All connections','all'),new Option('Personal relationships','personal'),new Option('Shared affiliations','affiliation'));
  tools.append(search,minus,plus,reset,filter);
  const guide=make('p','Select a character to highlight their connections. Drag to explore; use the mouse wheel, pinch, or + and − to zoom. Solid lines show personal ties. Dashed lines show shared affiliations.');guide.className='wiki-map-guide';
  const viewport=make('div');viewport.className='wiki-map-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','Scrollable character relationship map');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1800 1500');svg.setAttribute('role','group');svg.setAttribute('aria-label','Character relationships');viewport.append(svg);
  const details=make('div','Select a character to view their ties.');details.className='wiki-map-details';details.setAttribute('aria-live','polite');
  host.append(tools,guide,viewport,details);
  const edges=[];const canon=x=>x.toLowerCase().replace(/fandom:/g,'').replace(/[^a-z0-9]/g,'');
  for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){
    const a=profiles[i],b=profiles[j];let personal='';
    for(const [from,to] of [[a,b],[b,a]])for(const line of from.relations.split('\n')){
      const basename=to.path.split('/').pop();
      if(!line.startsWith('Relatives:')||!(canon(line).includes(canon(to.title))||line.includes(basename)))continue;
      const role=line.match(/\(([^)]+)\)/)?.[1]||'';
      // Friendship alone does not establish a personal connection on this map.
      if(/\b(friend|friends|friendship|ally|allies)\b/i.test(role))continue;
      if(/\b(mother|father|parent|son|daughter|child|brother|sister|sibling|uncle|aunt|cousin|nephew|niece|grandmother|grandfather|grandparent|grandchild|ancestor|descendant|relative|family|husband|wife|spouse|partner|love interest|fiancé|fiancée|lover)\b/i.test(role))personal=to.title+' is '+role+' of '+from.title;
    }
    const shared=a.affiliations.filter(x=>b.affiliations.includes(x));if(personal||shared.length)edges.push({i,j,type:personal?'personal':'affiliation',label:personal||shared.join(', ')});
  }
  const points=window.layoutWikiRelationships(profiles.length,edges);
  const lineGroup=document.createElementNS(ns,'g');svg.append(lineGroup);
  for(const e of edges){const line=document.createElementNS(ns,'line');for(const [key,v] of Object.entries({x1:points[e.i].x,y1:points[e.i].y,x2:points[e.j].x,y2:points[e.j].y}))line.setAttribute(key,v);line.classList.add('wiki-map-line',e.type);const title=document.createElementNS(ns,'title');title.textContent=profiles[e.i].title+' — '+profiles[e.j].title+': '+e.label;line.append(title);lineGroup.append(line);e.element=line;}
  const nodes=profiles.map((p,i)=>{const g=document.createElementNS(ns,'g');g.setAttribute('transform',`translate(${points[i].x} ${points[i].y})`);g.classList.add('wiki-map-node');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label','Show relationships for '+p.title);const c=document.createElementNS(ns,'circle');c.setAttribute('r','38');g.append(c);if(p.portrait||p.image){const clip=document.createElementNS(ns,'clipPath');clip.id='map-portrait-'+i;const shape=document.createElementNS(ns,'circle');shape.setAttribute('r','34');clip.append(shape);g.append(clip);const image=document.createElementNS(ns,'image');image.setAttribute('href',p.portrait||p.image);image.setAttribute('x','-34');image.setAttribute('y','-34');image.setAttribute('width','68');image.setAttribute('height','68');image.setAttribute('preserveAspectRatio','xMidYMin slice');image.setAttribute('clip-path','url(#map-portrait-'+i+')');g.append(image);}const label=document.createElementNS(ns,'text');label.setAttribute('y','62');label.setAttribute('text-anchor','middle');label.textContent=p.title;g.append(label);g.addEventListener('click',()=>select(i));g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(i);}});svg.append(g);return g;});
  let active=-1,zoom=.7;
  function refresh(){edges.forEach(e=>{e.element.style.display=filter.value==='all'||filter.value===e.type?'':'none';e.element.classList.toggle('active',active===e.i||active===e.j);});nodes.forEach((n,i)=>{n.classList.toggle('active',i===active);n.classList.toggle('muted',active>=0&&i!==active&&!edges.some(e=>(filter.value==='all'||filter.value===e.type)&&(e.i===active&&e.j===i||e.j===active&&e.i===i)));});}
  function select(i){active=i;search.value=String(i);refresh();details.replaceChildren();const link=make('a',profiles[i].title);link.href=profiles[i].path;const list=make('ul');for(const e of edges.filter(e=>(e.i===i||e.j===i)&&(filter.value==='all'||filter.value===e.type)).sort((a,b)=>(a.type==='personal'?0:1)-(b.type==='personal'?0:1)||profiles[a.i===i?a.j:a.i].title.localeCompare(profiles[b.i===i?b.j:b.i].title))){const other=profiles[e.i===i?e.j:e.i],item=make('li'),a=make('a',other.title);a.href=other.path;item.append(a,document.createTextNode(' — '+e.label));list.append(item);}details.append(link,list.children.length?list:make('p','No documented connections to the other published character pages yet.'));}
  function size(){svg.style.width=1800*zoom+'px';svg.style.height=1500*zoom+'px';}
  function scale(value,anchorX=viewport.clientWidth/2,anchorY=viewport.clientHeight/2){const old=zoom;const x=(viewport.scrollLeft+anchorX)/old,y=(viewport.scrollTop+anchorY)/old;zoom=Math.max(.35,Math.min(1.6,value));size();viewport.scrollLeft=x*zoom-anchorX;viewport.scrollTop=y*zoom-anchorY;}
  const localPoint=(x,y)=>{const rect=viewport.getBoundingClientRect();return {x:x-rect.left-viewport.clientLeft,y:y-rect.top-viewport.clientTop};};
  let gesturing=false;
  viewport.addEventListener('wheel',event=>{event.preventDefault();if(gesturing)return;const point=localPoint(event.clientX,event.clientY);const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);scale(zoom*Math.exp(-Math.max(-150,Math.min(150,delta))*.003),point.x,point.y);},{passive:false});
  plus.addEventListener('click',()=>scale(zoom+.15));minus.addEventListener('click',()=>scale(zoom-.15));reset.addEventListener('click',()=>{active=-1;search.value='';zoom=.7;size();refresh();viewport.scrollLeft=(1800*zoom-viewport.clientWidth)/2;viewport.scrollTop=(1500*zoom-viewport.clientHeight)/2;details.textContent='Select a character to view their ties.';});
  search.addEventListener('change',()=>{if(search.value==='')return;const i=Number(search.value);select(i);viewport.scrollLeft=points[i].x*zoom-viewport.clientWidth/2;viewport.scrollTop=points[i].y*zoom-viewport.clientHeight/2;});filter.addEventListener('change',()=>{refresh();if(active>=0)select(active);});
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
  const endPointer=event=>{if(event.type==='pointerup'&&pointers.size===1&&tapNode&&!suppressClick){select(nodes.indexOf(tapNode));suppressClick=true;}tapNode=null;pointers.delete(event.pointerId);pinch=null;drag=null;if(pointers.size===1){const [id,point]=[...pointers.entries()][0];drag={id,x:point.x,y:point.y,left:viewport.scrollLeft,top:viewport.scrollTop};}else if(pointers.size>=2)beginPinch();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,endPointer);
  viewport.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
  // Safari trackpads can report gesture events instead of wheel events.
  let gestureZoom=zoom;
  viewport.addEventListener('gesturestart',event=>{event.preventDefault();gesturing=true;gestureZoom=zoom;},{passive:false});
  viewport.addEventListener('gesturechange',event=>{event.preventDefault();if(pointers.size>=2)return;const point=localPoint(event.clientX,event.clientY);scale(gestureZoom*event.scale,point.x,point.y);},{passive:false});
  viewport.addEventListener('gestureend',event=>{event.preventDefault();gesturing=false;},{passive:false});
  size();refresh();requestAnimationFrame(()=>{viewport.scrollLeft=(1800*zoom-viewport.clientWidth)/2;viewport.scrollTop=(1500*zoom-viewport.clientHeight)/2;});
})();
