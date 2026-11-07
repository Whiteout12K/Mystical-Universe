// JSON Blocks

const JSON_DATA=Object.create(null);

const validJsonObj=v=>v&&typeof v==="object";
const createJsonBlock=(type,data={})=>{
    const b=createBlock(type,data);
    ENGINE.recordBlock(b);
    return b;
};

function parseJsonPath(path){
    return String(path??"")
        .replace(/\[["']?([^"'[\]]+)["']?\]/g,".$1")
        .split(".").map(v=>v.trim()).filter(Boolean);
}

function getNestedJson(data,path){
    if(data==null)return undefined;

    const parts=parseJsonPath(path);
    if(!parts.length)return data;

    let v=data;

    for(const p of parts){
        if(v==null)return undefined;

        if(Array.isArray(v)){
            const i=Number(p);
            if(!Number.isInteger(i)||i<0||i>=v.length)return undefined;
            v=v[i];
        }else{
            if(typeof v!=="object"||!Object.prototype.hasOwnProperty.call(v,p))
                return undefined;
            v=v[p];
        }
    }

    return v;
}

function formatJsonResult(v){
    if(v==null)return 0;
    if(typeof v==="string"||typeof v==="boolean")return v;
    if(typeof v==="number")return Number.isFinite(v)?v:0;

    if(typeof v==="object"){
        try{return JSON.stringify(v);}
        catch(e){
            console.error("Unable to format JSON value:",e);
            return 0;
        }
    }

    return String(v);
}

function parseJsonResult(v){
    if(v==null)return null;

    if(typeof v==="number")
        return Number.isFinite(v)?v:0;

    if(typeof v==="boolean")return v;

    if(typeof v==="object"){
        try{return JSON.parse(JSON.stringify(v));}
        catch(e){return null;}
    }

    if(typeof v==="string"){
        const s=v.trim();

        if(
            (s[0]==="{"&&s.at(-1)==="}")||
            (s[0]==="["&&s.at(-1)==="]")
        ){
            try{return JSON.parse(s)}
            catch{}
        }

        return v;
    }

    return String(v);
}

async function loadJsonFile(name,path,c=createScriptContext()){
    name=String(resolveValue(name,c)??"").trim();
    path=String(resolveValue(path,c)??"").trim();

    if(!name){
        console.error("Unable to load JSON: JSON name is required.");
        return false;
    }

    if(!path){
        console.error("Unable to load JSON: file path is required.");
        return false;
    }

    try{
        const data=await runtimeFetchJson(path,{cache:"no-store"},c);
        if(!contextActive(c))return false;

        if(!validJsonObj(data)){
            console.error("Unable to load JSON: file must contain a JSON object or array.");
            return false;
        }

        JSON_DATA[name]=data;
        return true;
    }catch(e){
        console.error(`Unable to load JSON "${name}":`,e);
        return false;
    }
}

registerBlock("getJson",async(b,c)=>{
    return await loadJsonFile(b.name,b.path,c);
});

registerBlock("removeJson",async(b,c)=>{
    const name=String(resolveValue(b.name,c)??"").trim();

    if(!name)return false;

    if(Object.prototype.hasOwnProperty.call(JSON_DATA,name))
        delete JSON_DATA[name];

    return true;
});


/* REPORTERS */

registerReporter("jsonLoaded",(b,c)=>{
    const name=String(resolveValue(b.name,c)??"").trim();
    return Object.prototype.hasOwnProperty.call(JSON_DATA,name);
});

registerReporter("jsonValue",(b,c)=>{
    const name=String(resolveValue(b.name,c)??"").trim();

    if(!Object.prototype.hasOwnProperty.call(JSON_DATA,name))
        return 0;

    const path=resolveValue(b.path,c);

    if(path==null||String(path).trim()==="")
        return formatJsonResult(JSON_DATA[name]);

    const value=getNestedJson(
        JSON_DATA[name],
        String(path).trim()
    );

    return formatJsonResult(value);
});

registerReporter("jsonExists",(b,c)=>{
    const name=String(resolveValue(b.name,c)??"").trim();

    if(!Object.prototype.hasOwnProperty.call(JSON_DATA,name))
        return false;

    const path=resolveValue(b.path,c);

    if(path==null||String(path).trim()==="")
        return true;

    return getNestedJson(
        JSON_DATA[name],
        String(path).trim()
    )!==undefined;
});

registerReporter("jsonKeys",(b,c)=>{
    const name=String(resolveValue(b.name,c)??"").trim();

    if(!Object.prototype.hasOwnProperty.call(JSON_DATA,name))
        return "";

    const path=resolveValue(b.path,c);
    const value=
        path==null||String(path).trim()===""
            ?JSON_DATA[name]
            :getNestedJson(JSON_DATA[name],String(path).trim());

    if(value==null||typeof value!=="object")
        return "";

    return Object.keys(value).join(",");
});

registerReporter("jsonLength",(b,c)=>{
    const name=String(resolveValue(b.name,c)??"").trim();

    if(!Object.prototype.hasOwnProperty.call(JSON_DATA,name))
        return 0;

    const path=resolveValue(b.path,c);
    const value=
        path==null||String(path).trim()===""
            ?JSON_DATA[name]
            :getNestedJson(JSON_DATA[name],String(path).trim());

    if(Array.isArray(value)||typeof value==="string")
        return value.length;

    if(value&&typeof value==="object")
        return Object.keys(value).length;

    return 0;
});

registerReporter("jsonType",(b,c)=>{
    const name=String(resolveValue(b.name,c)??"").trim();

    if(!Object.prototype.hasOwnProperty.call(JSON_DATA,name))
        return "";

    const path=resolveValue(b.path,c);
    const value=
        path==null||String(path).trim()===""
            ?JSON_DATA[name]
            :getNestedJson(JSON_DATA[name],String(path).trim());

    if(value===null)return "null";
    if(Array.isArray(value))return "array";

    return typeof value;
});


/* JSON BLOCK CREATION */

function getJson(name,path){
    return createJsonBlock("getJson",{name,path});
}

function removeJson(name){
    return createJsonBlock("removeJson",{name});
}

function jsonLoaded(name){
    return createReporter("jsonLoaded",{name});
}

function jsonValue(name,path=""){
    return createReporter("jsonValue",{name,path});
}

function jsonExists(name,path=""){
    return createReporter("jsonExists",{name,path});
}

function jsonKeys(name,path=""){
    return createReporter("jsonKeys",{name,path});
}

function jsonLength(name,path=""){
    return createReporter("jsonLength",{name,path});
}

function jsonType(name,path=""){
    return createReporter("jsonType",{name,path});
}