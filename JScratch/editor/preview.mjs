// Open both windows during the Run click, before awaiting file saves.
export function previewWindows(screenInfo){
    const availableWidth=screenInfo.availWidth||1280,availableHeight=screenInfo.availHeight||800;
    const left=screenInfo.availLeft||0,top=screenInfo.availTop||0;
    const inspectorWidth=Math.min(520,Math.max(380,Math.round(availableWidth*.33)));
    const gameWidth=Math.max(480,availableWidth-inspectorWidth-24),height=Math.max(480,availableHeight-70);
    return {game:`popup=yes,width=${gameWidth},height=${height},left=${left},top=${top}`,inspector:`popup=yes,width=${inspectorWidth},height=${height},left=${left+Math.max(0,availableWidth-inspectorWidth)},top=${top}`};
}

export function inspectorSession(cryptoApi){
    if(typeof cryptoApi.randomUUID==='function')return cryptoApi.randomUUID();
    return Array.from(cryptoApi.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
}
