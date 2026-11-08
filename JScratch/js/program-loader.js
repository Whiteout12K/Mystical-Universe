/* All game files register their hats before any startup script is allowed to run. */
ENGINE.programReady=(async()=>{
    const response=await fetch('program/project.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Cannot load program/project.json');
    const project=await response.json();
    if(!Array.isArray(project.files))throw new Error('project.json requires a files array');
    const files=[...new Set(project.files)];
    for(const path of files){
        if(typeof path!=='string'||! /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(path)||path==='sample.js'||path.startsWith('reference/'))throw new Error('Invalid executable program path: '+path);
    }
    // Fetch together, then execute as classic scripts. Event registration completes
    // for every file before the promise resolves; broadcasts can target any file.
    const sources=await Promise.all(files.map(async path=>{
        const response=await fetch('program/'+path,{cache:'no-store'});
        if(!response.ok)throw new Error('Cannot load program/'+path);
        return {path,source:await response.text()};
    }));
    for(const {path,source} of sources){
        const script=document.createElement('script');
        script.textContent=source+'\n//# sourceURL='+new URL('program/'+path,location.href).href;
        let failure=null;const onError=event=>{failure=event.error??new Error(event.message);};
        window.addEventListener('error',onError);
        try{document.head.append(script);}finally{window.removeEventListener('error',onError);script.remove();}
        if(failure)throw failure;
    }
})();
// Attach a rejection handler immediately; startRuntime reports the failure.
ENGINE.programReady.catch(()=>{});
