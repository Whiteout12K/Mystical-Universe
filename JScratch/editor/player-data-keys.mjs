import '../js/player-store.js';

const store=globalThis.PlayerStore;
const unsafe=new Set(['__proto__','prototype','constructor']);

export function playerDataKeys(data){
    const paths=[],pending=[[data,'']];
    while(pending.length){
        const [object,parent]=pending.pop();
        if(!object||typeof object!=='object')continue;
        for(const [key,value] of Object.entries(object)){
            if(!key||key!==key.trim()||/[.\[\]]/.test(key)||unsafe.has(key))continue;
            const path=parent?parent+'.'+key:key;
            paths.push(path);
            if(value&&typeof value==='object')pending.push([value,path]);
        }
    }
    return paths.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

export function cachedPlayerKeys(){
    const account=store.localAccount();
    const save=account&&store.record(account);
    return {account,save,keys:playerDataKeys(save?.data)};
}

export async function loadPlayerKeys(){
    try{
        if(store.isSignedOut())return [];
        const cached=cachedPlayerKeys();
        if(cached.save?.dirty)return cached.keys;
        const response=await fetch('/api/save',{cache:'no-store',signal:AbortSignal.timeout(2500)});
        const profile=response.ok?await response.json():null;
        if(store.isSignedOut())return [];
        const current=cachedPlayerKeys();
        if(current.save?.dirty)return current.keys;
        if(profile?.authenticated&&(!current.account||store.matchesCloud(current.account,profile))){
            return playerDataKeys(profile.data);
        }
        return current.keys;
    }catch{
        return cachedPlayerKeys().keys;
    }
}
