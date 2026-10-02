(() => {
 'use strict';
 if ((new URLSearchParams(location.search).get('char') || 'c1').toLowerCase() !== 'c4') return;
 const el=id=>document.getElementById(id), tabs=[el('c4-skills-tab'),el('c4-tree-tab')];
 const view=el('c4-tree-viewport'),map=el('c4-tree-map'),dialog=el('c4-node-dialog');
 let data=null,effects={},loading=false;
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
 function showNode(node,level) {
  el('c4-node-title').textContent=node.name;el('c4-node-level').textContent=level?`Level ${level.level} · ${level.name}`:'The beginning of your journey';
  const body=el('c4-node-body');body.replaceChildren();
  if(node.group)body.append(make('p','c4-node-requirement',node.group));
  if(node.prerequisite)body.append(make('p','c4-node-requirement',`Requires: ${node.prerequisite}`));
  rich(body,node.description,node.description_style);
  for(const part of node.additional||[])rich(body,part.text,part.style);
  for(const stage of node.stages||[]){body.append(make('h3','',stage.name));rich(body,stage.text,stage.style);}
  dialog.showModal();
 }
 el('c4-node-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 function draw() {
  map.replaceChildren();
  function imageNode(node,level){
   const button=make('button',`c4-tree-node${level?'':' c4-tree-heart'}`);button.type='button';button.title=node.name;
   button.setAttribute('aria-label',`${node.name}${level?`, Level ${level.level}: ${level.name}`:''}`);
   if(node.icon){const image=document.createElement('img');image.src=node.icon;image.alt='';image.width=56;image.height=56;image.loading='lazy';image.decoding='async';button.append(image);}button.onclick=()=>showNode(node,level);return button;
  }
  const origin=make('section','c4-tree-row c4-tree-origin');origin.dataset.level='Heart';const dot=make('span','c4-level-mark','0');dot.setAttribute('aria-hidden','true');
  const originBody=make('div','c4-level-content');originBody.append(make('h3','','The Heart'),imageNode(data.Heart,null));origin.append(dot,originBody);map.append(origin);
  for(const level of Object.values(data).filter(v=>v.level)){
   const row=make('section','c4-tree-row');row.dataset.level=`L${level.level}`;row.setAttribute('aria-label',`Level ${level.level}: ${level.name}`);
   const mark=make('span','c4-level-mark',String(level.level));mark.setAttribute('aria-hidden','true');const content=make('div','c4-level-content');content.append(make('h3','',`Level ${level.level} · ${level.name}`));
   const requirements=make('div','c4-level-requirements');rich(requirements,level.description,level.description_style);for(const part of level.additional||[])rich(requirements,part.text,part.style);content.append(requirements);
   const groups=[...new Set(level.nodes.map(n=>n.group||''))];
   for(const group of groups){if(group)content.append(make('h4','c4-node-group',group));const nodes=make('div','c4-level-nodes');for(const node of level.nodes.filter(n=>(n.group||'')===group))nodes.append(imageNode(node,level));content.append(nodes);}
   row.append(mark,content);map.append(row);
  }
 }
 async function load() {
  if(data||loading)return;loading=true;el('c4-tree-status').hidden=false;el('c4-tree-status').textContent='Opening the skill tree…';view.setAttribute('aria-busy','true');
  try {const [response,effectResponse]=await Promise.all([fetch('/images/mlg-assets/Characters/C4/skill-tree.json',{cache:'no-cache'}),fetch('/images/mlg-assets/data-effects.json',{cache:'no-cache'})]);if(!response.ok||!effectResponse.ok)throw Error();const [result,definitions]=await Promise.all([response.json(),effectResponse.json()]);if(!result.Heart||!result.L9)throw Error();effects=definitions;data=result;draw();el('c4-tree-status').hidden=true;}
  catch {el('c4-tree-status').textContent='The skill tree could not be loaded. ';const retry=make('button','c4-tree-retry','Try again');retry.type='button';retry.onclick=load;el('c4-tree-status').append(retry);}
  finally {loading=false;view.setAttribute('aria-busy','false');}
 }
 function select(index) {tabs.forEach((t,i)=>{t.setAttribute('aria-selected',String(i===index));t.tabIndex=i===index?0:-1;});el('skills-view').hidden=index!==0;el('c4-tree-view').hidden=index!==1;if(index===1)load();}
 tabs.forEach((tab,i)=>{tab.onclick=()=>select(i);tab.onkeydown=e=>{const next=e.key==='Home'?0:e.key==='End'?1:e.key==='ArrowRight'||e.key==='ArrowLeft'?1-i:null;if(next!==null){e.preventDefault();select(next);tabs[next].focus();}};});
})();
