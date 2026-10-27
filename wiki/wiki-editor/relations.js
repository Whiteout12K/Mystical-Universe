import './visual.js';
import {validateRelations,characterKey,serializeRelations,writeRelationsFile,parseRelationsSource} from '/wiki/wiki-code/relations-data.js';
const $=id=>document.getElementById(id),local=['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname),draftKey='ml-relations-editor-draft-v1';
let activeRich=null,selectedRange=null;
let data,baseline='',folder=null,remembered=null,busy=false,olderDraft=null,mode='wiki',rawSource='';
const serialize=serializeRelations;
const dirty=()=>data&&(mode==='source'?rawSource!==baseline:serialize(data)!==baseline);
function status(message,error=false){$('relations-status').textContent=message;$('relations-status').classList.toggle('error',error);}
function controls(){
 $('character-filter').disabled=!data;
 $('relations-source').readOnly=!local||busy;
 $('format-source').disabled=!local||busy||!data;
 for(const id of ['wiki-mode','source-mode'])$(id).disabled=busy||!data;
 $('discard-relations').disabled=!local||busy||!dirty();
 $('save-relations').disabled=!local||!window.showDirectoryPicker||busy||!dirty();
 $('open-folder').disabled=!local||!window.showDirectoryPicker||busy;
 $('new-character').inert=!local||busy||!data;
 $('character-list').inert=!local||busy;
 for(const button of $('relations-format-toolbar').querySelectorAll('button'))button.disabled=!local||busy||!data;
}
function changed(){
 if(mode==='wiki')rawSource=serialize(data);
 const hasChanges=dirty();
 try{if(hasChanges)localStorage.setItem(draftKey,JSON.stringify({base:baseline,data,source:rawSource,mode}));else localStorage.removeItem(draftKey);}catch{}
 status(hasChanges?'Unsaved changes · saved as a draft in this browser.':'No unsaved changes.');controls();
}
function filter(){
 const query=$('character-filter').value.trim().toLowerCase();let visible=0;
 for(const card of $('character-list').children){card.hidden=!card.dataset.name.includes(query);if(!card.hidden)visible++;}
 $('character-count').textContent=visible+' / '+data.characters.length+' characters';
}
function make(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function field(text,value,handler){const label=make('label',text),input=make('input');input.value=value;input.addEventListener('input',()=>handler(input.value));label.append(input);return label;}
function card(entry){
 const panel=make('details');panel.className='character-card';panel.dataset.id=entry.id;panel.dataset.name=entry.name.toLowerCase();
 const summary=make('summary'),name=make('span',entry.name),meta=make('small',entry.path?'Wiki profile':'No wiki page yet');summary.append(name,meta);
 const fields=make('div');fields.className='character-fields';const metadata=make('div');metadata.className='character-meta';
 metadata.append(field('Character name',entry.name,value=>{entry.name=value;name.textContent=value||'Unnamed character';panel.dataset.name=value.toLowerCase();changed();}),field('Wiki page (optional)',entry.path,value=>{entry.path=value.trim();meta.textContent=entry.path?'Wiki profile':'No wiki page yet';changed();}));
 const richField=(title,key)=>{
  const label=make('fieldset'),legend=make('legend',title),rich=make('div');rich.className='relations-rich visual-editable';rich.dataset.characterField=key;rich.contentEditable='true';rich.setAttribute('role','textbox');rich.setAttribute('aria-label',title+' (wiki view)');rich.setAttribute('aria-multiline','true');WikiVisual.inline(rich,entry[key]||'','/images/character_art/');
  rich.addEventListener('input',()=>{entry[key]=WikiVisual.serialize(rich,{field:true}).trim();changed();});
  rich.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();document.execCommand('insertLineBreak',false);}});
  label.append(legend,rich);return label;
 };
 fields.append(metadata,richField('Relationships','relatives'),richField('Affiliations','affiliations'),make('p','One affiliation per line. Links, role notes, and spoilers work in both fields. Characters without wiki pages also appear on the map.'));
 panel.append(summary,fields);return panel;
}
function rememberRelationSelection(){
 const selection=getSelection();if(!selection?.rangeCount)return;
 const range=selection.getRangeAt(0),element=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
 const rich=element?.closest('.relations-rich');if(rich&&$('character-list').contains(rich)){activeRich=rich;selectedRange=range.cloneRange();}
}
document.addEventListener('selectionchange',rememberRelationSelection);
$('character-list').addEventListener('focusin',event=>{const rich=event.target.closest('.relations-rich');if(rich){if(activeRich!==rich)selectedRange=null;activeRich=rich;}});
$('relations-format-toolbar').addEventListener('pointerdown',event=>{if(event.target.closest('button')){rememberRelationSelection();event.preventDefault();}});
$('relations-format-toolbar').addEventListener('click',event=>{
 const button=event.target.closest('[data-insert]');if(!button||!local||busy)return;
 const rich=activeRich;if(!rich?.isConnected||!rich.closest('details').open){status('Click the relationship or affiliation text you want to edit first.');return;}
 const range=selectedRange&&rich.contains(selectedRange.commonAncestorContainer)?selectedRange.cloneRange():document.createRange();
 if(!selectedRange||!rich.contains(range.commonAncestorContainer)){range.selectNodeContents(rich);range.collapse(false);}
 let node,content;
 if(button.dataset.insert==='spoiler'){
  const start=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement,end=range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement;
  if(start.closest('.visual-spoiler')||end.closest('.visual-spoiler')||range.cloneContents().querySelector('.visual-spoiler')){status('Select text outside an existing spoiler to add another.');return;}
  const holder=make('div');WikiVisual.inline(holder,'{{Spoiler|Write spoiler text here.}}','/images/character_art/');node=holder.firstElementChild;content=node.querySelector('[data-spoiler-content]');
  if(!range.collapsed)content.replaceChildren(range.extractContents());
 }else{
  const target=prompt('Wiki page name or website link:');if(!target?.trim())return;
  node=make('a',range.toString()||target.trim());node.dataset.wikiTarget=target.trim();node.href='#';range.deleteContents();
 }
 range.insertNode(node);rich.focus({preventScroll:true});const next=document.createRange();
 if(content)next.selectNodeContents(content);else{next.setStartAfter(node);next.collapse(true);}
 const selection=getSelection();selection.removeAllRanges();selection.addRange(next);selectedRange=next.cloneRange();rich.dispatchEvent(new Event('input',{bubbles:true}));
});
function editRelationLink(link){
 if(!local||busy)return;
 const target=prompt('Link destination:',link.dataset.wikiTarget);if(target===null||!target.trim())return;
 link.dataset.wikiTarget=target.trim();link.closest('.relations-rich').dispatchEvent(new Event('input',{bubbles:true}));
}
let lastLinkTap=null,lastTouchEdit=0;
$('character-list').addEventListener('click',event=>{if(event.target.closest('.relations-rich a'))event.preventDefault();});
$('character-list').addEventListener('dblclick',event=>{const link=event.target.closest('.relations-rich a');if(link){event.preventDefault();if(Date.now()-lastTouchEdit>600)editRelationLink(link);}});
$('character-list').addEventListener('pointerup',event=>{
 if(event.pointerType!=='touch')return;const link=event.target.closest('.relations-rich a'),now=Date.now();
 if(link&&lastLinkTap?.link===link&&now-lastLinkTap.time<400&&Math.hypot(event.clientX-lastLinkTap.x,event.clientY-lastLinkTap.y)<24){lastLinkTap=null;lastTouchEdit=now;editRelationLink(link);}
 else lastLinkTap=link?{link,time:now,x:event.clientX,y:event.clientY}:null;
});
function render(){activeRich=null;selectedRange=null;const list=$('character-list'),open=new Set([...list.querySelectorAll('details[open]')].map(panel=>panel.dataset.id));list.replaceChildren(...data.characters.map(card));for(const panel of list.children)panel.open=open.has(panel.dataset.id);filter();paintMode();controls();}
function paintMode(){
 $('relations-format-toolbar').hidden=mode!=='wiki';
 $('relations-wiki-panel').hidden=mode!=='wiki';$('relations-source-panel').hidden=mode!=='source';
 for(const name of ['wiki','source']){$(name+'-mode').setAttribute('aria-selected',String(mode===name));$(name+'-mode').tabIndex=mode===name?0:-1;}
 if(mode==='source')$('relations-source').value=rawSource;
}
function switchMode(next){
 if(!data||busy||next===mode)return false;
 if(mode==='source')try{data=parseRelationsSource(rawSource);}catch(error){status('Source code could not be opened in Wiki view: '+error.message,true);return false;}
 else rawSource=serialize(data);
 mode=next;render();return true;
}
for(const name of ['wiki','source'])$(name+'-mode').addEventListener('click',()=>switchMode(name));
for(const name of ['wiki','source'])$(name+'-mode').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'wiki':event.key==='End'?'source':name==='wiki'?'source':'wiki';if(switchMode(next))$(next+'-mode').focus();}});
$('relations-source').addEventListener('input',()=>{
 rawSource=$('relations-source').value;changed();
 try{parseRelationsSource(rawSource);}catch(error){status('Source code has invalid JSON or character data. Your draft is kept: '+error.message,true);}
});
$('format-source').addEventListener('click',()=>{try{data=parseRelationsSource(rawSource);rawSource=serialize(data);$('relations-source').value=rawSource;changed();}catch(error){status(error.message,true);}});

