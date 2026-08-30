// Data Blocks

let PLAYER={
    username:"",
    password:"",
    loggedIn:false,
    data:{},
    loaded:false,
    loading:null
};


// Internal Player Data Loader
// Uses the function/api/me path of Cloudflare's D1 Database.
// To set one up, simply follow the instructions online.
// Create your own working table with parameters: username, password, save_data.

async function _loadPlayerData(){
    if(PLAYER.loading)return PLAYER.loading;

    PLAYER.loading=(async()=>{
        try{
            const response=await fetch(
                "/api/me",
                {cache:"no-store"}
            );

            if(!response.ok)
                throw Error(`HTTP ${response.status}`);

            const result=await response.json();
            const user=result?.user||result;

            if(!(result?.authenticated&&user?.username)){
                PLAYER={
                    username:"",
                    password:"",
                    loggedIn:false,
                    data:{},
                    loaded:true,
                    loading:null
                };
                return PLAYER;
            }

            PLAYER.username=String(user.username);
            PLAYER.password=String(
                user.password??result.password??""
            );
            PLAYER.loggedIn=true;

            let data=parsePlayerData(
                user.data??
                result.data??
                user.save_data??
                result.save_data
            );

            if(
                !data||
                typeof data!=="object"||
                Array.isArray(data)||
                !Object.keys(data).length
            ){
                try{
                    const profile=await fetch(
                        `/api/user/${encodeURIComponent(PLAYER.username)}`,
                        {cache:"no-store"}
                    );

                    if(profile.ok){
                        const profileResult=
                            await profile.json();

                        data=parsePlayerData(
                            profileResult?.data??
                            profileResult?.save_data??
                            profileResult?.user?.data??
                            profileResult?.user?.save_data
                        );
                    }
                }catch(error){
                    console.error(
                        "Unable to load player profile data:",
                        error
                    );
                }
            }

            PLAYER.data=
                data&&
                typeof data==="object"&&
                !Array.isArray(data)
                    ?data:{};

        }catch(error){
            console.error(
                "Unable to load player data:",
                error
            );

            PLAYER={
                username:"",
                password:"",
                loggedIn:false,
                data:{},
                loaded:true,
                loading:null
            };
        }

        PLAYER.loaded=true;
        PLAYER.loading=null;

        return PLAYER;
    })();

    return PLAYER.loading;
}


// Load Player Data

registerBlock("loadPlayerData",async()=>{
    await _loadPlayerData();
});


// Player Data Reporters

registerReporter("getUsername",()=>{
    if(!PLAYER.loaded)return"";
    return PLAYER.username;
});


registerReporter("getLoggedIn",()=>{
    if(!PLAYER.loaded)return false;
    return PLAYER.loggedIn;
});


registerReporter("getData",block=>{
    if(!PLAYER.loaded)return 0;

    const key=resolveValue(block.key);

    if(
        key===undefined||
        key===null||
        key===""
    )
        return formatDataResult(PLAYER.data);

    const value=getNestedData(
        PLAYER.data,
        String(key).trim()
    );

    if(value===undefined||value===null)
        return 0;

    return formatDataResult(value);
});


// Convert returned data into a value that can safely
// be displayed by the engine.

function formatDataResult(value){
    if(value===undefined||value===null)
        return 0;

    if(typeof value==="string")
        return value;

    if(typeof value==="number")
        return Number.isFinite(value)?value:0;

    if(typeof value==="boolean")
        return value;

    if(typeof value==="object"){
        try{
            return JSON.stringify(value);
        }catch(error){
            console.error(
                "Unable to format data value:",
                error
            );
            return 0;
        }
    }

    return String(value);
}


// Parse Player Data

function parsePlayerData(data){
    if(data===null||data===undefined)
        return{};

    if(typeof data==="string"){
        try{
            const parsed=JSON.parse(data);

            return parsed&&
                typeof parsed==="object"&&
                !Array.isArray(parsed)
                    ?parsed:{};
        }catch{
            return data;
        }
    }

    return data;
}


// Parse a value supplied to updateData.

function parseDataValue(value){
    if(value===undefined)
        return null;

    if(value===null)
        return null;

    if(typeof value==="number")
        return Number.isFinite(value)?value:0;

    if(typeof value==="boolean")
        return value;

    if(typeof value==="object"){
        try{
            return JSON.parse(JSON.stringify(value));
        }catch(error){
            console.error(
                "Unable to serialize data value:",
                error
            );
            return null;
        }
    }

    if(typeof value==="string"){
        const text=value.trim();

        // Only attempt JSON parsing when the string
        // looks like an object or array.
        if(
            (text.startsWith("{")&&text.endsWith("}"))||
            (text.startsWith("[")&&text.endsWith("]"))
        ){
            try{
                return JSON.parse(text);
            }catch{
                // Keep it as a normal string if invalid JSON.
            }
        }

        return value;
    }

    return String(value);
}


// Get Nested Data

function getNestedData(data,path){
    if(
        data===null||
        data===undefined||
        typeof data!=="object"
    )
        return undefined;

    const parts=parseDataPath(path);

    if(!parts.length)
        return data;

    let value=data;

    for(const part of parts){
        if(value===null||value===undefined)
            return undefined;

        if(Array.isArray(value)){
            const index=Number(part);

            if(
                !Number.isInteger(index)||
                index<0||
                index>=value.length
            )
                return undefined;

            value=value[index];
            continue;
        }

        if(typeof value!=="object")
            return undefined;

        if(Object.prototype.hasOwnProperty.call(value,part))
            value=value[part];
        else
            return undefined;
    }

    return value;
}


