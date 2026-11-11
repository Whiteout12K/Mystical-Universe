export function projectPaths(moduleUrl){
    const root=new URL('../',moduleUrl);
    return {root,storagePath:new URL('editor',root).pathname,url:path=>new URL(path,root)};
}
// Keep existing browser layouts when moving editor.html into editor/.
export function migrateEditorStorage(storage,canonical,current){
    const aliases=[canonical+'.html',canonical+'/',canonical+'/index',canonical+'/index.html',current].filter(path=>path!==canonical),prefixes=['jscratch-editor-files:','jscratch-editor-v1:','jscratch-layout-v1:','jscratch-symbols:','jscratch-run-entry:'];
    const keys=Array.from({length:storage.length},(_,i)=>storage.key(i));
    for(const key of keys)for(const prefix of prefixes)for(const alias of aliases){const old=prefix+alias;if(key===old||key?.startsWith(old+':')){const next=prefix+canonical+key.slice(old.length);if(storage.getItem(next)===null)storage.setItem(next,storage.getItem(key));}}
}