async function folderStore(handle){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('mystical-wiki-editor',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('settings');request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings',handle?'readwrite':'readonly'),store=tx.objectStore('settings'),operation=handle?store.put(handle,'wiki-folder'):store.get('wiki-folder');tx.oncomplete=()=>{db.close();resolve(operation.result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};};
 });
}
async function openFolder(){
 const selected=await window.showDirectoryPicker({id:'mystical-wiki',mode:'readwrite'});
 if(selected.name!=='wiki')throw Error('Choose the wiki folder inside your website folder.');
 const handle=await selected.getFileHandle('relations.json');
 const latest=validateRelations(JSON.parse(await (await handle.getFile()).text()));
 if(serialize(latest)!==baseline)throw Error('This relations file differs from the one opened here. Reload this page to load it before saving. Your browser draft is retained.');
 folder=remembered=selected;try{await folderStore(folder);}catch{}
 status('Wiki folder connected. Save relations writes wiki/relations.json.');controls();
}
$('open-folder').addEventListener('click',()=>openFolder().catch(error=>{if(error.name!=='AbortError')status(error.message,true);}));
$('save-relations').addEventListener('click',async()=>{
 if(!local||busy||!dirty())return;
 try{
  if(mode==='source')data=parseRelationsSource(rawSource);
  validateRelations(data);busy=true;controls();
  if(!folder&&remembered){if(await remembered.queryPermission({mode:'readwrite'})==='granted'||await remembered.requestPermission({mode:'readwrite'})==='granted')folder=remembered;}
  if(!folder)await openFolder();
  if(await folder.queryPermission({mode:'readwrite'})!=='granted'&&await folder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Allow wiki folder access to save relations.');
  busy=true;controls();
  const handle=await folder.getFileHandle('relations.json'),content=await writeRelationsFile(handle,data,baseline);
  baseline=rawSource=content;if(mode==='source')$('relations-source').value=rawSource;try{localStorage.removeItem(draftKey);}catch{}
  status('Saved wiki/relations.json. Refresh wiki pages to see changes; your normal Git push publishes them.');
 }catch(error){if(error.name!=='AbortError')status(error.message,true);}finally{busy=false;controls();}
});
$('discard-relations').addEventListener('click',()=>{if(!dirty())return;data=JSON.parse(baseline);rawSource=baseline;try{localStorage.removeItem(draftKey);}catch{}render();status('Unsaved changes discarded.');});
$('recover-draft').addEventListener('click',()=>{if(!olderDraft)return;const url=URL.createObjectURL(new Blob([serialize(olderDraft)],{type:'application/json'})),link=make('a');link.href=url;link.download='relations-browser-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('character-filter').addEventListener('input',filter);
$('new-character').addEventListener('submit',event=>{
 event.preventDefault();if(!local||!data)return;const name=$('new-name').value.trim();if(!name)return;
 if(data.characters.some(entry=>characterKey(entry.name)===characterKey(name))){status('That character already exists. Find their bar to edit it.',true);return;}
 const base=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'character';let id=base,suffix=2;
 while(data.characters.some(entry=>entry.id===id))id=base+'_'+suffix++;
 const entry={id,name,path:'',relatives:'',affiliations:''};data.characters.push(entry);data.characters.sort((a,b)=>a.name.localeCompare(b.name));$('character-filter').value='';$('new-name').value='';render();changed();
 const panel=[...$('character-list').children].find(node=>node.dataset.id===id);panel.open=true;panel.scrollIntoView({block:'nearest'});panel.querySelector('.relations-rich').focus();
});
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
async function start(){
 controls();
 try{
  const response=await fetch('/wiki/relations.json',{cache:'no-store'});if(!response.ok)throw Error('The shared relationships could not load.');
  data=validateRelations(await response.json());baseline=rawSource=serialize(data);
  let restored=false,conflict=false;
  if(local)try{const draft=JSON.parse(localStorage.getItem(draftKey));if(draft?.base===baseline){rawSource=typeof draft.source==='string'?draft.source:serialize(draft.data);let valid=true;try{data=validateRelations(draft.data);}catch{data=JSON.parse(baseline);valid=false;}mode=draft.mode==='source'||!valid?'source':'wiki';restored=true;}else if(draft){olderDraft=validateRelations(draft.data);try{localStorage.setItem(draftKey+'-older',JSON.stringify(olderDraft));}catch{}conflict=true;}}catch{}
  if(local)try{olderDraft=olderDraft||validateRelations(JSON.parse(localStorage.getItem(draftKey+'-older')));$('recover-draft').hidden=false;}catch{}
  try{remembered=await folderStore();if(remembered&&await remembered.queryPermission({mode:'readwrite'})==='granted')folder=remembered;}catch{}
  render();
  status(!local?'Editing is available on localhost, like the Wiki Editor.':!window.showDirectoryPicker?'Use Chrome or Edge on localhost to save directly to your wiki folder.':conflict?'The file has changed since your older browser draft. Download that draft to keep a copy; the current shared file is shown here.':restored?'Restored your unsaved browser draft.':'Open a character to edit. First save connects your local wiki folder.',conflict);
 }catch(error){status(error.message,true);}
}
start();
