import {validateProgramPath,folderHandle} from './project.mjs';
// Browser file access keeps editing independent of the development server.
export async function saveProgramFile(directory,name,source,expected){
    validateProgramPath(name);
    const parts=name.split('/'),filename=parts.pop();directory=await folderHandle(directory,parts.join('/'),true);
    name=filename;
    let handle,existing=null;
    try{handle=await directory.getFileHandle(name);existing=await (await handle.getFile()).text();}
    catch(e){if(e.name!=='NotFoundError')throw e;}
    if(existing!==expected)throw new Error(name+' changed on disk. Copy your draft from Code, then reconnect the folder to merge changes.');
    handle??=await directory.getFileHandle(name,{create:true});
    const stream=await handle.createWritable();
    try{await stream.write(source);await stream.close();}catch(error){await stream.abort?.().catch(()=>{});throw error;}
}
export async function rememberDirectory(handle){
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open('jscratch-editor',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('settings');
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{
            const db=request.result,transaction=db.transaction('settings',handle?'readwrite':'readonly'),store=transaction.objectStore('settings');
            const operation=handle?store.put(handle,'program-directory'):store.get('program-directory');
            let result;operation.onsuccess=()=>{result=operation.result;};
            transaction.oncomplete=()=>{db.close();resolve(result);};transaction.onerror=()=>{db.close();reject(transaction.error);};
        };
    });
}

export async function saveProjectManifest(directory,project){
    const handle=await directory.getFileHandle('project.json',{create:true}),stream=await handle.createWritable();
    try{await stream.write(JSON.stringify(project,null,2)+'\n');await stream.close();}catch(error){await stream.abort?.().catch(()=>{});throw error;}
}

export async function saveEditorData(directory,data){
    const handle=await directory.getFileHandle('editor-data.json',{create:true}),stream=await handle.createWritable();
    try{await stream.write(JSON.stringify(data,null,2)+'\n');await stream.close();}catch(error){await stream.abort?.().catch(()=>{});throw error;}
}
export async function readEditorData(directory){
    try{return JSON.parse(await(await(await directory.getFileHandle('editor-data.json')).getFile()).text());}
    catch(error){if(error.name==='NotFoundError')return null;throw error;}
}

// Positions/view only: executable program source stays in its .js files.
export async function saveEditorLayouts(directory,data){
    const handle=await directory.getFileHandle('editor-layouts.json',{create:true}),stream=await handle.createWritable();
    try{await stream.write(JSON.stringify(data,null,2)+'\n');await stream.close();}catch(error){await stream.abort?.().catch(()=>{});throw error;}
}
export async function readEditorLayouts(directory){
    try{return JSON.parse(await(await(await directory.getFileHandle('editor-layouts.json')).getFile()).text());}
    catch(error){if(error.name==='NotFoundError')return null;throw error;}
}
