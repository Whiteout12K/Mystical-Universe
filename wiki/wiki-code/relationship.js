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
  function ties(from,to){
    const matches=[];
    const names=new Set([canon(to.title),canon(to.path.split('/').pop())]);
    for(const line of from.relations.split('\n')){
      const colon=line.indexOf(':');if(colon<0)continue;
      const field=line.slice(0,colon),value=line.slice(colon+1);
      if(['Leader','Subordinates'].includes(field))continue;
      const entries=[...value.matchAll(/\[\[([^\]]+)\]\]\s*(?:\(([^)]+)\))?/g)];
      if(entries.length){for(const entry of entries){const [target,label]=entry[1].split('|');const key=target.replace(/^fandom:/,'').split('/').pop();if(!names.has(canon(key))&&!names.has(canon(label||'')))continue;const role=entry[2]||'';matches.push({role:['Relatives','Relationships'].includes(field)?role:field+' '+role,mutual:/\b(mutual|reciprocated|both sides)\b/i.test(role)});}}
      else{const role=value.match(/\(([^)]+)\)/)?.[1]||'';const name=value.replace(/\([^)]*\)/g,'').trim();if(names.has(canon(name)))matches.push({role:['Relatives','Relationships'].includes(field)?role:field+' '+role,mutual:/\b(mutual|reciprocated|both sides)\b/i.test(role)});}
    }
    return matches.filter(tie=>! /\b(friend|friends|friendship|ally|allies)\b/i.test(tie.role));
  }
  const romantic=role=>/\b(love interests?|crush|girlfriend|boyfriend|partner|husband|wife|spouse|fiancé|fiancée|lover)\b/i.test(role);
  const feelings=role=>/\b(love interests?|crush)\b/i.test(role);
  const family=role=>/\b(mother|father|parent|son|daughter|child|brother|sister|sibling|uncle|aunt|cousin|nephew|niece|grandmother|grandfather|grandparent|grandchild|ancestor|descendant|relative|family)\b/i.test(role);
  const spiritual=role=>/\b(host|vess[ea]l|anchored spirit|spiritual bond)\b/i.test(role);
  function listRole(own,reverse){
    const direct=own.find(t=>romantic(t.role))||own.find(t=>family(t.role))||own.find(t=>spiritual(t.role));
    if(direct)return direct.role.trim().toLowerCase();
    const other=reverse.find(t=>romantic(t.role))||reverse.find(t=>family(t.role))||reverse.find(t=>spiritual(t.role));
    if(!other)return '';
    const role=other.role.toLowerCase();
    if(spiritual(role))return /vess[ea]l/.test(role)?'host':/host/.test(role)?'vessel':'spiritual bond';
    if(feelings(role))return 'love interest';
    if(romantic(role))return /husband|wife|spouse/.test(role)?'spouse':'partner';
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
      if((ar&&br||ar?.mutual||br?.mutual)&&(feelings(ar?.role||'')||feelings(br?.role||'')))personal=a.title+' and '+b.title+' have feelings for each other.';
      else{const tie=ar||br,from=ar?a:b,to=ar?b:a;
        personal=feelings(tie.role)?from.title+' has feelings for '+to.title+'; reciprocal feelings are not documented.':to.title+' is '+from.title+'’s '+tie.role.trim().toLowerCase()+'.';}
    }
    if(!personal)for(const [from,to,found] of [[a,b,ab],[b,a,ba]]){const tie=found.find(t=>family(t.role)||spiritual(t.role));if(tie){personal=to.title+' is '+tie.role+' of '+from.title;break;}}
    const shared=a.affiliations.filter(x=>b.affiliations.includes(x));if(personal||shared.length)edges.push({i,j,type:personal?'personal':'affiliation',close:ab.concat(ba).some(t=>family(t.role)||spiritual(t.role)),label:personal||shared.join(', '),listLabels:{[i]:personal?listRole(ab,ba):shared.join(', '),[j]:personal?listRole(ba,ab):shared.join(', ')}});
  }
  const points=window.layoutWikiRelationships(profiles.length,edges);
  const lineGroup=document.createElementNS(ns,'g');svg.append(lineGroup);
  for(const e of edges){const line=document.createElementNS(ns,'line');for(const [key,value] of Object.entries({x1:points[e.i].x,y1:points[e.i].y,x2:points[e.j].x,y2:points[e.j].y}))line.setAttribute(key,value);line.classList.add('wiki-map-line',e.type);const title=document.createElementNS(ns,'title');title.textContent=profiles[e.i].title+' — '+profiles[e.j].title+': '+e.label;line.append(title);lineGroup.append(line);e.element=line;}
  const nodes=profiles.map((p,i)=>{const g=document.createElementNS(ns,'g');g.setAttribute('transform',`translate(${points[i].x} ${points[i].y})`);g.classList.add('wiki-map-node');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label','Show relationships for '+p.title);const c=document.createElementNS(ns,'circle');c.setAttribute('r','38');g.append(c);if(p.portrait||p.image){const clip=document.createElementNS(ns,'clipPath');clip.id='map-portrait-'+i;const shape=document.createElementNS(ns,'circle');shape.setAttribute('r','34');clip.append(shape);g.append(clip);const image=document.createElementNS(ns,'image');image.setAttribute('href',p.portrait||p.image);image.setAttribute('x','-34');image.setAttribute('y','-34');image.setAttribute('width','68');image.setAttribute('height','68');image.setAttribute('preserveAspectRatio','xMidYMin slice');image.setAttribute('clip-path','url(#map-portrait-'+i+')');g.append(image);}const label=document.createElementNS(ns,'text');label.setAttribute('y','62');label.setAttribute('text-anchor','middle');label.textContent=p.title;g.append(label);g.addEventListener('click',()=>select(i,true));g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(i,true);}});svg.append(g);return g;});
  // Measure the actual names, including loaded fonts, before reserving space.
  await document.fonts.ready;
  const bounds=nodes.map(node=>node.getBBox()),padding=18;
  let spread=1;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=bounds[i],b=bounds[j],dx=points[j].x-points[i].x,dy=points[j].y-points[i].y;
    const gapX=dx>=0?a.x+a.width-b.x+padding:b.x+b.width-a.x+padding;
    const gapY=dy>=0?a.y+a.height-b.y+padding:b.y+b.height-a.y+padding;
    // Either horizontal or vertical separation protects both icon and label.
    spread=Math.max(spread,Math.min(Math.abs(dx)>0?gapX/Math.abs(dx):Infinity,Math.abs(dy)>0?gapY/Math.abs(dy):Infinity));
  }
  points.forEach(point=>{point.x=900+(point.x-900)*spread;point.y=750+(point.y-750)*spread;});
  // Compact locally: one crowded name must not push the entire map outward.
  const center={x:900,y:750};
  function separated(i,j){const a=bounds[i],b=bounds[j],p=points[i],q=points[j];return p.x+a.x+a.width+padding<=q.x+b.x||q.x+b.x+b.width+padding<=p.x+a.x||p.y+a.y+a.height+padding<=q.y+b.y||q.y+b.y+b.height+padding<=p.y+a.y;}
  function compactCost(i){
    if(points.some((_,j)=>j!==i&&!separated(i,j)))return Infinity;
    let cost=Math.pow(Math.hypot(points[i].x-center.x,points[i].y-center.y),2)*.25;
    for(const edge of edges){const a=points[edge.i],b=points[edge.j],dx=b.x-a.x,dy=b.y-a.y;
      if(edge.i===i||edge.j===i){const length=Math.hypot(dx,dy);cost+=edge.close?Math.pow(length-160,2)*40:Math.pow(Math.max(0,length-250),2)*.15;}
      for(let k=0;k<points.length;k++)if(k!==edge.i&&k!==edge.j&&(k===i||edge.i===i||edge.j===i)){
        const p=points[k],t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
        cost+=Math.pow(Math.max(0,56-Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)),2)*1200;
      }
    }
    return cost;
  }
  for(const step of [80,40,20,10,4,2])for(let sweep=0;sweep<30;sweep++){
    let moved=false;
    for(let i=0;i<points.length;i++){
      const original={...points[i]};let best=original,bestCost=compactCost(i);
      for(let direction=0;direction<16;direction++){const angle=direction*Math.PI/8;points[i]={x:original.x+Math.cos(angle)*step,y:original.y+Math.sin(angle)*step};const cost=compactCost(i);if(cost<bestCost-.01){bestCost=cost;best={...points[i]};}}
      points[i]=best;if(best!==original)moved=true;
    }
    if(!moved)break;
  }
  const shiftX=80-Math.min(...points.map((point,i)=>point.x+bounds[i].x));
  const shiftY=80-Math.min(...points.map((point,i)=>point.y+bounds[i].y));
  points.forEach((point,i)=>{point.x+=shiftX;point.y+=shiftY;nodes[i].setAttribute('transform',`translate(${point.x} ${point.y})`);});
  const mapWidth=Math.max(600,...points.map((point,i)=>point.x+bounds[i].x+bounds[i].width+80));
  const mapHeight=Math.max(500,...points.map((point,i)=>point.y+bounds[i].y+bounds[i].height+80));
  svg.setAttribute('viewBox',`0 0 ${mapWidth} ${mapHeight}`);
  edges.forEach(edge=>{for(const [key,value] of Object.entries({x1:points[edge.i].x,y1:points[edge.i].y,x2:points[edge.j].x,y2:points[edge.j].y}))edge.element.setAttribute(key,value);});
  let active=-1,zoom=.7;
  function refresh(){edges.forEach(e=>{e.element.style.display=filter.value==='all'||filter.value===e.type?'':'none';e.element.classList.toggle('active',active===e.i||active===e.j);});nodes.forEach((n,i)=>{n.classList.toggle('active',i===active);n.setAttribute('aria-pressed',String(i===active));n.classList.toggle('muted',active>=0&&i!==active&&!edges.some(e=>(filter.value==='all'||filter.value===e.type)&&(e.i===active&&e.j===i||e.j===active&&e.i===i)));});}
  function clearSelection(){active=-1;search.value='';refresh();details.textContent='Select a character to view their ties.';}
  function select(i,toggle=false){if(toggle&&active===i){clearSelection();return;}active=i;search.value=String(i);refresh();details.replaceChildren();const link=make('a',profiles[i].title);link.href=profiles[i].path;const list=make('ul');for(const e of edges.filter(e=>(e.i===i||e.j===i)&&(filter.value==='all'||filter.value===e.type)).sort((a,b)=>(a.type==='personal'?0:1)-(b.type==='personal'?0:1)||profiles[a.i===i?a.j:a.i].title.localeCompare(profiles[b.i===i?b.j:b.i].title))){const other=profiles[e.i===i?e.j:e.i],item=make('li'),a=make('a',other.title);a.href=other.path;item.append(a,document.createTextNode(': '+e.listLabels[i].replace(/\b\p{L}/gu,letter=>letter.toUpperCase())));list.append(item);}details.append(link,list.children.length?list:make('p','No documented connections to the other published character pages yet.'));}
  function size(){svg.style.width=mapWidth*zoom+'px';svg.style.height=mapHeight*zoom+'px';}
  function scale(value,anchorX=viewport.clientWidth/2,anchorY=viewport.clientHeight/2){const old=zoom;const x=(viewport.scrollLeft+anchorX)/old,y=(viewport.scrollTop+anchorY)/old;zoom=Math.max(.35,Math.min(1.6,value));size();viewport.scrollLeft=x*zoom-anchorX;viewport.scrollTop=y*zoom-anchorY;}
  const localPoint=(x,y)=>{const rect=viewport.getBoundingClientRect();return {x:x-rect.left-viewport.clientLeft,y:y-rect.top-viewport.clientTop};};
  let gesturing=false;
  viewport.addEventListener('wheel',event=>{event.preventDefault();if(gesturing)return;const point=localPoint(event.clientX,event.clientY);const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);scale(zoom*Math.exp(-Math.max(-150,Math.min(150,delta))*.003),point.x,point.y);},{passive:false});
  plus.addEventListener('click',()=>scale(zoom+.15));minus.addEventListener('click',()=>scale(zoom-.15));reset.addEventListener('click',()=>{active=-1;search.value='';zoom=.7;size();refresh();viewport.scrollLeft=(mapWidth*zoom-viewport.clientWidth)/2;viewport.scrollTop=(mapHeight*zoom-viewport.clientHeight)/2;details.textContent='Select a character to view their ties.';});
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
  size();refresh();requestAnimationFrame(()=>{viewport.scrollLeft=(mapWidth*zoom-viewport.clientWidth)/2;viewport.scrollTop=(mapHeight*zoom-viewport.clientHeight)/2;});
})();
