(() => {
  const $ = id => document.getElementById(id);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
  const state = {page:null, source:'', saved:'', pages:[], folder:null, remembered:null, handles:new Map(), mode:'visual', busy:false, history:[], historyIndex:0, lastEdit:0, lastBlock:null};
  const status = (text, error=false) => { $('status').textContent=text; $('status').classList.toggle('error',error); };
  function controls() {
    const dirty=state.source!==state.saved;
    $('save').disabled=!state.page||!dirty||state.busy||!window.showDirectoryPicker;
    $('discard').disabled=!state.page||!dirty||state.busy;
    $('undo').disabled=state.busy||state.historyIndex<=0;
    $('redo').disabled=state.busy||state.historyIndex>=state.history.length-1;
    $('insert-content').disabled=!state.page||state.busy;
    $('change-state').textContent=state.busy?'Saving…':!state.page?'Choose a page':dirty?'Unsaved changes':'Saved';
  }
  function resetHistory(){state.history=[state.source];state.historyIndex=0;state.lastEdit=0;}
  function changeSource(value,options={}){
    if(options.structural||state.mode==='visual')value=WikiVisual.compactSource(value);
    if(value===state.source)return;
    const now=Date.now();state.history=state.history.slice(0,state.historyIndex+1);
    if(!options.structural&&state.lastEdit&&now-state.lastEdit<500&&state.historyIndex>0)state.history[state.historyIndex]=value;
    else{state.history.push(value);state.historyIndex++;if(state.history.length>100){state.history.shift();state.historyIndex--;}}
    state.lastEdit=options.structural?0:now;state.source=value;controls();
    if(options.render)render();
  }
  function historyStep(direction){const index=state.historyIndex+direction;if(state.busy||index<0||index>=state.history.length)return;state.historyIndex=index;state.source=state.history[index];state.lastEdit=0;render();status(direction<0?'Last change undone.':'Change restored.');}
  const wikiSource=/<script\b[^>]*\btype\s*=\s*["']text\/x-wiki["'][^>]*>([\s\S]*?)<\/script\s*>/i;
  async function readPage(path){
    const handle=state.handles.get(path);
    let html;
    if(handle)html=await (await handle.getFile()).text();
    else{const response=await fetch('/wiki/'+path,{cache:'no-store'});if(!response.ok)throw Error('Unable to load this wiki page.');html=await response.text();}
    const match=wikiSource.exec(html);
    if(!match)throw Error('This file has no editable wiki text block.');
    return {path,html,source:WikiVisual.compactSource(match[1]),revision:html};
  }
  async function savePage(){
    if(state.folder&&await state.folder.queryPermission({mode:'readwrite'})!=='granted'&&await state.folder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Allow wiki folder access to save directly to this HTML file.');
    if(!state.folder){
      const folder=state.remembered||await window.showDirectoryPicker({id:'mystical-wiki',mode:'readwrite'});
      if(folder.name!=='wiki')throw Error('Select the wiki folder inside your website folder.');
      if(await folder.queryPermission({mode:'readwrite'})!=='granted'&&await folder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Allow wiki folder access to save.');
      state.folder=folder;state.remembered=folder;await rememberFolder(folder);await refresh();
    }
    const handle=state.handles.get(state.page.path);
    if(!handle)throw Error('This page is missing from the selected wiki folder.');
    const latest=await readPage(state.page.path);
    if(latest.revision!==state.page.revision)throw Error('This file changed outside the editor. Copy your edits, then reopen the page to load the latest version.');
    if(/<\/script\b/i.test(state.source))throw Error('Wiki text cannot contain a closing script tag.');
    if(await state.folder.queryPermission({mode:'readwrite'})!=='granted'&&await state.folder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Allow folder access to save your changes.');
    state.source=WikiVisual.compactSource(state.source);
    const html=latest.html.replace(wikiSource,(full)=>{const start=full.indexOf('>')+1,end=full.lastIndexOf('</');return full.slice(0,start)+state.source+full.slice(end);});
    const writable=await handle.createWritable();
    try{await writable.write(html);await writable.close();}catch(error){await writable.abort().catch(()=>{});throw error;}
    return {html,revision:html};
  }
  async function folderStore(handle){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open('mystical-wiki-editor',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('settings');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result,transaction=db.transaction('settings',handle?'readwrite':'readonly'),store=transaction.objectStore('settings');
        const operation=handle?store.put(handle,'wiki-folder'):store.get('wiki-folder');
        transaction.oncomplete=()=>{db.close();resolve(operation.result);};
        transaction.onerror=()=>{db.close();reject(transaction.error);};
        transaction.onabort=()=>{db.close();reject(transaction.error);};
      };
    });
  }
  async function rememberFolder(folder){try{await folderStore(folder);}catch{/* Folder persistence is optional. */}}
  async function discoverPages(){
    const response=await fetch('/sitemap.xml',{cache:'no-store'});
    if(!response.ok)throw Error('No wiki index found. Open Wiki Folder once to discover all local pages.');
    const xml=new DOMParser().parseFromString(await response.text(),'application/xml'),paths=new Set();
    for(const entry of xml.querySelectorAll('loc')){
      const pathname=decodeURIComponent(new URL(entry.textContent,location.href).pathname);
      if(!pathname.startsWith('/wiki/'))continue;
      let path=pathname.slice(6);
      if(!path||path.split('/').some(part=>part.startsWith('.')||['wiki-code','wiki-editor','..'].includes(part)))continue;
      if(!/\.html?$/i.test(path)){if(/\.[^/]+$/.test(path))continue;path+='.html';}
      paths.add(path);
    }
    const pages=[];
    await Promise.all([...paths].map(async path=>{
      try{const data=await readPage(path),title=/\|title\s*=([^\n|}]+)/.exec(data.source);pages.push({path,title:title?title[1].trim():path.split('/').pop().replace(/\.html?$/i,'')});}catch{/* Skip unavailable or non-article pages. */}
    }));
    state.pages=pages.sort((a,b)=>a.path.localeCompare(b.path));tree();
    status('Wiki pages found automatically. '+(state.remembered?'Save will ask to reconnect your remembered wiki folder.':'First save requires access to your local wiki folder.'));
  }
  function sidebar(open) { $('pages-panel').hidden=!open; $('toggle-pages').setAttribute('aria-expanded',String(open)); }
  function tree() {
    const root={folders:new Map(),pages:[]},query=$('page-filter').value.toLowerCase().trim();
    for(const page of state.pages){
      if(query&&!(`${page.path} ${page.title}`.toLowerCase().includes(query)))continue;
      let node=root;const parts=page.path.split('/');parts.pop();
      for(const folder of parts){if(!node.folders.has(folder))node.folders.set(folder,{folders:new Map(),pages:[]});node=node.folders.get(folder);}
      node.pages.push(page);
    }
    function branch(node){
      const list=document.createElement('ul');
      for(const [name,child] of node.folders){const row=document.createElement('li'),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=name;details.open=true;details.append(summary,branch(child));row.append(details);list.append(row);}
      for(const page of node.pages){const row=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=page.title;button.title=page.path;button.className='page-choice';if(page.path===state.page?.path)button.setAttribute('aria-current','page');button.addEventListener('click',()=>openPage(page));row.append(button);list.append(row);}
      return list;
    }
    $('page-tree').replaceChildren(branch(root));
    if(!state.pages.length)$('page-tree').textContent='No wiki articles found.';
  }
  async function refresh(){
    if(!local)return;
    try{
      if(!state.folder){await discoverPages();return;}
      const pages=[],handles=new Map();
      async function scan(folder,prefix=''){
        for await(const [name,handle] of folder.entries()){
          if(name.startsWith('.')||['wiki-code','wiki-editor'].includes(name))continue;
          const path=prefix+name;
          if(handle.kind==='directory')await scan(handle,path+'/');
          else if(/\.html?$/i.test(name)){
            const html=await(await handle.getFile()).text(),match=wikiSource.exec(html);
            if(!match)continue;
            const title=/\|title\s*=([^\n|}]+)/.exec(match[1]);
            pages.push({path,title:title?title[1].trim():name.replace(/\.html?$/i,'')});handles.set(path,handle);
          }
        }
      }
      await scan(state.folder);state.pages=pages.sort((a,b)=>a.path.localeCompare(b.path));state.handles=handles;tree();status('Choose a page. Save writes directly to its local HTML file.');
    }catch(error){status(error.message,true);}
  }
  $('choose-folder').addEventListener('click',async()=>{
    if(!local||state.busy)return;
    if(state.source!==state.saved&&!confirm('Discard unsaved changes and choose another folder?'))return;
    try{
      const folder=await window.showDirectoryPicker({id:'mystical-wiki',mode:'readwrite',...(state.remembered?{startIn:state.remembered}:{})});
      if(folder.name!=='wiki')throw Error('Select the wiki folder inside your website folder.');
      state.folder=folder;state.remembered=folder;await rememberFolder(folder);state.page=null;state.source=state.saved='';resetHistory();$('page-title').textContent='Choose a wiki page to begin';$('open-page').hidden=true;state.mode='visual';$('visual-editor').replaceChildren();render();await refresh();sidebar(true);
    }catch(error){if(error.name!=='AbortError')status(error.message,true);}
  });
  async function openPage(page){
    if(state.busy)return;
    if(state.source!==state.saved&&!confirm('Discard unsaved changes and open another page?'))return;
    try{const data=await readPage(page.path);state.page=data;state.source=state.saved=data.source;resetHistory();$('page-title').textContent=page.title;$('open-page').href='/wiki/'+page.path;$('open-page').hidden=false;state.mode='visual';render();tree();sidebar(false);status('Editing wiki/'+page.path);}catch(error){status(error.message,true);}
  }
  function render(){
    state.lastBlock=null;state.selection=null;
    $('visual-editor').hidden=state.mode!=='visual';$('format-toolbar').hidden=state.mode!=='visual';$('source-label').hidden=state.mode!=='source';
    for(const mode of ['visual','source'])$(mode+'-mode').setAttribute('aria-selected',String(state.mode===mode));
    if(state.page){
      if(state.mode==='visual')WikiVisual.render(state.source,$('visual-editor'),(value,options)=>changeSource(value,options));
      else $('source-text').value=state.source;
    }
    controls();
  }
  function activeEditor(){const selection=getSelection();return selection?.anchorNode?.parentElement?.closest('.visual-editable');}
  $('format-toolbar').addEventListener('mousedown',event=>{if(event.target.closest('button'))event.preventDefault();});
  $('format-toolbar').addEventListener('click',event=>{
    const button=event.target.closest('[data-command]');if(!button)return;
    const editor=activeEditor();if(!editor){status('Click the text you want to edit first.');return;}
    const command=button.dataset.command;
    if(command==='link'){
      const target=prompt('Wiki page name or website link:');if(!target)return;
      const label=getSelection().toString()||target,a=document.createElement('a');a.textContent=label;a.dataset.wikiTarget=target;a.href='#';
      const range=getSelection().getRangeAt(0);range.deleteContents();range.insertNode(a);range.setStartAfter(a);range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range);
    }else document.execCommand(command,false,button.dataset.value||null);
    editor.dispatchEvent(new Event('input',{bubbles:true}));
  });
  $('undo').addEventListener('click',()=>historyStep(-1));$('redo').addEventListener('click',()=>historyStep(1));
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&$('editor-container').contains(event.target)){event.preventDefault();historyStep(event.shiftKey?1:-1);}
  });
  $('visual-editor').addEventListener('focusin',event=>{state.lastBlock=event.target.closest('[data-insert-at]');if(!event.target.closest('.visual-section > .visual-body'))state.selection=null;});
  document.addEventListener('selectionchange',()=>{const selection=getSelection();if(selection.rangeCount&&selection.anchorNode?.parentElement?.closest('.visual-editable')&&$('visual-editor').contains(selection.anchorNode))state.selection=selection.getRangeAt(0).cloneRange();});
  function categoryParagraph(range){
    if(!range||!$('visual-editor').contains(range.commonAncestorContainer))return null;
    const element=node=>node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
    const start=element(range.startContainer),end=element(range.endContainer),paragraph=start?.closest('p');
    if(!paragraph||end?.closest('p')!==paragraph||!paragraph.parentElement.matches('.visual-section > .visual-body')||start.closest('.visual-template,.visual-spoiler,.visual-media,[contenteditable="false"]')||end.closest('.visual-template,.visual-spoiler,.visual-media,[contenteditable="false"]'))return null;
    return paragraph;
  }
  $('category-cancel').addEventListener('click',()=>$('category-dialog').close());
  $('category-name').addEventListener('input',()=>$('category-name').setCustomValidity(''));
  $('category-form').addEventListener('submit',event=>{
    event.preventDefault();
    const field=$('category-name'),clean=field.value.replace(/^Category:/i,'').replace(/[|\[\]\r\n]/g,'').trim();
    const existing=[...state.source.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi)];
    if(!clean||existing.some(match=>match[1].trim().toLowerCase()===clean.toLowerCase())){field.setCustomValidity(clean?'This category is already on the page.':'Enter a category name.');field.reportValidity();return;}
    const range=state.categoryRange,paragraph=categoryParagraph(range);
    if(!paragraph){$('category-dialog').close();status('Place your typing cursor in an article paragraph before adding a category.',true);return;}
    const holder=document.createElement('div');WikiVisual.inline(holder,'[[Category:'+clean+']]','/images/character_art/');const chip=holder.firstElementChild;
    // Remove only an empty paragraph's caret placeholder, never an intentional line break.
    if(!paragraph.textContent.trim()&&paragraph.children.length===1&&paragraph.firstElementChild.tagName==='BR'){paragraph.firstElementChild.remove();range.selectNodeContents(paragraph);}
    const anchor=document.createTextNode('\u200B'),fragment=document.createDocumentFragment();fragment.append(chip,anchor);
    range.collapse(false);range.insertNode(fragment);state.lastEdit=0;
    const editor=paragraph.closest('.visual-editable');editor.dispatchEvent(new Event('input',{bubbles:true}));
    $('category-dialog').close();editor.focus();range.setStart(anchor,anchor.length);range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range);state.selection=range.cloneRange();
    status('Category added at your typing cursor. Double-click its tag to rename it.');
  });
  $('insert-content').addEventListener('change',()=>{
    const type=$('insert-content').value;$('insert-content').value='';if(!type||!state.page)return;
    if(type==='category'){if(!categoryParagraph(state.selection)){status('Place your typing cursor in an article paragraph before adding a category.',true);return;}state.categoryRange=state.selection.cloneRange();$('category-name').value='';$('category-name').setCustomValidity('');$('category-dialog').showModal();$('category-name').focus();return;}
    if(type==='spoiler'&&state.selection&&$('visual-editor').contains(state.selection.commonAncestorContainer)){
      const range=state.selection,editor=(range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer:range.commonAncestorContainer.parentElement).closest('.visual-editable');
      if(editor){const holder=document.createElement('div');WikiVisual.inline(holder,'{{Spoiler|Write spoiler text here.}}','/images/character_art/');const node=holder.firstElementChild;range.deleteContents();range.insertNode(node);state.lastEdit=0;editor.dispatchEvent(new Event('input',{bubbles:true}));const next=document.createRange();next.selectNodeContents(node.querySelector('[data-spoiler-content]'));getSelection().removeAllRanges();getSelection().addRange(next);status('Spoiler inserted in the selected text.');return;}
    }
    const snippets={paragraph:'New paragraph.',spoiler:'{{Spoiler|Write spoiler text here.}}',infobox:'{{Infobox\n|title=Infobox\n|section=Information\n|New field=Write here.\n}}',tabs:'{{Tabs\n|Overview\n}}',gallery:'{{Gallery|\n/images/character_art/avery_obtainia_winged.png :: Image caption\n}}',image:'[[File:/images/character_art/avery_obtainia_winged.png|Image caption]]',references:'{{References\n|Source name=https://example.com\n}}',credits:'{{Credits|Write credits here.}}',characters:'{{Characters\n|Character Name=/images/character_art/avery_obtainia_winged.png :: char/avery_obtainia\n}}',randomarticle:'{{RandomArticle\n|title=From the Wiki Archive\n}}',page:'{{Page\n|title=Page title\n}}'};
    let snippet=snippets[type],source=state.source,offset=Number(state.lastBlock?.dataset.insertAt??source.length);
    if(['tabs','page','infobox','randomarticle','characters'].includes(type)&&new RegExp('\\{\\{'+type+'[\\s|}]','i').test(source)){
      status('This page already has that block. Open its panel to add or edit fields.');return;
    }
    if(type==='tab'){
      let number=1,name='New tab';while(source.includes('|tab='+name)||source.includes('|tab = '+name))name='New tab '+(++number);
      snippet='|tab='+name+'\n\n== '+name+' ==\nWrite tab content here.';
      // Insert tab content at the end, and register it in existing navigation.
      offset=source.length;
      const match=/\{\{Tabs\b[\s\S]*?\}\}/i.exec(source);
      if(match){const replacement=match[0].slice(0,-2).trimEnd()+'\n|'+name+'\n}}';source=source.slice(0,match.index)+replacement+source.slice(match.index+match[0].length);offset=source.length;}
    }
    changeSource(source.slice(0,offset)+'\n\n'+snippet+'\n\n'+source.slice(offset),{structural:true,render:true});
    const elements=[...$('visual-editor').querySelectorAll('[data-insert-at]')];const inserted=elements.find(element=>Number(element.dataset.insertAt)>=offset+snippet.length);if(inserted){if(inserted.tagName==='DETAILS')inserted.open=true;inserted.scrollIntoView({behavior:'smooth',block:'center'});inserted.querySelector('input,.visual-editable')?.focus();}
    if(type==='paragraph')WikiVisual.selectParagraph($('visual-editor'),offset);
    status(type==='paragraph'?'Paragraph added after the selected element. Type to replace its text.':'Content inserted. Edit it visually, then Save changes.');
  });
  $('visual-editor').addEventListener('paste',event=>{
    const editor=event.target.closest('.visual-editable');if(!editor||event.target.matches('input,textarea'))return;
    event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));
  });
  $('toggle-pages').addEventListener('click',()=>sidebar($('pages-panel').hidden));
  $('close-pages').addEventListener('click',()=>sidebar(false));
  $('page-filter').addEventListener('input',tree);$('refresh-pages').addEventListener('click',refresh);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')sidebar(false);});
  for(const mode of ['visual','source'])$(mode+'-mode').addEventListener('click',()=>{changeSource(WikiVisual.compactSource(state.source),{structural:true});state.mode=mode;render();});
  $('source-text').addEventListener('input',()=>changeSource($('source-text').value));
  $('discard').addEventListener('click',()=>{if(confirm('Discard changes to this page?')){state.source=state.saved;resetHistory();render();status('Changes discarded.');}});
  $('save').addEventListener('click',async()=>{
    state.busy=true;controls();$('editor-container').inert=true;
    try{const data=await savePage();state.page.html=data.html;state.page.revision=data.revision;state.saved=state.source;status('Saved wiki/'+state.page.path+'. Your normal GitHub push publishes it.');}
    catch(error){status(error.message,true);}
    finally{state.busy=false;$('editor-container').inert=false;controls();}
  });
  window.addEventListener('beforeunload',event=>{if(state.source!==state.saved){event.preventDefault();event.returnValue='';}});
  if(!local){document.querySelector('main').inert=true;$('toggle-pages').disabled=true;$('choose-folder').disabled=true;status('This editor is disabled on hosted websites. Open it using your existing localhost server.',true);return;}
  if(!window.showDirectoryPicker){$('choose-folder').disabled=true;}
  (async()=>{
    try{state.remembered=await folderStore();if(state.remembered&&await state.remembered.queryPermission({mode:'readwrite'})==='granted')state.folder=state.remembered;}catch{/* Discover served pages if no saved folder is available. */}
    await refresh();sidebar(true);
    if(!window.showDirectoryPicker)status('Wiki pages are available to view. Use Chrome or Edge for direct file saving.');
  })();
})();
