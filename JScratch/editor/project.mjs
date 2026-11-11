// Shared project paths: browser editor, manifest builder, and tests.
export function validateProgramPath(path,extension='.js'){
    if(typeof path!=='string'||!path.endsWith(extension))throw new Error('Choose a '+extension+' file inside program/.');
    const parts=path.slice(0,-extension.length).split('/');
    if(!parts.length||parts.some(p=>!p||! /^[A-Za-z0-9_-]+$/.test(p)))throw new Error('Use letters, numbers, - and _ for folder and file names.');
    return path;
}
export function validateFolderPath(path){if(typeof path!=='string'||path.split('/').some(p=>! /^[A-Za-z0-9_-]+$/.test(p)))throw new Error('Use letters, numbers, - and _ for folders.');return path;}
export function makeProject(files,folders=[]){
    const paths=[...new Set(files)].map(p=>validateProgramPath(p)).sort();
    const allFolders=new Set(folders.map(validateFolderPath));
    for(const path of [...paths,...folders]){const parts=path.split('/');parts.pop();while(parts.length){allFolders.add(parts.join('/'));parts.pop();}}
    const reference=p=>p==='sample.js'||p.startsWith('reference/');
    return {version:1,files:paths.filter(p=>!reference(p)),references:paths.filter(reference),folders:[...allFolders].sort()};
}
export function projectFiles(project){return [...new Set([...(project.files??[]),...(project.references??[])])].map(p=>validateProgramPath(p));}
export async function readProgramDirectory(directory,prefix=''){
    const files=[],folders=[];
    for await(const [name,handle] of directory.entries()){
        if(!/^[A-Za-z0-9_-]+(?:\.js)?$/.test(name)||name.startsWith('.'))continue;
        const path=prefix+name;
        if(handle.kind==='directory'){
            if(!/^[A-Za-z0-9_-]+$/.test(name))continue;
            folders.push(path);const nested=await readProgramDirectory(handle,path+'/');files.push(...nested.files);folders.push(...nested.folders);
        }else if(name.endsWith('.js'))files.push({name:path,source:await(await handle.getFile()).text()});
    }
    return {files,folders};
}
export async function folderHandle(directory,path,create=false){
    let handle=directory;
    if(path)for(const name of path.split('/')){if(!/^[A-Za-z0-9_-]+$/.test(name))throw new Error('Invalid folder');handle=await handle.getDirectoryHandle(name,{create});}
    return handle;
}

export async function projectDirectories(handle){
    // Old program-only grants remain useful for source autosave. Metadata then
    // stays in browser storage until the JScratch parent folder is selected.
    if(handle.name==='program')return {program:handle,editor:null,root:null};
    let program;try{program=await handle.getDirectoryHandle('program');}catch{throw new Error('Select the JScratch folder containing program/ and editor/.');}
    return {program,editor:await handle.getDirectoryHandle('editor',{create:true}),root:handle};
}
