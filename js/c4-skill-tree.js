(() => {
 'use strict';
 if ((new URLSearchParams(location.search).get('char') || 'c1').toLowerCase() !== 'c4') return;
 const el=id=>document.getElementById(id), tabs=[el('c4-skills-tab'),el('c4-tree-tab')];
 const view=el('c4-tree-viewport'),map=el('c4-tree-map'),dialog=el('c4-node-dialog');
 let data=null,effects={},loading=false,graphEdges=[],neighbors=new Map();
 let pageScroll=null;
 function lockPageScroll() {
  if(pageScroll)return;
  const body=document.body,root=document.documentElement;
  const properties=['position','top','left','width','overflow'];
  pageScroll={x:window.scrollX,y:window.scrollY,body:properties.map(key=>[key,body.style.getPropertyValue(key),body.style.getPropertyPriority(key)]),overflow:root.style.getPropertyValue('overflow'),priority:root.style.getPropertyPriority('overflow')};
  root.style.setProperty('overflow','hidden');
  body.style.position='fixed';body.style.top=`-${pageScroll.y}px`;body.style.left=`-${pageScroll.x}px`;body.style.width='100%';body.style.overflow='hidden';
 }
 dialog.addEventListener('close',()=>{
  if(!pageScroll)return;
  const saved=pageScroll;pageScroll=null;
  for(const [key,value,priority] of saved.body){if(value)document.body.style.setProperty(key,value,priority);else document.body.style.removeProperty(key);}
  if(saved.overflow)document.documentElement.style.setProperty('overflow',saved.overflow,saved.priority);else document.documentElement.style.removeProperty('overflow');
  window.scrollTo({left:saved.x,top:saved.y,behavior:'instant'});
 });
 el('c4-skill-tabs').hidden=false;el('skills-heading').hidden=true;el('skills-divider').hidden=true;
 el('skills-view').setAttribute('role','tabpanel');el('skills-view').setAttribute('aria-labelledby','c4-skills-tab');
 const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 function style(node,values={}) { for(const [key,value] of Object.entries(values))if(key in node.style)node.style[key]=typeof value==='number'?`${value}px`:value; }
 function rich(parent,text,values) { const p=make('div','c4-rich-text');p.innerHTML=embedded(text||'');style(p,values);parent.append(p); }
 function embedded(text,seen=new Set()) {
  return String(text).replace(/\{\{effect:([^}]+)\}\}/g,(_,id)=>effectHTML(id.trim(),seen));
 }
 function effectHTML(id,seen) {
  const effect=effects[id];if(!effect||seen.has(id))return '';
  const trail=new Set(seen);trail.add(id);
  const container=make('div','icon-container');container.style.paddingLeft='15px';container.style.paddingTop='10px';
  if(effect.icon){const icon=make('div','effect-icon');const image=document.createElement('img');image.src=effect.icon;image.alt=`${effect.name} Icon`;image.width=20;image.height=20;icon.append(image);container.append(icon);}
  const text=make('div','effect-text'),name=make('b',effect.class||'',`[${effect.name||id}]`);text.append(name);
  const keys=Object.keys(effect).filter(k=>/^description\d*$/.test(k)).sort((a,b)=>(a==='description'?1:Number(a.slice(11)))-(b==='description'?1:Number(b.slice(11))));
  keys.forEach((key,i)=>{const line=make('div','');style(line,effect[`${key}_style`]||(key==='description2'?effect.descrption2_style:null)||{});if(i===0){line.append(make('span',String(effect.type).toLowerCase()==='buff'?'buff':'debuff',effect.type||''),document.createTextNode(': '));}const content=make('span','');content.innerHTML=embedded(effect[key],trail);line.append(content);text.append(line);});container.append(text);return container.outerHTML;
 }
 function showNode(node) {
  el('c4-node-title').textContent=node.name;el('c4-node-level').textContent=node.id===data.rootId?'The beginning of your journey':'';el('c4-node-level').hidden=node.id!==data.rootId;
  const body=el('c4-node-body');body.replaceChildren();
  rich(body,node.description,node.description_style);
  for(const part of node.additional||[])rich(body,part.text,part.style);
  for(const stage of node.stages||[]){body.append(make('h3','',stage.name));rich(body,stage.text,stage.style);}
  const following=Object.values(data.nodes).filter(candidate=>candidate.before.includes(node.id)).map(candidate=>candidate.id);
  for(const [ids,label] of [[node.before,'Previous'],[following,'Next']]){
   if(!ids.length)continue;
   const section=make('section','c4-node-connections');section.append(make('h3','',label));
   for(const id of ids){const neighbor=data.nodes[id];if(!neighbor)continue;const link=make('button','c4-neighbor-link',neighbor.name);link.type='button';link.onclick=()=>{showNode(neighbor);dialog.scrollTop=0;};section.append(link);}
   body.append(section);
  }
  map.querySelectorAll('.c4-tree-node').forEach(button=>button.classList.toggle('c4-node-current',button.dataset.node===node.id));
  map.querySelectorAll('.c4-tree-edge').forEach(line=>line.classList.toggle('c4-edge-current',line.dataset.source===node.id||line.dataset.target===node.id));
  if(!dialog.open){dialog.showModal();lockPageScroll();}
 }
 el('c4-node-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 const space=el('c4-tree-space');
 let zoom=1,dragged=false,plane=null;
 const worldPosition=node=>({x:node.position.x-plane.offsetX,y:node.position.y-plane.offsetY});
 function setZoom(value,x=view.clientWidth/2,y=view.clientHeight/2) {
  if(!data)return;
  const worldX=(view.scrollLeft+x-(parseFloat(map.style.left)||0))/zoom,worldY=(view.scrollTop+y-(parseFloat(map.style.top)||0))/zoom;
  zoom=Math.max(.12,Math.min(1.8,value));
  const padX=Math.max(0,(view.clientWidth-plane.width*zoom)/2),padY=Math.max(0,(view.clientHeight-plane.height*zoom)/2);
  space.style.width=`${Math.max(view.clientWidth,plane.width*zoom)}px`;space.style.height=`${Math.max(view.clientHeight,plane.height*zoom)}px`;
  map.style.left=`${padX}px`;map.style.top=`${padY}px`;
  map.style.transform=`scale(${zoom})`;
  view.scrollLeft=worldX*zoom+padX-x;view.scrollTop=worldY*zoom+padY-y;
  el('c4-zoom-value').value=`${Math.round(zoom*100)}%`;
  el('c4-zoom-out').disabled=zoom<=.12;el('c4-zoom-in').disabled=zoom>=1.8;
 }
 function centerHeart() {
  if(!data)return;
  const heart=worldPosition(data.nodes[data.rootId]);
  view.scrollLeft=heart.x*zoom+(parseFloat(map.style.left)||0)-view.clientWidth/2;view.scrollTop=heart.y*zoom+(parseFloat(map.style.top)||0)-view.clientHeight/2;
 }
 function fitTree() {if(!data)return;setZoom(Math.min(view.clientWidth/plane.width,view.clientHeight/plane.height)*.94);centerHeart();}
 new ResizeObserver(()=>{if(data&&plane)setZoom(zoom);}).observe(view);
 el('c4-zoom-in').onclick=()=>setZoom(zoom*1.25);
 el('c4-zoom-out').onclick=()=>setZoom(zoom/1.25);
 el('c4-fit-tree').onclick=fitTree;
 el('c4-focus-heart').onclick=()=>{setZoom(1);centerHeart();};
 view.addEventListener('wheel',event=>{
  if(!(event.ctrlKey||event.metaKey)||!data)return;
  event.preventDefault();const r=view.getBoundingClientRect();setZoom(zoom*Math.exp(-event.deltaY*.006),event.clientX-r.left,event.clientY-r.top);
 },{passive:false});
 const pointers=new Map();let gesture=null;
 function beginGesture() {
  const points=[...pointers.values()];if(!points.length){gesture=null;return;}
  const midpoint=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
  gesture={x:midpoint.x,y:midpoint.y,left:view.scrollLeft,top:view.scrollTop,zoom,distance:points.length>1?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0};
 }
 view.addEventListener('pointerdown',event=>{
  if(event.button!==0||!data)return;
  if(!pointers.size)dragged=false;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});event.target.setPointerCapture(event.pointerId);beginGesture();
 });
 view.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId)||!gesture)return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const points=[...pointers.values()];
  const point=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
  if(points.length>1){
   dragged=true;const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),r=view.getBoundingClientRect();
   setZoom(gesture.zoom*distance/Math.max(1,gesture.distance),point.x-r.left,point.y-r.top);beginGesture();
  }else if(Math.hypot(point.x-gesture.x,point.y-gesture.y)>5||dragged){
   dragged=true;view.scrollLeft=gesture.left-(point.x-gesture.x);view.scrollTop=gesture.top-(point.y-gesture.y);
  }
  view.classList.toggle('c4-plane-dragging',dragged);
 });
 function endPointer(event){pointers.delete(event.pointerId);beginGesture();if(!pointers.size)view.classList.remove('c4-plane-dragging');}
 view.addEventListener('pointerup',endPointer);view.addEventListener('pointercancel',endPointer);
 view.addEventListener('click',event=>{if(dragged&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
 view.addEventListener('keydown',event=>{
  if(event.target!==view)return;
  const moves={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,-100],ArrowDown:[0,100]};
  if(moves[event.key]){event.preventDefault();view.scrollBy(...moves[event.key]);}
  else if(event.key==='+'||event.key==='='){event.preventDefault();setZoom(zoom*1.25);}
  else if(event.key==='-'){event.preventDefault();setZoom(zoom/1.25);}
  else if(event.key==='Home'){event.preventDefault();centerHeart();}
 });
 function draw() {
  map.replaceChildren();
  const connectedNodes=Object.values(data.nodes).filter(node=>neighbors.get(node.id)?.size);
  const positions=connectedNodes.map(node=>node.position);
  const offsetX=Math.min(0,...positions.map(p=>p.x-160)),offsetY=Math.min(0,...positions.map(p=>p.y-160));
  plane={offsetX,offsetY,width:Math.max(data.layout.width,...positions.map(p=>p.x+160))-offsetX,height:Math.max(data.layout.height,...positions.map(p=>p.y+160))-offsetY};
  const {width,height}=plane;
  map.style.width=`${width}px`;map.style.height=`${height}px`;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-hidden','true');svg.classList.add('c4-tree-lines');
  const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker'),arrow=document.createElementNS(ns,'path');
  marker.id='c4-direction';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','8');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','5');marker.setAttribute('orient','auto');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');arrow.setAttribute('fill','#a88845');marker.append(arrow);defs.append(marker);svg.append(defs);
  for(const [source,target] of graphEdges){
   const node=data.nodes[source],peer=data.nodes[target];
   const a=worldPosition(node),b=worldPosition(peer),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
   const line=document.createElementNS(ns,'path');line.classList.add('c4-tree-edge');line.dataset.source=source;line.dataset.target=target;
   const startRadius=source===data.rootId?54:38,endRadius=target===data.rootId?54:38;
   const x1=a.x+dx/length*startRadius,y1=a.y+dy/length*startRadius,x2=b.x-dx/length*endRadius,y2=b.y-dy/length*endRadius;
   line.setAttribute('d',`M ${x1} ${y1} L ${x2} ${y2}`);svg.append(line);
  }
  map.append(svg);
  for(const node of connectedNodes){
   const wrap=make('div',`c4-tree-point${node.id===data.rootId?' c4-heart-point':''}`);const position=worldPosition(node);wrap.style.left=`${position.x}px`;wrap.style.top=`${position.y}px`;
   const button=make('button',`c4-tree-node${node.id===data.rootId?' c4-tree-heart':''}`);button.type='button';button.title=node.name;button.dataset.node=node.id;button.setAttribute('aria-label',node.name);
   if(node.icon){const image=document.createElement('img');image.src=node.icon;image.alt='';image.loading='lazy';image.decoding='async';button.append(image);}
   button.onclick=()=>showNode(node);wrap.append(button,make('span','c4-tree-label',node.name));map.append(wrap);
  }
  setZoom(1);centerHeart();
 }
 async function load() {
  if(data||loading)return;loading=true;el('c4-tree-status').hidden=false;el('c4-tree-status').textContent='Opening the skill tree…';view.setAttribute('aria-busy','true');
  try {const [response,effectResponse]=await Promise.all([fetch('/images/mlg-assets/Characters/C4/skill-tree.json',{cache:'no-cache'}),fetch('/images/mlg-assets/data-effects.json',{cache:'no-cache'})]);if(!response.ok||!effectResponse.ok)throw Error();const [result,definitions]=await Promise.all([response.json(),effectResponse.json()]);if(!result.nodes?.[result.rootId]||!result.layout)throw Error();
   // A before reference joins both nodes, without requiring a reverse field.
   const edges=new Map();
   neighbors=new Map(Object.keys(result.nodes).map(id=>[id,new Set()]));
   for(const [id,node] of Object.entries(result.nodes)){
    node.id=id;
    node.before=[...new Set((Array.isArray(node.before)?node.before:[]).filter(target=>target!==id&&Object.hasOwn(result.nodes,target)))];
    for(const target of node.before){
     const pair=[id,target].sort().join(':');
     if(!edges.has(pair))edges.set(pair,[target,id]);
     neighbors.get(id).add(target);neighbors.get(target).add(id);
    }
   }
   for(const [id,node] of Object.entries(result.nodes)){
    const count=neighbors.get(id).size;
    if(count>4)throw Error();
    if(count&&(!node.position||!Number.isFinite(node.position.x)||!Number.isFinite(node.position.y)))throw Error();
   }
   graphEdges=[...edges.values()];
   effects=definitions;data=result;draw();el('c4-tree-status').hidden=true;}
  catch {el('c4-tree-status').textContent='The skill tree could not be loaded. ';const retry=make('button','c4-tree-retry','Try again');retry.type='button';retry.onclick=load;el('c4-tree-status').append(retry);}
  finally {loading=false;view.setAttribute('aria-busy','false');}
 }
 function select(index) {tabs.forEach((t,i)=>{t.setAttribute('aria-selected',String(i===index));t.tabIndex=i===index?0:-1;});el('skills-view').hidden=index!==0;el('c4-tree-view').hidden=index!==1;if(index===1)load();}
 tabs.forEach((tab,i)=>{tab.onclick=()=>select(i);tab.onkeydown=e=>{const next=e.key==='Home'?0:e.key==='End'?1:e.key==='ArrowRight'||e.key==='ArrowLeft'?1-i:null;if(next!==null){e.preventDefault();select(next);tabs[next].focus();}};});
})();
