// Browser file access keeps editing independent of the development server.
export async function saveProgramFile(directory,name,source,expected){
    let handle,existing=null;
    try{handle=await directory.getFileHandle(name);existing=await (await handle.getFile()).text();}
    catch(e){if(e.name!=='NotFoundError')throw e;}
    if(existing!==expected)throw new Error(name+' changed on disk. Download your draft, then reopen the folder to merge changes.');
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
