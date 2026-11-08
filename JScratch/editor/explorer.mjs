export function renderExplorer(element,files,folders,current,onFile,onFolder){
    const root={folders:new Map(),files:[]};
    function folder(path){let node=root;for(const name of path.split('/').filter(Boolean)){if(!node.folders.has(name))node.folders.set(name,{folders:new Map(),files:[]});node=node.folders.get(name);}return node;}
    for(const path of folders)folder(path);
    for(const path of files){const parts=path.split('/'),name=parts.pop();folder(parts.join('/')).files.push({name,path});}
    function children(node,prefix=''){
        const fragment=document.createDocumentFragment();
        for(const [name,child] of [...node.folders].sort(([a],[b])=>a.localeCompare(b))){
            const details=document.createElement('details');details.open=true;
            const summary=document.createElement('summary');summary.textContent=name;summary.title=prefix+name;summary.onclick=()=>onFolder(prefix+name);details.append(summary,children(child,prefix+name+'/'));fragment.append(details);
        }
        for(const file of node.files.sort((a,b)=>a.name.localeCompare(b.name))){const button=document.createElement('button');button.className='file-row'+(file.path===current?' active':'');button.textContent=file.name;button.title=file.path;button.setAttribute('aria-current',file.path===current?'page':'false');button.onclick=()=>onFile(file.path);fragment.append(button);}
        return fragment;
    }
    element.replaceChildren(children(root));
}
