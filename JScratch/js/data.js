// Data Blocks

let PLAYER={
    username:"",account:null,loggedIn:false,data:{},loaded:false,loading:null
};

const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const createDataBlock=(type,data={})=>{
    const b=createBlock(type,data);
    ENGINE.recordBlock(b);
    return b;
};

let playerLoadRun=-1;
async function _loadPlayerData(c=createScriptContext()){
    if(PLAYER.loading&&playerLoadRun===c.runId)return PLAYER.loading;
    playerLoadRun=c.runId;
    const load=(async()=>{
        const snapshot={username:"",account:null,loggedIn:false,data:{},loaded:true,loading:null};
        try{
            const cached=PlayerStore.localAccount();
            if(cached)Object.assign(snapshot,{account:cached,username:cached.username,loggedIn:true,data:PlayerStore.record(cached)?.data??{}});
            if(!PlayerStore.isSignedOut()){
                const cloud=await fetchPlayerSave(c);
                if(!contextActive(c))return snapshot;
                const online=PlayerStore.activateCloud(cloud);
                if(online){
                    const {account,saved}=online;
                    Object.assign(snapshot,{account,username:account.username,loggedIn:true,data:saved.data});
                }
            }
        }catch(error){
            if(contextActive(c)&&snapshot.account)console.warn("D1 is unavailable. Using the browser save.",error);
        }
        if(contextActive(c))PLAYER=snapshot;
        return snapshot;
    })();
    PLAYER.loading=load;
    try{return await load;}finally{if(PLAYER.loading===load)PLAYER.loading=null;}
}
function fetchPlayerSave(c){
    return runtimeFetchJson("/api/save",{cache:"no-store"},c,2500);
}

const refreshPlayerOnReturn=()=>{
    if(PLAYER.loaded&&ENGINE.running){
        void _loadPlayerData(createScriptContext());
    }
};
window.addEventListener("focus",refreshPlayerOnReturn);
window.addEventListener("online",refreshPlayerOnReturn);

registerBlock("loadPlayerData",async(b,c)=>{await _loadPlayerData(c);});

function activePlayer(){
    const account=PLAYER.account;
    if(!PLAYER.loaded||!PLAYER.loggedIn||!account)return null;
    const active=PlayerStore.localAccount();
    if(active?.id!==account.id||active.mode!==account.mode)return null;
    return account;
}

function syncPlayerRecord(){
    try{
        const account=activePlayer();
        if(account)PLAYER.data=PlayerStore.record(account)?.data??PLAYER.data;
        return account;
    }catch(error){
        console.warn("Unable to read player save:",error);
        return null;
    }
}

registerReporter("getUsername",()=>syncPlayerRecord()?PLAYER.username:"");
registerReporter("getLoggedIn",()=>Boolean(syncPlayerRecord()));

registerReporter("getData",(b,c)=>{
    if(!syncPlayerRecord())return 0;
    const key=resolveValue(b.key,c);
    if(key==null||key==="")return formatDataResult(PLAYER.data);
    const v=getNestedData(PLAYER.data,String(key).trim());
    return v==null?0:formatDataResult(v);
});

function formatDataResult(v){
    if(v==null)return 0;
    if(typeof v==="string"||typeof v==="boolean")return v;
    if(typeof v==="number")return Number.isFinite(v)?v:0;
    if(typeof v==="object"){
        try{return JSON.stringify(v);}
        catch(e){console.error("Unable to format data value:",e);return 0;}
    }
    return String(v);
}

function parseDataValue(v){
    if(v==null)return null;
    if(typeof v==="number")return Number.isFinite(v)?v:0;
    if(typeof v==="boolean")return v;
    if(typeof v==="object"){
        try{return JSON.parse(JSON.stringify(v));}
        catch(e){console.error("Unable to serialize data value:",e);return null;}
    }
    if(typeof v==="string"){
        const s=v.trim();
        if((s[0]==="{"&&s.at(-1)==="}")||(s[0]==="["&&s.at(-1)==="]"))
            try{return JSON.parse(s)}catch{}
        return v;
    }
    return String(v);
}

function parseDataPath(path){
    return String(path)
        .replace(/\[["']?([^"'[\]]+)["']?\]/g,".$1")
        .split(".").map(v=>v.trim()).filter(Boolean);
}

function getNestedData(data,path){
    if(!data||typeof data!=="object")return undefined;

    const parts=parseDataPath(path);
    if(!parts.length)return data;

    let v=data;

    for(const p of parts){
        if(v==null)return undefined;

        if(Array.isArray(v)){
            const i=Number(p);
            if(!Number.isInteger(i)||i<0||i>=v.length)return undefined;
            v=v[i];
        }else{
            if(typeof v!=="object"||!own(v,p))return undefined;
            v=v[p];
        }
    }

    return v;
}

