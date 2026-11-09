import {parseProgram,generateProgram} from './model.mjs';
import {createEditorTheme} from './theme.mjs';
import {installBlocks} from './blocks.mjs';
import {saveProgramFile,saveProjectManifest,saveEditorData,readEditorData,rememberDirectory} from './storage.mjs';
import {validateProgramPath,validateFolderPath,makeProject,projectFiles,readProgramDirectory,folderHandle} from './project.mjs';
import {readBlockDefinitions,mergeDefinitions} from './definitions.mjs';
import {renderExplorer} from './explorer.mjs';
import {installRenderer} from './renderer.mjs';
import {palettePlugins} from './palette.mjs';
import {SymbolLibrary} from './symbols.mjs';
import {previewWindows,inspectorSession} from './preview.mjs';
const $=id=>document.getElementById(id),Blockly=window.Blockly;
const baseCatalog=await fetch('editor/catalog.json').then(r=>{if(!r.ok)throw new Error('Block catalog unavailable');return r.json();});
const extensionSource=await fetch('js/extensions.js',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Block extensions unavailable');return r.text();});
const catalog=mergeDefinitions(baseCatalog,readBlockDefinitions(extensionSource));
installRenderer(Blockly);
let symbols=null;
const bridge=installBlocks(Blockly,catalog,{library:()=>symbols});
let dark=true;try{dark=localStorage.getItem('jscratch-editor-theme')!=='light';}catch{}
const theme=createEditorTheme(Blockly,dark);
document.documentElement.dataset.theme=dark?'dark':'light';
const workspace=Blockly.inject('workspace',{toolbox:bridge.toolbox(),plugins:palettePlugins(Blockly),theme,renderer:'jscratch',trashcan:false,grid:{spacing:24,length:2,colour:'#465571',snap:false},zoom:{controls:false,wheel:true,startScale:.8,maxScale:1.5,minScale:.2,scaleSpeed:1.12},move:{scrollbars:true,drag:true,wheel:true},sounds:false,collapse:true,comments:true,disable:true,maxInstances:{},media:'editor/vendor/media/'});
workspace.getToolbox().HtmlDiv.classList.add('jscratch-palette');
new ResizeObserver(()=>Blockly.svgResize(workspace)).observe($('workspace'));
const docs=new Map(),folders=new Set();let selectedFolder='',newKind='file',projectDirty=false;let current=null,muting=false,directory=null,timer=null,captureTimer=null,codePending=false,noticeAction=null,savedDirectory=null;
const draftIndex='jscratch-editor-files:'+location.pathname;
const key=name=>'jscratch-editor-v1:'+location.pathname+':'+name;
const symbolsKey='jscratch-symbols:'+location.pathname;let symbolsDirty=false,metadataTimer=null,metadataQueue=Promise.resolve();
function symbolSources(){
    const sources=[...docs.values()].map(doc=>({name:doc.name,source:doc.source}));
    if(current){try{const source=generateProgram(bridge.read(workspace,current.footer)),entry=sources.find(d=>d.name===current.name);if(entry)entry.source=source;else sources.push({name:current.name,source});}catch{sources.push({name:'@incomplete-workspace.js',source:'('});}}
    return sources;
}
async function saveMetadata(){
    metadataQueue=metadataQueue.catch(()=>{}).then(async()=>{
        if(!symbolsDirty||!directory)return;
        const revision=symbols.revision;await saveEditorData(directory,symbols.export());if(symbols.revision===revision)symbolsDirty=false;
    });return metadataQueue;
}
let symbolData=null;try{symbolData=JSON.parse(localStorage.getItem(symbolsKey));}catch{}
symbols=new SymbolLibrary(catalog,{sources:symbolSources,data:symbolData,onChange:data=>{
    symbolsDirty=true;try{localStorage.setItem(symbolsKey,JSON.stringify(data));}catch{}
    clearTimeout(metadataTimer);metadataTimer=setTimeout(()=>saveMetadata().catch(error=>notice('Name library could not save: '+error.message)),500);
}});
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);$('status').title=text;}
function notice(text,action=null,label='Restore draft'){$('notice').hidden=false;$('notice-text').textContent=text;noticeAction=action;$('restore').hidden=!action;$('restore').textContent=label;}
$('dismiss-notice').onclick=()=>{if(current?.pendingDraft&&$('notice-text').textContent.includes('different browser draft')){current.pendingDraft=null;draft(current);}$('notice').hidden=true;};$('restore').onclick=()=>{const action=noticeAction;$('notice').hidden=true;action?.();};
function storageMode(){
    $('storage-mode').textContent=directory?'Autosaving to program/':'Browser draft';
    $('save-state').classList.toggle('needs-access',!directory);
    $('save-state').title=directory?'Autosaving to program/':'Enable autosave to program/ (one-time browser permission)';
}
function requestSaveAccess(){if(!directory)$('save-dialog').showModal();}
$('save-state').onclick=requestSaveAccess;
$('save-later').onclick=()=>$('save-dialog').close();
$('enable-save').onclick=async()=>{$('save-dialog').close();await connectFolder();};
function draft(doc){if(doc.pendingDraft)return;try{localStorage.setItem(key(doc.name),JSON.stringify({source:doc.source,base:doc.base,workspace:doc.layout}));localStorage.setItem(draftIndex,JSON.stringify([...docs.keys()]));}catch{notice('Browser draft storage is full or unavailable. Connect a program folder to save your changes.');}}
function capture(){
    clearTimeout(captureTimer);captureTimer=null;
    if(!current)return;
    current.layout=Blockly.serialization.workspaces.save(workspace);
    draft(current);
    const model=bridge.read(workspace,current.footer);
    const source=generateProgram(model);
    if(source!==current.generated){current.pendingDraft=null;current.source=source;current.generated=source;current.dirty=true;}
    draft(current);if(!codePending)$('source').value=current.source;
}
const validateName=validateProgramPath;
async function write(doc){
    if(!doc.dirty)return;
    const source=doc.source;
    if(directory){await saveProgramFile(directory,doc.name,source,doc.base);if(projectDirty){await saveProjectManifest(directory,makeProject([...docs.keys()],[...folders]));projectDirty=false;}}
    doc.base=directory?source:doc.base;
    doc.dirty=doc.source!==source;draft(doc);
}
async function save(doc=current){
    if(!doc)return;
    doc.queue=(doc.queue??Promise.resolve()).catch(()=>{}).then(async()=>{
        if(!doc.dirty){if(doc===current)status(directory?'Saved':'Draft · enable saving');return;}
        if(doc===current)status('Saving…');
        await write(doc);
        if(doc===current)status(directory?'Saved':'Draft · enable saving');
    });
    try{await doc.queue;await saveMetadata();return true;}catch(e){if(['NotAllowedError','SecurityError'].includes(e.name)){savedDirectory=directory;directory=null;storageMode();}status('Save blocked',true);notice(e.message+' Your browser draft is retained.');return false;}
}
function schedule(){clearTimeout(timer);status('Unsaved changes');timer=setTimeout(()=>save(),600);}
function updateFiles(){
    renderExplorer($('file-tree'),[...docs.keys()],[...folders],current?.name,switchFile,path=>{selectedFolder=path;});
    $('current-path').textContent='program/'+(current?.name??'');
    try{localStorage.setItem(draftIndex+':folders',JSON.stringify([...folders]));}catch{}
}
async function switchFile(name){
    if(name===current?.name)return;
    if(!applyCode())return;
    try{capture();}catch(e){notice(e.message);return;}
    clearTimeout(timer);await save();openDoc(docs.get(name));
}
function loadDoc(doc,layout=null){
    const model=parseProgram(doc.source,catalog); // Validate before touching current workspace.
    muting=true;Blockly.Events.disable();
    try{
        if(layout)Blockly.serialization.workspaces.load(layout,workspace);else bridge.load(model,workspace);
        const needsArrangement=!layout||workspace.getAllBlocks(false).some(b=>b.isCollapsed()||(b.getInput('ARG0')&&!b.getInputsInline()));
        bridge.expandAll(workspace);
        workspace.clearUndo();doc.footer=model.footer;doc.generated=generateProgram(model);current=doc;codePending=false;
        $('source').value=doc.source;$('source-name').textContent=doc.name;selectedFolder=doc.name.includes('/')?doc.name.slice(0,doc.name.lastIndexOf('/')):'';updateFiles();
        Blockly.renderManagement.finishQueuedRenders().then(()=>{
            if(current!==doc)return;
            if(needsArrangement){Blockly.Events.disable();try{bridge.arrange(workspace);}finally{Blockly.Events.enable();}}
            focusFirstScript();
        });
    }finally{Blockly.Events.enable();muting=false;}
    status(directory?'Saved':'Draft · enable saving');
}
function openDoc(doc){
    let stored=null;try{stored=JSON.parse(localStorage.getItem(key(doc.name)));}catch{}
    doc.pendingDraft=stored&&stored.source!==doc.source?stored:null;
    loadDoc(doc,stored?.source===doc.source?stored.workspace:null);
    if(!doc.pendingDraft&&$('notice-text').textContent.includes('different browser draft'))$('notice').hidden=true;
    if(doc.pendingDraft)notice('A different browser draft exists for '+doc.name+'. The current disk file is open.',()=>{
        try{doc.pendingDraft=null;doc.source=stored.source;doc.dirty=true;loadDoc(doc,stored.workspace);draft(doc);schedule();}catch(e){notice('Draft could not be restored: '+e.message);}
    });
}
function applyCode(){
    if(!current||!codePending)return true;
    try{const source=$('source').value;parseProgram(source,catalog);current.source=source;current.dirty=true;loadDoc(current);capture();schedule();return true;}catch(e){status('Invalid JavaScript',true);notice(e.message+' The last valid program is unchanged.');return false;}
}
$('apply-source').onclick=applyCode;$('source').oninput=()=>{codePending=true;status('Code edits · Apply to blocks');};
workspace.addChangeListener(event=>{
    if(muting||event.isUiEvent||!current||event.type===Blockly.Events.FINISHED_LOADING)return;
    clearTimeout(captureTimer);status('Unsaved changes');
    captureTimer=setTimeout(()=>{
        try{capture();if($('notice-text').textContent.includes('Autosave is paused'))$('notice').hidden=true;schedule();}
        catch(e){status('Incomplete blocks',true);notice(e.message+' Autosave is paused until this is fixed.');clearTimeout(timer);}
    },90);
});
$('search').oninput=()=>{workspace.updateToolbox(bridge.toolbox($('search').value));if($('search').value)workspace.getToolbox().selectItemByPosition(0);};
function focusFirstScript(){
    const first=workspace.getTopBlocks(false).find(b=>b.type==='js_whenStart')??workspace.getTopBlocks(true)[0];
    if(!first)return;
    const p=first.getRelativeToSurfaceXY();
    workspace.scroll(48-p.x*workspace.scale,112-p.y*workspace.scale);
}
function updateThemeButton(){ $('theme-toggle').textContent=dark?'☀':'☾';$('theme-toggle').setAttribute('aria-pressed',String(dark)); }
updateThemeButton();
$('theme-toggle').onclick=()=>{dark=!dark;document.documentElement.dataset.theme=dark?'dark':'light';workspace.setTheme(createEditorTheme(Blockly,dark));try{localStorage.setItem('jscratch-editor-theme',dark?'dark':'light');}catch{}updateThemeButton();};
$('expand-all').onclick=async()=>{bridge.expandAll(workspace);await Blockly.renderManagement.finishQueuedRenders();bridge.arrange(workspace);focusFirstScript();};
$('undo').onclick=()=>workspace.undo(false);$('redo').onclick=()=>workspace.undo(true);$('fit').onclick=()=>workspace.zoomToFit();
function showCode(open){$('source-panel').hidden=!open;$('source-toggle').setAttribute('aria-pressed',String(open));}
$('source-toggle').onclick=()=>showCode($('source-panel').hidden);$('source-close').onclick=()=>showCode(false);
$('zoom-in').onclick=()=>workspace.zoomCenter(1);$('zoom-out').onclick=()=>workspace.zoomCenter(-1);$('home').onclick=focusFirstScript;
let paletteOpen=false,filesOpen=false;
function setPalette(open,focus=false){
    const anchor=workspace.getTopBlocks(false)[0]?.getSvgRoot(),before=anchor?.getBoundingClientRect();
    paletteOpen=open;if(open)setFiles(false);
    document.body.classList.toggle('palette-open',open);
    workspace.getToolbox().setVisible(open);
    if(!open){workspace.getToolbox().clearSelection();workspace.getFlyout()?.hide();}
    $('palette-search').hidden=!open;$('palette-toggle').setAttribute('aria-expanded',String(open));
    Blockly.svgResize(workspace);
    if(before&&anchor){const after=anchor.getBoundingClientRect();workspace.scroll(workspace.scrollX+before.x-after.x,workspace.scrollY+before.y-after.y);}
    if(focus)$('search').focus();
}
function setFiles(open){
    filesOpen=open;if(open&&paletteOpen)setPalette(false);
    $('explorer').hidden=!open;$('files-toggle').setAttribute('aria-expanded',String(open));
}
$('palette-toggle').onclick=()=>setPalette(!paletteOpen);$('palette-close').onclick=()=>setPalette(false);
$('files-toggle').onclick=()=>setFiles(!filesOpen);$('files-close').onclick=()=>setFiles(false);
$('search-toggle').onclick=()=>setPalette(true,true);setPalette(false);
function showNew(kind){
    newKind=kind;$('new-title').textContent=kind==='file'?'New script':'New folder';
    $('new-name').value=(selectedFolder?selectedFolder+'/':'')+(kind==='file'?'scene.js':'folder');
    $('new-description').textContent=kind==='file'?'Saved scripts are included in the game automatically. Use reference/ for examples that should not run.':'Use folders to organize scripts. Folder order does not control execution.';
    $('new-dialog').showModal();$('new-name').select();
}
$('new-file').onclick=()=>showNew('file');$('new-folder').onclick=()=>showNew('folder');
$('new-dialog').addEventListener('close',async()=>{
    if($('new-dialog').returnValue!=='create')return;
    try{
        if(newKind==='folder'){
            const path=validateFolderPath($('new-name').value);if(directory)await folderHandle(directory,path,true);folders.add(path);selectedFolder=path;projectDirty=true;
            if(directory){await saveProjectManifest(directory,makeProject([...docs.keys()],[...folders]));projectDirty=false;}updateFiles();return;
        }
        const name=validateName($('new-name').value);if(docs.has(name))throw new Error('That file already exists.');
        if(!applyCode())return;capture();await save();
        const doc={name,source:'whenStart(\n);\n',base:null,dirty:true};docs.set(name,doc);projectDirty=true;updateFiles();loadDoc(doc);capture();await save();
        notice('Created '+name+'. '+(directory?'It will join the game on the next run.':'Connect your program folder to save it into the game.'));
    }catch(e){notice(e.message);}
});
async function connectFolder(){
    if(!window.showDirectoryPicker){notice('Folder autosave requires Chrome or Edge on localhost/HTTPS. Your edits remain in browser drafts.');return;}
    try{
        let handle=savedDirectory??await window.showDirectoryPicker({id:'jscratch-program',mode:'readwrite'});
        if(handle.name!=='program'){try{handle=await handle.getDirectoryHandle('program');}catch{throw new Error('Select the program folder next to editor.html.');}}
        const activeName=current?.name;
        if(handle.requestPermission&&await handle.requestPermission({mode:'readwrite'})!=='granted')throw new Error('Folder write permission was not granted. Browser drafts are still available.');
        const listing=await readProgramDirectory(handle),entries=listing.files;
        if(!entries.length){notice('Select the program folder containing begin.js and world.js.');return;}
        if(!applyCode())return;capture();await save();directory=handle;savedDirectory=null;symbols.merge(await readEditorData(handle));await rememberDirectory(handle).catch(()=>{});
        const pending=[...docs.values()].filter(d=>d.source!==d.base&&(!entries.some(e=>e.name===d.name)||entries.find(e=>e.name===d.name).source===d.base)),draftFolders=[...folders];
        docs.clear();folders.clear();for(const path of [...listing.folders,...draftFolders]){folders.add(path);await folderHandle(directory,path,true);}
        for(const entry of entries)docs.set(entry.name,{...entry,base:entry.source,dirty:false});
        projectDirty=false;
        for(const doc of pending){doc.dirty=true;docs.set(doc.name,doc);}
        for(const doc of pending)if(!await save(doc))throw new Error('Could not save recovered draft '+doc.name);
        await saveProjectManifest(directory,makeProject([...docs.keys()],[...folders]));projectDirty=false;updateFiles();storageMode();openDoc(docs.get(activeName)??docs.get('begin.js')??docs.values().next().value);symbols.refresh();await saveMetadata();

    }catch(e){if(e.name!=='AbortError')notice(e.message);}
}
$('run-game').onclick=async event=>{
    event.preventDefault();
    if(!applyCode())return;
    try{capture();}catch(e){notice(e.message);return;}
    if(!directory&&[...docs.values()].some(d=>d.source!==d.base)){
        requestSaveAccess();return;
    }
    if($('restore').textContent==='Open inspector'){$('notice').hidden=true;noticeAction=null;}
    const session=inspectorSession(crypto),placement=previewWindows(window.screen);
    const gameUrl=new URL('canvas.html',location.href),inspectorUrl=new URL('inspector.html',location.href);
    gameUrl.searchParams.set('inspect',session);inspectorUrl.searchParams.set('inspect',session);
    const preview=window.open('about:blank','jscratch-game',placement.game);
    const inspector=preview?window.open('about:blank','jscratch-inspector',placement.inspector):null;
    if(preview)preview.opener=null;if(inspector)inspector.opener=null;
    for(const doc of docs.values())if(!await save(doc)){preview?.close();inspector?.close();return;}
    const openInspector=()=>{const popup=window.open(inspectorUrl.href,'jscratch-inspector',placement.inspector);if(popup)popup.opener=null;else notice('The browser blocked the inspector. Allow popups for this editor, then try again.',openInspector,'Open inspector');};
    if(!preview){notice('The browser blocked the game window. Allow popups for this editor and press Run again.');return;}
    preview.location.href=gameUrl.href;
    if(inspector)inspector.location.href=inspectorUrl.href;
    else notice('Game started. Open the live sprite inspector alongside it.',openInspector,'Open inspector');
};
window.addEventListener('keydown',e=>{
    const modifier=e.ctrlKey||e.metaKey;
    if(modifier&&e.key.toLowerCase()==='k'){e.preventDefault();setPalette(true,true);return;}
    if(e.key==='Escape'){setFiles(false);setPalette(false);return;}
    if(modifier&&e.key.toLowerCase()==='s'){
        e.preventDefault();if(applyCode()){try{capture();if(!directory)requestSaveAccess();else save();}catch(error){notice(error.message);}}
    }
});
window.addEventListener('beforeunload',e=>{if(codePending||[...docs.values()].some(d=>d.dirty&&directory)){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!codePending){try{capture();save();}catch{}}});
try{
    const savedNames=await fetch('program/editor-data.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);symbols.merge(savedNames);
    const manifest=await fetch('program/project.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Project manifest unavailable');return r.json();});
    const names=projectFiles(manifest);for(const path of manifest.folders??[])folders.add(path);
    try{for(const path of JSON.parse(localStorage.getItem(draftIndex+':folders')||'[]'))folders.add(validateFolderPath(path));}catch{}
    const entries=await Promise.all(names.map(async name=>{validateName(name);const r=await fetch('program/'+name,{cache:'no-store'});if(!r.ok)throw new Error('Cannot import '+name);return {name,source:await r.text()};}));
    for(const entry of entries)docs.set(entry.name,{...entry,base:entry.source,dirty:false});
    try{for(const name of JSON.parse(localStorage.getItem(draftIndex)||'[]'))if(!docs.has(name)){
        validateName(name);const stored=JSON.parse(localStorage.getItem(key(name)));if(stored?.source){parseProgram(stored.source,catalog);docs.set(name,{name,source:stored.source,base:null,dirty:false});}
    }}catch{}
    symbols.refresh();updateFiles();storageMode();openDoc(docs.get('begin.js')??docs.values().next().value);

    savedDirectory=await rememberDirectory().catch(()=>null);
    if(savedDirectory&&await savedDirectory.queryPermission({mode:'readwrite'})==='granted')await connectFolder();
}catch(e){status('Could not open programs',true);notice(e.message);}
// Expose the workspace for integrations and automated editor checks.
window.JScratchEditor={workspace,bridge,catalog,docs,get current(){return current;},capture,save,loadDoc,setFiles,setPalette,symbols};
