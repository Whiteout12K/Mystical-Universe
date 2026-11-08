import {parseProgram,generateProgram} from './model.mjs';
import {installBlocks} from './blocks.mjs';
import {saveProgramFile,rememberDirectory} from './storage.mjs';
const $=id=>document.getElementById(id),Blockly=window.Blockly;
const catalog=await fetch('editor/catalog.json').then(r=>{if(!r.ok)throw new Error('Block catalog unavailable');return r.json();});
const bridge=installBlocks(Blockly,catalog);
const theme=Blockly.Theme.defineTheme('jscratch',{base:Blockly.Themes.Classic,componentStyles:{workspaceBackgroundColour:'#f6f8fb',toolboxBackgroundColour:'#ffffff',flyoutBackgroundColour:'#edf1f7',scrollbarColour:'#a8b9cf',insertionMarkerColour:'#426ce0',insertionMarkerOpacity:.35},fontStyle:{family:'system-ui',weight:'500',size:11},startHats:true});
const workspace=Blockly.inject('workspace',{toolbox:bridge.toolbox(),theme,renderer:'zelos',trashcan:true,grid:{spacing:24,length:2,colour:'#d9e1ed',snap:false},zoom:{controls:true,wheel:true,startScale:.8,maxScale:1.5,minScale:.2,scaleSpeed:1.12},move:{scrollbars:true,drag:true,wheel:true},sounds:false,collapse:true,comments:true,disable:true,maxInstances:{},media:'editor/vendor/media/'});
new ResizeObserver(()=>Blockly.svgResize(workspace)).observe($('workspace'));
const docs=new Map();let current=null,muting=false,directory=null,timer=null,captureTimer=null,codePending=false,noticeAction=null,savedDirectory=null;
const draftIndex='jscratch-editor-files:'+location.pathname;
const key=name=>'jscratch-editor-v1:'+location.pathname+':'+name;
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);$('status').title=text;}
function notice(text,action=null){$('notice').hidden=false;$('notice-text').textContent=text;noticeAction=action;$('restore').hidden=!action;}
$('dismiss-notice').onclick=()=>{$('notice').hidden=true;};$('restore').onclick=()=>{noticeAction?.();$('notice').hidden=true;};
function storageMode(){ $('storage-mode').textContent=directory?'Autosaving to '+directory.name+'/':'Autosaving browser drafts · connect a folder to write .js files';$('connect').textContent=directory?'Change program folder':'Open program folder';}
function draft(doc){try{localStorage.setItem(key(doc.name),JSON.stringify({source:doc.source,base:doc.base,workspace:doc.layout}));localStorage.setItem(draftIndex,JSON.stringify([...docs.keys()]));}catch{notice('Browser draft storage is full or unavailable. Connect a program folder or download your changes.');}}
function capture(){
    clearTimeout(captureTimer);captureTimer=null;
    if(!current)return;
    current.layout=Blockly.serialization.workspaces.save(workspace);
    draft(current);
    const model=bridge.read(workspace,current.footer);
    const source=generateProgram(model);
    if(source!==current.generated){current.source=source;current.generated=source;current.dirty=true;}
    draft(current);if(!codePending)$('source').value=current.source;
}
function validateName(name){if(!/^[A-Za-z0-9_-]+\.js$/.test(name))throw new Error('Use a simple .js filename with letters, numbers, - or _.');return name;}
async function write(doc){
    if(!doc.dirty)return;
    const source=doc.source;
    if(directory)await saveProgramFile(directory,doc.name,source,doc.base);
    doc.base=directory?source:doc.base;
    doc.dirty=doc.source!==source;draft(doc);
}
async function save(doc=current){
    if(!doc)return;
    doc.queue=(doc.queue??Promise.resolve()).catch(()=>{}).then(async()=>{
        if(!doc.dirty){if(doc===current)status('Saved');return;}
        if(doc===current)status('Saving…');
        await write(doc);
        if(doc===current)status(directory?'Saved to '+doc.name:'Draft saved');
    });
    try{await doc.queue;return true;}catch(e){status('Save blocked',true);notice(e.message+' Your browser draft is retained.');return false;}
}
function schedule(){clearTimeout(timer);status('Unsaved changes');timer=setTimeout(()=>save(),600);}
function updateFiles(){const select=$('files');select.replaceChildren(...[...docs.keys()].sort().map(name=>new Option(name,name)));if(current)select.value=current.name;}
function loadDoc(doc,layout=null){
    const model=parseProgram(doc.source,catalog); // Validate before touching current workspace.
    muting=true;Blockly.Events.disable();
    try{
        if(layout)Blockly.serialization.workspaces.load(layout,workspace);else bridge.load(model,workspace);
        workspace.clearUndo();doc.footer=model.footer;doc.generated=generateProgram(model);current=doc;codePending=false;
        $('source').value=doc.source;$('source-name').textContent=doc.name;$('files').value=doc.name;
        Blockly.renderManagement.finishQueuedRenders().then(()=>{
            if(current!==doc)return;
            if(!layout){Blockly.Events.disable();try{bridge.arrange(workspace);}finally{Blockly.Events.enable();}}
            workspace.scrollCenter();
        });
    }finally{Blockly.Events.enable();muting=false;}
    status(directory?'Saved to '+doc.name:'Browser draft');
}
function openDoc(doc){
    let stored=null;try{stored=JSON.parse(localStorage.getItem(key(doc.name)));}catch{}
    loadDoc(doc,stored?.source===doc.source?stored.workspace:null);
    if(stored&&stored.source!==doc.source)notice('A different browser draft exists for '+doc.name+'. The current disk file is open.',()=>{
        try{doc.source=stored.source;doc.dirty=true;loadDoc(doc,stored.workspace);draft(doc);schedule();}catch(e){notice('Draft could not be restored: '+e.message);}
    });
}
function applyCode(){
    if(!current||!codePending)return true;
    try{const source=$('source').value;parseProgram(source,catalog);current.source=source;current.dirty=true;loadDoc(current);capture();schedule();return true;}catch(e){status('Invalid JavaScript',true);notice(e.message+' The last valid program is unchanged.');return false;}
}
$('apply-source').onclick=applyCode;$('source').oninput=()=>{codePending=true;status('Code edits · Apply to blocks');};
$('files').onchange=async()=>{const name=$('files').value;if(!applyCode()){$('files').value=current.name;return;}try{capture();}catch(e){notice(e.message);$('files').value=current.name;return;}clearTimeout(timer);await save();openDoc(docs.get(name));};
workspace.addChangeListener(event=>{
    if(muting||event.isUiEvent||!current||event.type===Blockly.Events.FINISHED_LOADING)return;
    clearTimeout(captureTimer);status('Unsaved changes');
    captureTimer=setTimeout(()=>{
        try{capture();if($('notice-text').textContent.includes('Autosave is paused'))$('notice').hidden=true;schedule();}
        catch(e){status('Incomplete blocks',true);notice(e.message+' Autosave is paused until this is fixed.');clearTimeout(timer);}
    },90);
});
$('search').oninput=()=>{workspace.updateToolbox(bridge.toolbox($('search').value));if($('search').value)workspace.getToolbox().selectItemByPosition(0);};
$('undo').onclick=()=>workspace.undo(false);$('redo').onclick=()=>workspace.undo(true);$('fit').onclick=()=>workspace.zoomToFit();
$('source-toggle').onclick=()=>{const hidden=!$('source-panel').hidden;$('source-panel').hidden=hidden;$('source-toggle').setAttribute('aria-pressed',String(!hidden));Blockly.svgResize(workspace);};
$('download').onclick=()=>{
    if(!applyCode())return;
    try{capture();const blob=new Blob([current.source],{type:'text/javascript'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=current.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice(e.message);}
};
$('new-file').onclick=()=>{$('new-dialog').showModal();$('new-name').select();};
$('new-dialog').addEventListener('close',async()=>{
    if($('new-dialog').returnValue!=='create')return;
    try{
        const name=validateName($('new-name').value);if(docs.has(name))throw new Error('That file already exists.');
        if(!applyCode())return;capture();await save();
        const doc={name,source:'whenStart(\n);\n',base:null,dirty:true};docs.set(name,doc);updateFiles();loadDoc(doc);capture();await save();
        notice('Created '+name+'. To run this new program, add its script tag to canvas.html.');
    }catch(e){notice(e.message);}
});
async function connectFolder(){
    if(!window.showDirectoryPicker){notice('Folder autosave requires Chrome or Edge on localhost/HTTPS. You can import .js files and download edits in this browser.');$('import-files').click();return;}
    try{
        const handle=savedDirectory??await window.showDirectoryPicker({id:'jscratch-program',mode:'readwrite'});
        if(handle.requestPermission&&await handle.requestPermission({mode:'readwrite'})!=='granted')throw new Error('Folder write permission was not granted. Browser drafts are still available.');
        const entries=[];for await(const [name,file] of handle.entries())if(file.kind==='file'&&/^[A-Za-z0-9_-]+\.js$/.test(name))entries.push({name,source:await (await file.getFile()).text()});
        if(!entries.length){notice('Select the program folder containing begin.js and world.js.');return;}
        if(!applyCode())return;capture();await save();directory=handle;savedDirectory=null;await rememberDirectory(handle).catch(()=>{});
        docs.clear();for(const entry of entries)docs.set(entry.name,{...entry,base:entry.source,dirty:false});updateFiles();storageMode();openDoc(docs.get('begin.js')??docs.values().next().value);
    }catch(e){if(e.name!=='AbortError')notice(e.message);}
}
$('connect').onclick=connectFolder;
$('import').onclick=()=>$('import-files').click();
const picker=document.createElement('input');picker.id='import-files';picker.type='file';picker.accept='.js';picker.multiple=true;picker.hidden=true;document.body.append(picker);
picker.onchange=async()=>{
    if(!applyCode())return;capture();await save();
    for(const file of picker.files){try{validateName(file.name);const source=await file.text();parseProgram(source,catalog);docs.set(file.name,{name:file.name,source,base:source,dirty:false});}catch(e){notice(file.name+': '+e.message);}}
    directory=null;updateFiles();storageMode();if(picker.files.length)openDoc(docs.get(picker.files[0].name)??current);picker.value='';
};
$('run-game').onclick=async event=>{
    event.preventDefault();
    if(!applyCode())return;
    try{capture();}catch(e){notice(e.message);return;}
    if(!directory&&[...docs.values()].some(d=>d.source!==d.base)){
        notice('Open your program folder to save these changes before running, or download the edited .js files. Run opens the game’s saved program files.');return;
    }
    const preview=window.open('about:blank','jscratch-game');if(preview)preview.opener=null;
    for(const doc of docs.values())if(!await save(doc)){preview?.close();return;}
    if(preview)preview.location.href=new URL('canvas.html',location.href).href;
};
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(applyCode()){try{capture();save();}catch(e){notice(e.message);}}}});
window.addEventListener('beforeunload',e=>{if(codePending||[...docs.values()].some(d=>d.dirty&&directory)){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!codePending){try{capture();save();}catch{}}});
try{
    const manifest=await fetch('editor/programs.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
    const html=await fetch('canvas.html').then(r=>r.text()),page=new DOMParser().parseFromString(html,'text/html');
    const names=manifest??[...page.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).filter(s=>/^program\/[A-Za-z0-9_-]+\.js$/.test(s)).map(s=>s.slice(8));
    if(!names.includes('sample.js'))names.push('sample.js');
    const entries=await Promise.all(names.map(async name=>{validateName(name);const r=await fetch('program/'+name,{cache:'no-store'});if(!r.ok)throw new Error('Cannot import '+name);return {name,source:await r.text()};}));
    for(const entry of entries)docs.set(entry.name,{...entry,base:entry.source,dirty:false});
    try{for(const name of JSON.parse(localStorage.getItem(draftIndex)||'[]'))if(!docs.has(name)){
        validateName(name);const stored=JSON.parse(localStorage.getItem(key(name)));if(stored?.source){parseProgram(stored.source,catalog);docs.set(name,{name,source:stored.source,base:null,dirty:false});}
    }}catch{}
    updateFiles();storageMode();openDoc(docs.get('begin.js')??docs.values().next().value);
    notice('Programs imported. Edits autosave as browser drafts. Open your local JScratch/program folder once to autosave changes directly to .js files.');
    savedDirectory=await rememberDirectory().catch(()=>null);
    if(savedDirectory){$('connect').textContent='Reconnect program folder';if(await savedDirectory.queryPermission({mode:'readwrite'})==='granted')await connectFolder();}
}catch(e){status('Could not open programs',true);notice(e.message);}
// Expose the workspace for integrations and automated editor checks.
window.JScratchEditor={workspace,bridge,catalog,docs,get current(){return current;},capture,save,loadDoc};