function setNestedData(data,path,value){
    const parts=parseDataPath(path);
    if(!parts.length)return;
    if(parts.some(k=>["__proto__","prototype","constructor"].includes(k)))throw new Error("Unsafe data path");

    let v=data;
    for(let i=0;i<parts.length-1;i++){
        const k=parts[i],next=parts[i+1];
        if(v[k]==null||typeof v[k]!=="object")
            v[k]=/^\d+$/.test(next)?[]:{};
        v=v[k];
    }
    v[parts.at(-1)]=value;
}

function savePlayerChange(block, change){
    const account=activePlayer();
    if(!account){
        console.warn("Sign in and load player data before saving.");
        return false;
    }
    const path=String(block.data).trim();
    if(!parseDataPath(path).length)throw new Error("A player data name is required.");
    const saved=PlayerStore.record(account);
    const data=JSON.parse(JSON.stringify(saved?.data??PLAYER.data));
    setNestedData(data,path,change(getNestedData(data,path)));
    PLAYER.data=PlayerStore.stage(account,data,saved).data;
    return true;
}

// For each run, order mutations and uploads across all its scripts.
const playerWriteQueues=new Map();
function queuePlayerWrite(c,handler){
    const account=activePlayer();
    const previous=playerWriteQueues.get(c.runId)||Promise.resolve();
    const pending=previous.catch(()=>{}).then(()=>{
        if(!contextActive(c))return false;
        const current=activePlayer();
        if(current?.mode!==account?.mode||current?.id!==account?.id)return false;
        return handler();
    });
    playerWriteQueues.set(c.runId,pending);
    return pending.finally(()=>{if(playerWriteQueues.get(c.runId)===pending)playerWriteQueues.delete(c.runId);});
}

function registerPlayerWrite(type,handler){
    registerBlock(type,(b,c)=>{
        const data={...b,data:resolveValue(b.data,c)};
        if("value" in b)data.value=resolveValue(b.value,c);
        if("amount" in b)data.amount=resolveValue(b.amount,c);
        return queuePlayerWrite(c,()=>handler(data,c));
    });
}

registerPlayerWrite("updateData",b=>savePlayerChange(b,()=>parseDataValue(b.value)));

registerPlayerWrite("changeDataBy",b=>savePlayerChange(b,previous=>{
    const amount=Number(b.amount);
    if(!Number.isFinite(amount))throw new Error("The player data increment must be a number.");
    const current=Number(previous);
    return (Number.isFinite(current)?current:0)+amount;
}));

function addPlayerDataField(path,value){
    const account=activePlayer();
    if(!account)return false;
    const saved=PlayerStore.record(account);
    const data=JSON.parse(JSON.stringify(saved?.data??PLAYER.data));
    if(!PlayerStore.addMissingField(data,path,value))return false;
    PLAYER.data=PlayerStore.stage(account,data,saved).data;
    return true;
}

async function uploadPlayerSave(c){
    try{
        const account=activePlayer();
        if(!account)throw new Error("Sign in and load player data before uploading.");
        const isLocal=account.mode==="local";
        const cloud=await fetchPlayerSave(c);
        if(!contextActive(c))return false;
        const current=activePlayer();
        if(current?.id!==account.id||current.mode!==account.mode)return false;
        if(!PlayerStore.matchesCloud(account,cloud)){
            throw new Error("Sign in to the matching website account on this server first.");
        }
        const cloudAccount=PlayerStore.cloudAccount(cloud);
        const saved=PlayerStore.acceptCloud(cloud,account);
        if(saved.revision!==cloud.revision){
            throw new Error("D1 and this browser changed the same save field. Your browser copy was kept.");
        }
        if(!saved.dirty)return true;
        const response=await runtimeFetchJson("/api/save",{
            method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
            body:PlayerStore.uploadBody(cloudAccount,saved)
        },c);
        if(!response.success)throw new Error(response.error||"D1 rejected the save.");
        if(contextActive(c))PlayerStore.markUploaded(account,saved,response.revision,
            isLocal?cloudAccount.id:undefined);
        return true;
    }catch(error){
        if(contextActive(c)){
            const message={
                "HTTP 401":"Sign in to the website again.",
                "HTTP 409":"D1 has a newer save. Your browser copy was kept.",
                "HTTP 503":"D1 is unavailable on this server."
            }[error.message]??error.message;
            console.warn("Save to D1 failed. Your browser save is still available.",message);
        }
        return false;
    }
}

/* Data Block Creation */

function loadPlayerData(){return createDataBlock("loadPlayerData");}
function getUsername(){return createReporter("getUsername",{});}
function getLoggedIn(){return createReporter("getLoggedIn",{});}
function getData(key){return createReporter("getData",{key});}
function updateData(data,value){return createDataBlock("updateData",{data,value});}
function changeDataBy(data,amount){return createDataBlock("changeDataBy",{data,amount});}
function refreshPlayerData(){return createDataBlock("loadPlayerData");}