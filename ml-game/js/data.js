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
        return PLAYER.data;

    const value=getNestedData(
        PLAYER.data,
        String(key).trim()
    );

    if(value===undefined||value===null)
        return 0;

    if(typeof value==="string")
        return value;

    if(typeof value==="number")
        return Number.isFinite(value)?value:0;

    if(typeof value==="boolean")
        return value;

    return value;
});


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


function getNestedData(data,path){
    if(!data||typeof data!=="object")
        return undefined;

    const parts=parseDataPath(path);
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


function setNestedData(data,path,value){
    const parts=parseDataPath(path);

    if(!parts.length)return;

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
    let parsedValue=value;

    if(typeof value==="number"){
        parsedValue=Number.isFinite(value)
            ?value
            :0;
    }else if(value===undefined){
        parsedValue=null;
    }else if(
        value!==null&&
        typeof value!=="string"&&
        typeof value!=="boolean"
    ){
        try{
            parsedValue=JSON.parse(
                JSON.stringify(value)
            );
        }catch(error){
            console.error(
                "Unable to serialize data value:",
                error
            );
            return false;
        }
    }

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
        )
            PLAYER.data=result.data;
        else
            setNestedData(
                PLAYER.data,
                path,
                parsedValue
            );

        return true;

    }catch(error){
        console.error(
            "Unable to update player data:",
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


function refreshPlayerData(){
    return createDataBlock(
        "loadPlayerData"
    );
}