// Parse Data Path
//
// Supports:
//
// inventory1
// inventory1[0]
// inventory1[0].name
// c1.equip.weapon[0].name
// settings["music_volume"]
// settings['music_volume']

function parseDataPath(path){
    return String(path)
        .replace(
            /\[["']?([^"'[\]]+)["']?\]/g,
            ".$1"
        )
        .split(".")
        .map(v=>v.trim())
        .filter(Boolean);
}


// Set Nested Data

function setNestedData(data,path,value){
    const parts=parseDataPath(path);

    if(!parts.length)
        return;

    let current=data;

    for(let i=0;i<parts.length-1;i++){
        const key=parts[i];
        const next=parts[i+1];

        if(
            current[key]===undefined||
            current[key]===null||
            typeof current[key]!=="object"
        )
            current[key]=/^\d+$/.test(next)?[]:{};

        current=current[key];
    }

    current[parts[parts.length-1]]=value;
}


// Update Data

registerBlock("updateData",async block=>{
    if(!PLAYER.loaded){
        console.error(
            "Unable to update data: loadPlayerData must run first."
        );
        return false;
    }

    if(!PLAYER.loggedIn||!PLAYER.username){
        console.error(
            "Unable to update data: player is not logged in."
        );
        return false;
    }

    if(!PLAYER.password){
        console.error(
            "Unable to update data: no password was provided by /api/me."
        );
        return false;
    }

    const path=String(
        resolveValue(block.data)
    ).trim();

    if(!path){
        console.error(
            "Unable to update data: data name is required."
        );
        return false;
    }

    const value=resolveValue(block.value);
    const parsedValue=parseDataValue(value);

    const params=new URLSearchParams();

    params.set(
        "password",
        PLAYER.password
    );

    params.set(
        path,
        typeof parsedValue==="object"&&
        parsedValue!==null
            ?JSON.stringify(parsedValue)
            :String(parsedValue)
    );

    try{
        const response=await fetch(
            `/edit/${encodeURIComponent(PLAYER.username)}?${params}`,
            {
                method:"GET",
                cache:"no-store"
            }
        );

        let result={};

        try{
            result=await response.json();
        }catch{}

        if(
            !response.ok||
            result.success===false
        ){
            console.error(
                "Unable to update player data:",
                result?.error||
                `HTTP ${response.status}`
            );
            return false;
        }

        if(
            result.data&&
            typeof result.data==="object"&&
            !Array.isArray(result.data)
        ){
            PLAYER.data=result.data;
        }else{
            setNestedData(
                PLAYER.data,
                path,
                parsedValue
            );
        }

        return true;

    }catch(error){
        console.error(
            "Unable to update player data:",
            error
        );
        return false;
    }
});


registerBlock("changeDataBy",async block=>{
    if(!PLAYER.loaded){
        console.error(
            "Unable to change data: loadPlayerData must run first."
        );
        return false;
    }

    if(!PLAYER.loggedIn||!PLAYER.username){
        console.error(
            "Unable to change data: player is not logged in."
        );
        return false;
    }

    if(!PLAYER.password){
        console.error(
            "Unable to change data: no password was provided by /api/me."
        );
        return false;
    }

    const path=String(
        resolveValue(block.data)
    ).trim();

    if(!path){
        console.error(
            "Unable to change data: data name is required."
        );
        return false;
    }

    const amount=Number(
        resolveValue(block.amount)
    );

    if(!Number.isFinite(amount)){
        console.error(
            "Unable to change data: amount must be a number."
        );
        return false;
    }

    const current=getNestedData(
        PLAYER.data,
        path
    );

    const currentValue=Number(current);

    const oldValue=
        Number.isFinite(currentValue)
            ?currentValue
            :0;

    const newValue=oldValue+amount;

    const params=new URLSearchParams();

    params.set(
        "password",
        PLAYER.password
    );

    params.set(
        path,
        String(newValue)
    );

    try{
        const response=await fetch(
            `/edit/${encodeURIComponent(PLAYER.username)}?${params}`,
            {
                method:"GET",
                cache:"no-store"
            }
        );

        let result={};

        try{
            result=await response.json();
        }catch{}

        if(
            !response.ok||
            result.success===false
        ){
            console.error(
                "Unable to change player data:",
                result?.error||
                `HTTP ${response.status}`
            );
            return false;
        }

        if(
            result.data&&
            typeof result.data==="object"&&
            !Array.isArray(result.data)
        ){
            PLAYER.data=result.data;
        }else{
            setNestedData(
                PLAYER.data,
                path,
                newValue
            );
        }

        return true;

    }catch(error){
        console.error(
            "Unable to change player data:",
            error
        );
        return false;
    }
});


// Data Block Creation

function createDataBlock(type,data={}){
    const block=createBlock(type,data);

    ENGINE.recordBlock(block);

    return block;
}


function loadPlayerData(){
    return createDataBlock(
        "loadPlayerData"
    );
}


function getUsername(){
    return createReporter(
        "getUsername",
        {}
    );
}


function getLoggedIn(){
    return createReporter(
        "getLoggedIn",
        {}
    );
}


function getData(key){
    return createReporter(
        "getData",
        {key}
    );
}


function updateData(data,value){
    return createDataBlock(
        "updateData",
        {
            data,
            value
        }
    );
}


function changeDataBy(data,amount){
    return createDataBlock(
        "changeDataBy",
        {
            data,
            amount
        }
    );
}


function refreshPlayerData(){
    return createDataBlock(
        "loadPlayerData"
    );
}
