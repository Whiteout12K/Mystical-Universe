import {edgeDirection,wholeBookPage,touchAction} from './page-navigation.js';
import {resolveChapterLink,readerChapterURL} from './book-links.js';
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
let book,rendition,toc=[],current=null,index=0,loading=false,resizeTimer,settingsTimer,settingsAnchor=null,adjusting=false;
let pageCounts=[],countedLayout='',bookRevision='';
let contentsBuilt=false,activeContentsIndex=-1,savePositionTimer;
let readerReady=false,preparing=null;
function status(message){$('status').textContent=message;}
function applyContent(contents){const root=contents.document.documentElement,palette=palettes[settings.theme];root.dataset.readerMode='paginated';contents.document.body.style.touchAction='pan-y';contents.document.body.style.setProperty('user-select','text','important');contents.document.body.style.setProperty('-webkit-user-select','text','important');contents.document.body.style.setProperty('-webkit-touch-callout','default','important');root.style.setProperty('font-size',settings.size+'px','important');root.style.setProperty('--reader-font',families[settings.font]);root.style.setProperty('--reader-leading',settings.leading);root.style.setProperty('--reader-ink',palette.ink);root.style.setProperty('--reader-link',palette.link);root.style.setProperty('background-color',palette.paper,'important');contents.document.body.style.setProperty('background-color',palette.paper,'important');}
function preferences(){document.body.dataset.theme=settings.theme;$('font-size').value=settings.size;$('font-size-value').textContent=settings.size+'px';$('font-family').value=settings.font;$('line-spacing').value=settings.leading;for(const b of document.querySelectorAll('[data-theme-choice]'))b.setAttribute('aria-pressed',String(b.dataset.themeChoice===settings.theme));for(const contents of rendition?.getContents()||[])applyContent(contents);}
function closeDialogs(){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();}
for(const [button,dialog]of [['contents-button','contents-dialog'],['settings-button','settings-dialog']])$(button).addEventListener('click',()=>{$(dialog).showModal();});
for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-close]'))dialog.close();});}
function savePreferences(){settingsAnchor=settingsAnchor||current?.start?.cfi;adjusting=true;preferences();write(PREFS,settings);clearTimeout(settingsTimer);settingsTimer=setTimeout(async()=>{const anchor=settingsAnchor;settingsAnchor=null;try{if(rendition&&!loading){rendition.resize();await prepareBook(anchor);}}catch{}finally{adjusting=false;if(current)relocated(current);updatePageLabel();}},220);}
$('font-size').addEventListener('input',e=>{settings.size=Number(e.target.value);savePreferences();});
for(const [id,key]of [['font-family','font'],['line-spacing','leading']])$(id).addEventListener('change',e=>{settings[key]=e.target.value;savePreferences();});
for(const button of document.querySelectorAll('[data-theme-choice]'))button.addEventListener('click',()=>{settings.theme=button.dataset.themeChoice;savePreferences();});
$('reset-settings').addEventListener('click',()=>{Object.assign(settings,defaults);savePreferences();});
function flatten(entries){return entries.flatMap(e=>[{label:e.label.trim(),href:e.href},...flatten(e.subitems||[])]);}
function renderContents(){
 const list=$('chapter-list');
 if(!contentsBuilt){
  const fragment=document.createDocumentFragment();
  toc.forEach(chapter=>{const button=document.createElement('button');button.type='button';button.textContent=chapter.label;button.addEventListener('click',()=>{closeDialogs();go(chapter.href);});fragment.append(button);});
  list.replaceChildren(fragment);contentsBuilt=true;
 }
 if(activeContentsIndex===index)return;
 const previous=list.children[activeContentsIndex],next=list.children[index];
 previous?.classList.remove('current');previous?.removeAttribute('aria-current');next?.classList.add('current');next?.setAttribute('aria-current','location');activeContentsIndex=index;
}
function renderBookmarks(){const list=$('bookmarks');list.replaceChildren();if(!saved.bookmarks.length){const p=document.createElement('p');p.textContent='Mark a passage with ☆ while you read.';list.append(p);}for(const mark of saved.bookmarks){const row=document.createElement('div'),jump=document.createElement('button'),remove=document.createElement('button');jump.textContent=mark.title;jump.addEventListener('click',()=>{closeDialogs();go(mark.cfi);});remove.textContent='×';remove.setAttribute('aria-label','Remove bookmark for '+mark.title);remove.addEventListener('click',()=>{saved.bookmarks=saved.bookmarks.filter(b=>b.cfi!==mark.cfi);write(STATE,saved);renderBookmarks();updateBookmark();});row.append(jump,remove);list.append(row);}}
function updateBookmark(){const marked=saved.bookmarks.some(b=>b.cfi===current?.start?.cfi);$('bookmark-button').textContent=marked?'★':'☆';$('bookmark-button').setAttribute('aria-pressed',String(marked));$('bookmark-button').setAttribute('aria-label',marked?'Remove bookmark at this position':'Bookmark this position');$('bookmark-button').disabled=!current;}
$('bookmark-button').addEventListener('click',()=>{const cfi=current?.start?.cfi;if(!cfi)return;const existing=saved.bookmarks.some(b=>b.cfi===cfi);if(existing)saved.bookmarks=saved.bookmarks.filter(b=>b.cfi!==cfi);else saved.bookmarks.push({cfi,title:toc[index]?.label||'Reading position'});write(STATE,saved);renderBookmarks();updateBookmark();$('saved-status').textContent=existing?'Bookmark removed':'Bookmark saved';});
async function go(target){if(!readerReady||!rendition||loading)return;clearTimeout(settingsTimer);settingsAnchor=null;adjusting=false;loading=true;$('reader').setAttribute('aria-busy','true');try{await rendition.display(target);status('');}catch(error){console.error(error);status('This reading position could not be opened. Choose a chapter from Contents.');}finally{loading=false;$('reader').setAttribute('aria-busy','false');}}
function chapterIndex(location){const href=location?.start?.href||'';const match=toc.findIndex(c=>href.endsWith(c.href.split('#')[0]));return match<0?Math.max(0,location?.start?.index||0):match;}
function saveReadingPosition(){
 if(!readerReady||!current?.start?.cfi)return;
 saved.cfi=current.start.cfi;write(STATE,saved);
 write('ml-reading-current',{id:volumeId,cfi:saved.cfi,chapter:toc[index]?.label||'',updatedAt:Date.now()});
}
function relocated(location){current=location;index=chapterIndex(location);if(!readerReady)return;$('chapter-name').textContent=toc[index]?.label||('Volume '+volumeId);
 const pages=location.start.displayed||{};
 rememberChapterPages(location.start.index,pages.total);
 updatePageLabel();
 $('previous').disabled=!!location.atStart;$('next').disabled=!!location.atEnd;
 for(const [id,label]of [['previous','Previous'],['next','Next']]){$(id).setAttribute('aria-label',label+' page');$(id).querySelector('span').textContent=label+' page';}
 $('edge-previous').disabled=$('previous').disabled;$('edge-next').disabled=$('next').disabled;renderContents();updateBookmark();if(adjusting)return;clearTimeout(savePositionTimer);savePositionTimer=setTimeout(saveReadingPosition,180);
}
async function turn(direction){if(!readerReady||!rendition||loading||adjusting||document.querySelector('dialog[open]'))return;
 if(direction<0&&current?.atStart||direction>0&&current?.atEnd)return;
 loading=true;$('reader').setAttribute('aria-busy','true');
 try{await (direction>0?rendition.next():rendition.prev());status('');}catch(error){console.error(error);status('Could not turn this page. Select a chapter from Contents to continue.');}finally{loading=false;$('reader').setAttribute('aria-busy','false');}
}
$('previous').addEventListener('click',()=>turn(-1));$('next').addEventListener('click',()=>turn(1));$('edge-previous').addEventListener('click',()=>turn(-1));$('edge-next').addEventListener('click',()=>turn(1));
function pageKey(event){if(!readerReady||document.querySelector('dialog[open]')||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
 const direction=['ArrowRight','PageDown'].includes(event.key)?1:['ArrowLeft','PageUp'].includes(event.key)?-1:0;if(direction){event.preventDefault();turn(direction);}
}
document.addEventListener('keydown',pageKey);
$('resume').addEventListener('click',()=>{go(toc[0].href);$('resume').hidden=true;});
// Use physical screen edges even when the book's iframe is centered or paged sideways.
function edgeTap(event,sourceDocument,frame=null){
 if(!readerReady||event.defaultPrevented||event.pointerType!=='touch'&&event.detail>1||document.querySelector('dialog[open]')||sourceDocument.getSelection()?.toString()||rendition?.getContents().some(c=>c.document.getSelection()?.toString())||event.target?.closest?.('a,button,input,select,textarea,[contenteditable=true]'))return;
 const insideBook=sourceDocument!==document,frameBounds=(insideBook?sourceDocument.defaultView?.frameElement||frame:null)?.getBoundingClientRect();
 const width=document.documentElement.clientWidth;
 let x=event.clientX+(frameBounds?.left||0);
 // Safari touch coordinates can already refer to the top-level viewport while
 // the paginated iframe itself is translated off-screen. Screen X is stable.
 if(insideBook&&event.pointerType==='touch'&&Number.isFinite(event.screenX)&&(event.screenX>0||event.clientX===0)){
  const screenX=event.screenX-(window.screenX||0);
  if(screenX>=0&&screenX<=width)x=screenX;
 }
 if((x<0||x>width)&&event.clientX>=0&&event.clientX<=width)x=event.clientX;
 // An event from the book document is already inside the reading surface.
 if(!insideBook){const bounds=$('reader').getBoundingClientRect();if(event.clientY<bounds.top||event.clientY>bounds.bottom)return;}
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
 const begin=(point,event,kind)=>{pointer=blocked(event.target)?null:{x:point.clientX,y:point.clientY,time:Date.now(),moved:0,kind,selected:!!doc.getSelection()?.toString()};};
 const move=point=>{if(pointer)pointer.moved=Math.max(pointer.moved,Math.abs(point.clientX-pointer.x),Math.abs(point.clientY-pointer.y));};
 const finish=(point,event,kind)=>{
  if(!pointer||pointer.kind!==kind)return;
  const start=pointer;pointer=null;ignoreClickUntil=Date.now()+700;
  if(start.selected||blocked(event.target)||doc.getSelection()?.toString()||document.querySelector('dialog[open]'))return;
  const action=touchAction(point.clientX-start.x,point.clientY-start.y,Date.now()-start.time);
  if(action==='tap'&&start.moved>16)return;
  if(action==='next'||action==='previous'){event.preventDefault();turn(action==='next'?1:-1);}
  else if(action==='tap')edgeTap({clientX:point.clientX,clientY:point.clientY,screenX:point.screenX,target:event.target,pointerType:'touch',defaultPrevented:false,detail:1,preventDefault:()=>event.preventDefault()},doc,frame);
 };
 // Listen to both APIs. A native touchstart takes ownership, so pointerup and
 // the compatibility click cannot turn the page a second time.
 doc.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){if(event.isPrimary===false)pointer=null;else if(pointer?.kind!=='touch')begin(event,event,'pointer');}},{passive:true,capture:true});
 doc.addEventListener('pointermove',event=>{if(pointer?.kind==='pointer'&&event.pointerType==='touch')move(event);},{passive:true,capture:true});
 doc.addEventListener('pointerup',event=>{if(event.pointerType==='touch')finish(event,event,'pointer');},{passive:false,capture:true});
 doc.addEventListener('pointercancel',()=>{if(pointer?.kind==='pointer')pointer=null;},{passive:true,capture:true});
 doc.addEventListener('touchstart',event=>{if(event.touches.length===1)begin(event.touches[0],event,'touch');else pointer=null;},{passive:true,capture:true});
 doc.addEventListener('touchmove',event=>{if(event.touches.length===1)move(event.touches[0]);else pointer=null;},{passive:true,capture:true});
 doc.addEventListener('touchend',event=>{if(event.touches.length===0&&event.changedTouches.length===1)finish(event.changedTouches[0],event,'touch');else pointer=null;},{passive:false,capture:true});
 doc.addEventListener('touchcancel',()=>{pointer=null;},{passive:true,capture:true});
 doc.addEventListener('click',event=>{if(Date.now()<ignoreClickUntil)return;edgeTap(event,doc,frame);});
}
connectPageInput(document);
function connectContent(contents){
 applyContent(contents);const doc=contents.document;doc.addEventListener('keydown',pageKey);
 connectPageInput(doc,doc.defaultView.frameElement);
 const section=book.spine.get(contents.sectionIndex);
 document.querySelector('.reader-stage').dataset.contentsPage=String(!!doc.querySelector('.reader-contents')||[...doc.querySelectorAll('nav')].some(nav=>(nav.getAttributeNS('http://www.idpf.org/2007/ops','type')||'').split(/\s+/).includes('toc')));
 // Store the archive target separately from the real, shareable link address.
 for(const anchor of doc.querySelectorAll('a[href]')){
  const raw=anchor.getAttribute('href');
  const target=anchor.dataset.epubTarget||resolveChapterLink(raw,section.url,book.spine.spineItems,location.origin);
  if(target){anchor.onclick=null;anchor.dataset.epubTarget=target;anchor.href=readerChapterURL(target,volumeId,location.origin);anchor.target='_top';}
  else if(/^https?:/i.test(raw)){anchor.target='_blank';anchor.rel='noopener noreferrer';}
 }
 doc.addEventListener('click',event=>{
  const anchor=event.target.closest?.('a[href]');if(!anchor)return;
  if(anchor.dataset.epubTarget){
   if(event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();event.stopImmediatePropagation();go(anchor.dataset.epubTarget);
  }else if(!/^(https?:|mailto:)/i.test(anchor.getAttribute('href'))){event.preventDefault();event.stopImmediatePropagation();status('This link does not point to an available chapter. Choose a chapter from Contents.');}
 },true);
}
function layoutKey(){const box=$('reader').getBoundingClientRect();return JSON.stringify(['pages-v2',bookRevision,book.spine.spineItems.length,Math.round(box.width),Math.round(box.height),settings.size,settings.font,settings.leading,devicePixelRatio]);}
function rememberChapterPages(section,total){
 const key=layoutKey();
 if(key!==countedLayout){
  const cached=read('ml-epub-page-counts-v2',{})[key];
  pageCounts=Array.isArray(cached)&&cached.length===book.spine.spineItems.length?cached:Array(book.spine.spineItems.length).fill(null);countedLayout=key;
 }
 if(!Number.isInteger(section)||!Number.isInteger(total)||total<1||pageCounts[section]===total)return;
 pageCounts[section]=total;
 const cache=read('ml-epub-page-counts-v2',{});delete cache[key];cache[key]=pageCounts;
 write('ml-epub-page-counts-v2',Object.fromEntries(Object.entries(cache).slice(-4)));
}
function updatePageLabel(){
 if(!current)return;const local=current.start.displayed||{};
 const progress=countedLayout===layoutKey()?wholeBookPage(pageCounts,current.start.index,local.page):null;
 $('chapter-progress').textContent=progress?`Volume page ${progress.page} of ${progress.total}`:`Chapter page ${local.page||1} of ${local.total||1}`;
 $('section-progress').textContent=progress?`Chapter page ${local.page||1} of ${local.total||1} · Section ${index+1}/${toc.length}`:`Section ${index+1} of ${toc.length} · Calculating volume pages…`;
}
// Use the one real reader to paginate behind its loading screen, then restore
// the reading position. Nothing continues rendering in the background afterward.
async function waitForPage(){
 let timeout;
 try{
  await Promise.race([
   Promise.all(rendition.getContents().flatMap(contents=>[contents.document.fonts?.ready,...[...contents.document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))])),
   new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Book images or fonts did not finish loading. Please retry.')),10000);})
  ]);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 }finally{clearTimeout(timeout);}
}
function preparingUI(active){
 document.querySelector('.reader-stage').dataset.loading=String(active);
 $('reader').inert=active;$('reader').setAttribute('aria-busy',String(active));
 for(const id of ['contents-button','settings-button','bookmark-button','previous','next','edge-previous','edge-next','resume'])$(id).disabled=active;
}
async function prepareBook(target){
 if(preparing)return preparing;
 readerReady=false;loading=true;preparingUI(true);$('pagination-retry').hidden=true;
 preparing=(async()=>{
  while(true){
   const key=layoutKey();rememberChapterPages(-1,0);
   let complete=pageCounts.filter(n=>Number.isInteger(n)&&n>0).length;
   $('pagination-progress').max=book.spine.spineItems.length;$('pagination-progress').value=complete;
   $('pagination-message').textContent=complete===pageCounts.length?'Opening your saved page…':`Preparing volume pages · ${complete} of ${pageCounts.length} sections`;
   for(let section=0;section<pageCounts.length;section++){
    if(key!==layoutKey())break;
    if(Number.isInteger(pageCounts[section])&&pageCounts[section]>0)continue;
    await rendition.display(book.spine.spineItems[section].href);await waitForPage();
    if(key!==layoutKey())break;
    const position=await rendition.currentLocation(),total=position?.start?.displayed?.total;
    if(!Number.isInteger(total)||total<1)throw Error('The volume page count could not be calculated. Please retry.');
    rememberChapterPages(section,total);complete++;
    $('pagination-progress').value=complete;$('pagination-message').textContent=`Preparing volume pages · ${complete} of ${pageCounts.length} sections`;
   }
   if(key!==layoutKey())continue;
   try{await rendition.display(target||toc[0].href);}catch{await rendition.display(toc[0].href);}
   await waitForPage();if(key!==layoutKey())continue;
   current=await rendition.currentLocation();break;
  }
  readerReady=true;loading=false;preparingUI(false);status('');relocated(current);
 })();
 try{await preparing;}catch(error){$('pagination-message').textContent=error.message;$('pagination-retry').hidden=false;throw error;}finally{preparing=null;}
}
$('pagination-retry').addEventListener('click',()=>{if(book&&rendition)prepareBook(saved.cfi||toc[0].href).catch(console.error);else location.reload();});
// Give native chapter links a user-activated route out of the script-free
// EPUB frame. Set this before loading srcdoc; book scripts remain disabled.
function nativeNavigationView(BaseView){
 return class extends BaseView{
  create(){const frame=super.create();frame.sandbox.add('allow-top-navigation-by-user-activation');return frame;}
 };
}
async function start(){preferences();renderBookmarks();preparingUI(true);
 try{if(typeof window.ePub!=='function')throw Error('The local reading library could not load.');
 const catalogResponse=await fetch('/books/catalog.json');if(!catalogResponse.ok)throw Error('The volume catalog could not load.');
 const catalog=await catalogResponse.json(),volume=catalog[volumeId];if(!volume)throw Error('This volume is not available yet.');
 const source=new URL(volume.source,location.origin);if(source.origin!==location.origin||!source.pathname.toLowerCase().endsWith('.epub'))throw Error('This volume needs a local EPUB file.');
 document.title=volume.title+' · Mystical Legends Reader';document.querySelector('.identity h1').textContent=volume.title;document.querySelector('.identity small').textContent=volume.label||'Mystical Legends';document.querySelector('.back').href='/books_main.html#book'+encodeURIComponent(volumeId);
 const response=await fetch(source);if(!response.ok)throw Error('The EPUB file could not load.');const bytes=await response.arrayBuffer();
 bookRevision=volume.source+':'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 book=window.ePub(bytes,{replacements:'blobUrl'});await book.ready;const navigation=await book.loaded.navigation;toc=flatten(navigation.toc).map(chapter=>({...chapter,href:resolveChapterLink(chapter.href,book.path.resolve(book.packaging.navPath||'nav.xhtml'),book.spine.spineItems,location.origin)||chapter.href}));if(!toc.length)throw Error('No reading chapters were found.');renderContents();
 const ReaderView=nativeNavigationView(window.ePub.Rendition.prototype.requireView('iframe'));
 rendition=book.renderTo('reader',{view:ReaderView,width:'100%',height:'100%',flow:'paginated',spread:'none',manager:'default',allowScriptedContent:false,allowPopups:true});rendition.hooks.content.register(connectContent);rendition.on('relocated',relocated);rendition.on('displayError',error=>{console.error(error);status('This chapter could not load. Please reload or select another chapter.');});
 const params=new URLSearchParams(location.search),chapter=Number(params.get('chapter'));
 const requested=book.spine.spineItems.find(section=>section.href===params.get('section'));
 let target=requested?requested.href+location.hash:chapter>0&&chapter<=toc.length?toc[chapter-1].href:saved.cfi||toc[0].href;
 status('');await prepareBook(target);
 if(saved.cfi){$('resume').textContent='Start over';$('resume').hidden=false;}
 status('');$('reader').setAttribute('aria-busy','false');
 updatePageLabel();
 window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const anchor=current?.start?.cfi;rendition.resize();if(readerReady)prepareBook(anchor).catch(console.error);},160);});
 window.addEventListener('pagehide',()=>{clearTimeout(savePositionTimer);saveReadingPosition();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(savePositionTimer);saveReadingPosition();}});
 }catch(error){console.error(error);status(error.message+' Return to the Library or reload to try again.');$('pagination-message').textContent=error.message;$('pagination-retry').hidden=false;}}
start();
