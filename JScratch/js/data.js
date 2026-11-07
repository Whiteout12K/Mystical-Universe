// Data Blocks

let PLAYER={
    username:"",password:"",loggedIn:false,data:{},loaded:false,loading:null
};

const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const validObj=v=>v&&typeof v==="object"&&!Array.isArray(v);
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
        const snapshot={username:"",password:"",loggedIn:false,data:{},loaded:true,loading:null};
        try{
            const result=await runtimeFetchJson("/api/me",{cache:"no-store"},c),user=result?.user||result;
            if(result?.authenticated&&user?.username){
                snapshot.username=String(user.username);
                snapshot.password=String(user.password??result.password??"");
                snapshot.loggedIn=true;
                let data=parsePlayerData(user.data??result.data??user.save_data??result.save_data);
                if(!validObj(data)||!Object.keys(data).length){
                    try{
                        const profile=await runtimeFetchJson(`/api/user/${encodeURIComponent(snapshot.username)}`,{cache:"no-store"},c);
                        data=parsePlayerData(profile?.data??profile?.save_data??profile?.user?.data??profile?.user?.save_data);
                    }catch(error){if(contextActive(c))console.warn("Unable to load player profile:",error);}
                }
                snapshot.data=validObj(data)?data:{};
            }
        }catch(error){if(contextActive(c))console.warn("Unable to load player data:",error);}
        if(contextActive(c))PLAYER=snapshot;
        return snapshot;
    })();
    PLAYER.loading=load;
    try{return await load;}finally{if(PLAYER.loading===load)PLAYER.loading=null;}
}
registerBlock("loadPlayerData",async(b,c)=>{await _loadPlayerData(c);});

registerReporter("getUsername",()=>PLAYER.loaded?PLAYER.username:"");
registerReporter("getLoggedIn",()=>PLAYER.loaded?PLAYER.loggedIn:false);

registerReporter("getData",(b,c)=>{
    if(!PLAYER.loaded)return 0;
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

function parsePlayerData(data){
    if(data==null)return{};
    if(typeof data==="string"){
        try{
            const v=JSON.parse(data);
            return validObj(v)?v:{};
        }catch{return data;}
    }
    return data;
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
    if(!validObj(data)&&!Array.isArray(data))return undefined;

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

function playerAuthError(action){
    if(!PLAYER.loaded){
        console.error(`Unable to ${action}: loadPlayerData must run first.`);
        return false;
    }
    if(!PLAYER.loggedIn||!PLAYER.username){
        console.error(`Unable to ${action}: player is not logged in.`);
        return false;
    }
    if(!PLAYER.password){
        console.error(`Unable to ${action}: no password was provided by /api/me.`);
        return false;
    }
    return true;
}

async function editPlayerData(path,value,c){
    const params=new URLSearchParams({password:PLAYER.password});
    params.set(
        path,
        typeof value==="object"&&value!==null?JSON.stringify(value):String(value)
    );

    try{
        const result=await runtimeFetchJson(
            `/edit/${encodeURIComponent(PLAYER.username)}?${params}`,
            {method:"GET",cache:"no-store"},c
        );
        if(!contextActive(c)||result.success===false)return null;

        return result;
    }catch(e){
        console.error("Unable to update player data:",e);
        return null;
    }
}

// Save operations are ordered within a run so concurrent increments cannot overwrite
// one another. Other gameplay scripts keep running while the request is pending.
const playerWriteQueues=new Map();
function registerPlayerWrite(type,handler){
    registerBlock(type,(b,c)=>{
        const data={...b,data:resolveValue(b.data,c)};
        if("value" in b)data.value=resolveValue(b.value,c);
        if("amount" in b)data.amount=resolveValue(b.amount,c);
        const previous=playerWriteQueues.get(c.runId)||Promise.resolve();
        const pending=previous.catch(()=>{}).then(()=>contextActive(c)?handler(data,c):false);
        playerWriteQueues.set(c.runId,pending);
        return pending.finally(()=>{if(playerWriteQueues.get(c.runId)===pending)playerWriteQueues.delete(c.runId);});
    });
}

registerPlayerWrite("updateData",async(b,c)=>{
    if(!playerAuthError("update data"))return false;

    const path=String(resolveValue(b.data,c)).trim();
    if(!path){
        console.error("Unable to update data: data name is required.");
        return false;
    }

    const value=parseDataValue(resolveValue(b.value,c));
    const result=await editPlayerData(path,value,c);
    if(!result||!contextActive(c))return false;

    if(validObj(result.data))PLAYER.data=result.data;
    else setNestedData(PLAYER.data,path,value);

    return true;
});

registerPlayerWrite("changeDataBy",async(b,c)=>{
    if(!playerAuthError("change data"))return false;

    const path=String(resolveValue(b.data,c)).trim();
    if(!path){
        console.error("Unable to change data: data name is required.");
        return false;
    }

    const amount=Number(resolveValue(b.amount,c));
    if(!Number.isFinite(amount)){
        console.error("Unable to change data: amount must be a number.");
        return false;
    }

    const current=Number(getNestedData(PLAYER.data,path));
    const value=(Number.isFinite(current)?current:0)+amount;
    const result=await editPlayerData(path,value,c);

    if(!result||!contextActive(c))return false;

    if(validObj(result.data))PLAYER.data=result.data;
    else setNestedData(PLAYER.data,path,value);

    return true;
});


/* Data Block Creation */

function loadPlayerData(){return createDataBlock("loadPlayerData");}
function getUsername(){return createReporter("getUsername",{});}
function getLoggedIn(){return createReporter("getLoggedIn",{});}
function getData(key){return createReporter("getData",{key});}
function updateData(data,value){return createDataBlock("updateData",{data,value});}
function changeDataBy(data,amount){return createDataBlock("changeDataBy",{data,amount});}
function refreshPlayerData(){return createDataBlock("loadPlayerData");}