import {edgeDirection,wholeBookPage,touchAction} from './page-navigation.js';
const $=id=>document.getElementById(id);
const volumeId=new URLSearchParams(location.search).get('id')||'1';
const PREFS='ml-epub-preferences-v1',STATE='ml-epub-vol-'+encodeURIComponent(volumeId)+'-v1';
const defaults={size:22,font:'original',leading:'1.8',theme:'paper'};
const palettes={paper:{ink:'#332d28',link:'#856129',paper:'#faf7f0'},sepia:{ink:'#463824',link:'#775123',paper:'#eee0c6'},night:{ink:'#e1dace',link:'#dfbc77',paper:'#19191b'}};
const families={original:'"Crimson Text", Georgia, serif',serif:'Georgia, "Times New Roman", serif',sans:'Arial, system-ui, sans-serif'};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{$('saved-status').textContent='Reading progress cannot be saved in this browser.';return false;}};
const raw=read(PREFS,{}),settings={size:Math.max(16,Math.min(34,Number(raw.size)||22)),font:Object.hasOwn(families,raw.font)?raw.font:defaults.font,leading:['1.5','1.8','2.1'].includes(raw.leading)?raw.leading:defaults.leading,theme:Object.hasOwn(palettes,raw.theme)?raw.theme:defaults.theme};
const stored=read(STATE,{}),saved={layoutVersion:2,cfi:typeof stored.cfi==='string'?stored.cfi:null,bookmarks:Array.isArray(stored.bookmarks)?stored.bookmarks.filter(b=>typeof b.cfi==='string'&&typeof b.title==='string').slice(0,50):[]};
// The inserted Contents spine item moves subsequent package-CFI steps by two.
if(volumeId==='1'&&stored.layoutVersion!==2){
 const migrate=cfi=>cfi?.replace(/^(epubcfi\(\/6\/)(\d+)(\[reader-chapter-(\d+)\])?/,(_,prefix,n,assertion,chapter)=>Number(n)>=4?prefix+(Number(n)+2)+(chapter?'[reader-chapter-'+(Number(chapter)+1)+']':''):prefix+n+(assertion||''));
 saved.cfi=migrate(saved.cfi);saved.bookmarks=saved.bookmarks.map(b=>({...b,cfi:migrate(b.cfi)}));
}
let book,rendition,toc=[],current=null,index=0,loading=false,saveTimer,resizeTimer,settingsTimer,settingsAnchor=null,adjusting=false;
let pageCounts=null,countedLayout='',countTimer,countGeneration=0,bookRevision='vol-1',pageCounter=null,countingLayout='';
function status(message){$('status').textContent=message;}
function applyContent(contents){const root=contents.document.documentElement,palette=palettes[settings.theme];root.dataset.readerMode='paginated';contents.document.body.style.touchAction='pan-y';root.style.setProperty('font-size',settings.size+'px','important');root.style.setProperty('--reader-font',families[settings.font]);root.style.setProperty('--reader-leading',settings.leading);root.style.setProperty('--reader-ink',palette.ink);root.style.setProperty('--reader-link',palette.link);root.style.setProperty('background-color',palette.paper,'important');contents.document.body.style.setProperty('background-color',palette.paper,'important');}
function preferences(){document.body.dataset.theme=settings.theme;$('font-size').value=settings.size;$('font-size-value').textContent=settings.size+'px';$('font-family').value=settings.font;$('line-spacing').value=settings.leading;for(const b of document.querySelectorAll('[data-theme-choice]'))b.setAttribute('aria-pressed',String(b.dataset.themeChoice===settings.theme));for(const contents of rendition?.getContents()||[])applyContent(contents);}
function closeDialogs(){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();}
for(const [button,dialog]of [['contents-button','contents-dialog'],['settings-button','settings-dialog']])$(button).addEventListener('click',()=>{$(dialog).showModal();});
for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-close]'))dialog.close();});}
function savePreferences(){settingsAnchor=settingsAnchor||current?.start?.cfi;adjusting=true;preferences();write(PREFS,settings);clearTimeout(settingsTimer);settingsTimer=setTimeout(async()=>{const anchor=settingsAnchor;settingsAnchor=null;try{if(rendition&&!loading){rendition.resize();if(anchor)await rendition.display(anchor);}}catch{}finally{adjusting=false;if(current)relocated(current);schedulePageCount();}},220);}
$('font-size').addEventListener('input',e=>{settings.size=Number(e.target.value);savePreferences();});
for(const [id,key]of [['font-family','font'],['line-spacing','leading']])$(id).addEventListener('change',e=>{settings[key]=e.target.value;savePreferences();});
for(const button of document.querySelectorAll('[data-theme-choice]'))button.addEventListener('click',()=>{settings.theme=button.dataset.themeChoice;savePreferences();});
$('reset-settings').addEventListener('click',()=>{Object.assign(settings,defaults);savePreferences();});
function flatten(entries){return entries.flatMap(e=>[{label:e.label.trim(),href:e.href},...flatten(e.subitems||[])]);}
function renderContents(){const list=$('chapter-list');list.replaceChildren();toc.forEach((chapter,i)=>{const b=document.createElement('button');b.type='button';b.textContent=chapter.label;b.classList.toggle('current',i===index);if(i===index)b.setAttribute('aria-current','location');b.addEventListener('click',()=>{closeDialogs();go(chapter.href);});list.append(b);});}
function renderBookmarks(){const list=$('bookmarks');list.replaceChildren();if(!saved.bookmarks.length){const p=document.createElement('p');p.textContent='Mark a passage with ☆ while you read.';list.append(p);}for(const mark of saved.bookmarks){const row=document.createElement('div'),jump=document.createElement('button'),remove=document.createElement('button');jump.textContent=mark.title;jump.addEventListener('click',()=>{closeDialogs();go(mark.cfi);});remove.textContent='×';remove.setAttribute('aria-label','Remove bookmark for '+mark.title);remove.addEventListener('click',()=>{saved.bookmarks=saved.bookmarks.filter(b=>b.cfi!==mark.cfi);write(STATE,saved);renderBookmarks();updateBookmark();});row.append(jump,remove);list.append(row);}}
function updateBookmark(){const marked=saved.bookmarks.some(b=>b.cfi===current?.start?.cfi);$('bookmark-button').textContent=marked?'★':'☆';$('bookmark-button').setAttribute('aria-pressed',String(marked));$('bookmark-button').setAttribute('aria-label',marked?'Remove bookmark at this position':'Bookmark this position');$('bookmark-button').disabled=!current;}
$('bookmark-button').addEventListener('click',()=>{const cfi=current?.start?.cfi;if(!cfi)return;const existing=saved.bookmarks.some(b=>b.cfi===cfi);if(existing)saved.bookmarks=saved.bookmarks.filter(b=>b.cfi!==cfi);else saved.bookmarks.push({cfi,title:toc[index]?.label||'Reading position'});write(STATE,saved);renderBookmarks();updateBookmark();$('saved-status').textContent=existing?'Bookmark removed':'Bookmark saved';});
async function go(target){if(!rendition||loading)return;clearTimeout(settingsTimer);settingsAnchor=null;adjusting=false;loading=true;$('reader').setAttribute('aria-busy','true');try{await rendition.display(target);status('');}catch(error){console.error(error);status('This reading position could not be opened. Choose a chapter from Contents.');}finally{loading=false;$('reader').setAttribute('aria-busy','false');}}
function chapterIndex(location){const href=location?.start?.href||'';const match=toc.findIndex(c=>href.endsWith(c.href.split('#')[0]));return match<0?Math.max(0,location?.start?.index||0):match;}
function relocated(location){current=location;index=chapterIndex(location);$('chapter-name').textContent=toc[index]?.label||('Volume '+volumeId);
 const pages=location.start.displayed||{};
 if(pageCounts&&countedLayout===layoutKey())pageCounts[index]=pages.total||pageCounts[index];
 updatePageLabel();
 $('previous').disabled=!!location.atStart;$('next').disabled=!!location.atEnd;
 for(const [id,label]of [['previous','Previous'],['next','Next']]){$(id).setAttribute('aria-label',label+' page');$(id).querySelector('span').textContent=label+' page';}
 $('edge-previous').disabled=$('previous').disabled;$('edge-next').disabled=$('next').disabled;renderContents();updateBookmark();if(adjusting)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saved.cfi=location.start.cfi;write(STATE,saved);},350);schedulePageCount();
}
async function turn(direction){if(!rendition||loading||adjusting||document.querySelector('dialog[open]'))return;
 if(direction<0&&current?.atStart||direction>0&&current?.atEnd)return;
 loading=true;$('reader').setAttribute('aria-busy','true');
 try{await (direction>0?rendition.next():rendition.prev());status('');}catch(error){console.error(error);status('Could not turn this page. Select a chapter from Contents to continue.');}finally{loading=false;$('reader').setAttribute('aria-busy','false');}
}
$('previous').addEventListener('click',()=>turn(-1));$('next').addEventListener('click',()=>turn(1));$('edge-previous').addEventListener('click',()=>turn(-1));$('edge-next').addEventListener('click',()=>turn(1));
function pageKey(event){if(document.querySelector('dialog[open]')||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
 const direction=['ArrowRight','PageDown'].includes(event.key)?1:['ArrowLeft','PageUp'].includes(event.key)?-1:0;if(direction){event.preventDefault();turn(direction);}
}
document.addEventListener('keydown',pageKey);
$('resume').addEventListener('click',()=>{go(toc[0].href);$('resume').hidden=true;});
// Use physical screen edges even when the book's iframe is centered or paged sideways.
function edgeTap(event,sourceDocument,frame=null){
 if(event.defaultPrevented||event.pointerType!=='touch'&&event.detail>1||document.querySelector('dialog[open]')||sourceDocument.getSelection()?.toString()||rendition?.getContents().some(c=>c.document.getSelection()?.toString())||event.target.closest('a,button,input,select,textarea,[contenteditable=true]'))return;
 const frameBounds=(sourceDocument===document?null:sourceDocument.defaultView?.frameElement||frame)?.getBoundingClientRect(),x=event.clientX+(frameBounds?.left||0),y=event.clientY+(frameBounds?.top||0),bounds=$('reader').getBoundingClientRect(),width=document.documentElement.clientWidth;
 if(y<bounds.top||y>bounds.bottom)return;
 const direction=edgeDirection(x,width);if(direction){event.preventDefault();turn(direction);}
}
// Handle touch release directly: mobile EPUB views may suppress synthetic clicks.
function preventReaderZoom(doc){
 let viewport=doc.querySelector('meta[name="viewport"]');
 if(!viewport){viewport=doc.createElement('meta');viewport.name='viewport';doc.head.append(viewport);}
 viewport.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
 doc.documentElement.style.touchAction='pan-y';
 // Safari also exposes gesture events independently of Pointer Events.
 for(const type of ['gesturestart','gesturechange','gestureend'])doc.addEventListener(type,event=>event.preventDefault(),{passive:false});
 for(const type of ['touchstart','touchmove'])doc.addEventListener(type,event=>{if(event.touches.length>1)event.preventDefault();},{passive:false});
}
function connectPageInput(doc,frame=null){
 preventReaderZoom(doc);
 let pointer=null,ignoreClickUntil=0;
 const blocked=target=>target?.closest?.('a,button,input,select,textarea,[contenteditable=true]');
 const begin=(point,event)=>{pointer=blocked(event.target)?null:{x:point.clientX,y:point.clientY,time:Date.now()};};
 const finish=(point,event)=>{
  if(!pointer)return;
  const start=pointer;pointer=null;ignoreClickUntil=Date.now()+700;
  if(blocked(event.target)||doc.getSelection()?.toString()||document.querySelector('dialog[open]'))return;
  const action=touchAction(point.clientX-start.x,point.clientY-start.y,Date.now()-start.time);
  if(action==='next'||action==='previous'){event.preventDefault();turn(action==='next'?1:-1);}
  else if(action==='tap')edgeTap({clientX:point.clientX,clientY:point.clientY,target:event.target,pointerType:'touch',defaultPrevented:false,detail:1,preventDefault:()=>event.preventDefault()},doc,frame);
 };
 if(doc.defaultView.PointerEvent){
  doc.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')begin(event,event);});
  doc.addEventListener('pointerup',event=>{if(event.pointerType==='touch')finish(event,event);});
  doc.addEventListener('pointercancel',()=>{pointer=null;});
 }else{
  doc.addEventListener('touchstart',event=>{if(event.touches.length===1)begin(event.touches[0],event);else pointer=null;},{passive:true});
  doc.addEventListener('touchend',event=>{if(event.changedTouches.length===1)finish(event.changedTouches[0],event);},{passive:false});
  doc.addEventListener('touchcancel',()=>{pointer=null;});
 }
 doc.addEventListener('click',event=>{if(Date.now()<ignoreClickUntil)return;edgeTap(event,doc,frame);});
}
connectPageInput(document);
function connectContent(contents){applyContent(contents);const doc=contents.document;doc.addEventListener('keydown',pageKey);
 connectPageInput(doc,doc.defaultView.frameElement);
 for(const a of doc.querySelectorAll('a[href]'))if(/^https?:/i.test(a.getAttribute('href'))){a.target='_blank';a.rel='noopener noreferrer';}
}
function layoutKey(){const box=$('reader').getBoundingClientRect();return JSON.stringify(['pages-v1',bookRevision,toc.length,Math.round(box.width),Math.round(box.height),settings.size,settings.font,settings.leading,devicePixelRatio]);}
function updatePageLabel(){if(!current)return;const local=current.start.displayed||{};
 const progress=countedLayout===layoutKey()?wholeBookPage(pageCounts,index,local.page):null;
 $('chapter-progress').textContent=progress?`Volume page ${progress.page} of ${progress.total}`:'Volume pages · calculating…';
 $('section-progress').textContent=`Chapter page ${local.page||1} of ${local.total||1} · Section ${index+1}/${toc.length}`;
}
function schedulePageCount(){if(!rendition)return;
 const key=layoutKey();if(key===countedLayout||key===countingLayout)return;
 clearTimeout(countTimer);countGeneration++;pageCounts=null;countedLayout='';updatePageLabel();countTimer=setTimeout(()=>countBookPages(key,countGeneration),350);
}
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
async function countBookPages(key,generation){
 if(generation!==countGeneration)return;
 const cache=read('ml-epub-page-counts-v1',{}),cached=cache[key];
 if(Array.isArray(cached)&&cached.length===toc.length&&wholeBookPage(cached,0,1)){pageCounts=cached;countedLayout=key;updatePageLabel();return;}
 const box=$('reader').getBoundingClientRect(),host=document.createElement('div');host.className='page-measure';host.setAttribute('aria-hidden','true');host.inert=true;host.style.width=box.width+'px';host.style.height=box.height+'px';document.body.append(host);
 let meter;countingLayout=key;
 try{
  meter=new window.ePub.Rendition(book,{width:box.width,height:box.height,flow:'paginated',spread:'none',manager:'default',allowScriptedContent:false,allowPopups:false});pageCounter=meter;
  meter.hooks.content.register(applyContent);await meter.attachTo(host);const counts=[];
  for(const chapter of toc){
   if(generation!==countGeneration||key!==layoutKey())return;
   await meter.display(chapter.href);
   for(const contents of meter.getContents()){
    if(contents.document.fonts)await contents.document.fonts.ready;
    await Promise.all([...contents.document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{const finish=()=>{clearTimeout(timeout);img.removeEventListener('load',finish);img.removeEventListener('error',finish);resolve();};const timeout=setTimeout(finish,8000);img.addEventListener('load',finish,{once:true});img.addEventListener('error',finish,{once:true});})));
   }
   await nextPaint();const location=await meter.currentLocation(),count=location?.start?.displayed?.total;
   if(!Number.isInteger(count)||count<1)throw Error('Chapter page measurement unavailable.');counts.push(count);
  }
  if(generation!==countGeneration||key!==layoutKey())return;
  if(current?.start?.displayed?.total)counts[index]=current.start.displayed.total;
  pageCounts=counts;countedLayout=key;const entries=Object.entries(cache).slice(-7);write('ml-epub-page-counts-v1',Object.fromEntries([...entries,[key,counts]]));updatePageLabel();
 }catch(error){console.warn('Volume page count:',error);if(generation===countGeneration)$('chapter-progress').textContent='Volume page count unavailable';}
 finally{meter?.destroy();host.remove();if(pageCounter===meter)pageCounter=null;if(countingLayout===key)countingLayout='';}
}
async function start(){preferences();renderBookmarks();$('bookmark-button').disabled=true;
 try{if(typeof window.ePub!=='function')throw Error('The local reading library could not load.');
 const catalogResponse=await fetch('/books/catalog.json');if(!catalogResponse.ok)throw Error('The volume catalog could not load.');
 const catalog=await catalogResponse.json(),volume=catalog[volumeId];if(!volume)throw Error('This volume is not available yet.');
 const source=new URL(volume.source,location.origin);if(source.origin!==location.origin||!source.pathname.toLowerCase().endsWith('.epub'))throw Error('This volume needs a local EPUB file.');
 document.title=volume.title+' · Mystical Legends Reader';document.querySelector('.identity h1').textContent=volume.title;document.querySelector('.identity small').textContent=volume.label||'Mystical Legends';document.querySelector('.back').href='/books_main.html#book'+encodeURIComponent(volumeId);
 const response=await fetch(source);if(!response.ok)throw Error('The EPUB file could not load.');const bytes=await response.arrayBuffer();
 bookRevision=volume.source+':'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 book=window.ePub(bytes,{replacements:'blobUrl'});await book.ready;const navigation=await book.loaded.navigation;toc=flatten(navigation.toc);if(!toc.length)throw Error('No reading chapters were found.');renderContents();
 rendition=book.renderTo('reader',{width:'100%',height:'100%',flow:'paginated',spread:'none',manager:'default',allowScriptedContent:false,allowPopups:true});rendition.hooks.content.register(connectContent);rendition.on('relocated',relocated);rendition.on('displayError',error=>{console.error(error);status('This chapter could not load. Please reload or select another chapter.');});
 const chapter=Number(new URLSearchParams(location.search).get('chapter'));let target=chapter>0&&chapter<=toc.length?toc[chapter-1].href:saved.cfi||toc[0].href;
 try{await rendition.display(target);}catch{await rendition.display(toc[0].href);}
 if(saved.cfi){$('resume').textContent='Start over';$('resume').hidden=false;}
 status('');$('reader').setAttribute('aria-busy','false');
 schedulePageCount();
 window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{rendition.resize();schedulePageCount();},160);});
 window.addEventListener('pagehide',()=>{if(current?.start?.cfi){saved.cfi=current.start.cfi;write(STATE,saved);}});
 }catch(error){console.error(error);status(error.message+' Return to the Library or reload to try again.');$('reader').setAttribute('aria-busy','false');}}
start();
