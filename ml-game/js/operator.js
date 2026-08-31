// Variable Blocks

const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const numValue=(v,c)=>Number(resolveValue(v,c));

const normalizeValue=(v,c)=>{
    v=resolveValue(v,c);
    return typeof v==="string"&&v.trim()!==""&&!isNaN(Number(v))
        ?Number(v):v;
};

const recordVarBlock=(type,data)=>{
    const block=createBlock(type,data);
    ENGINE.recordBlock(block);
    return block;
};

const spriteBy=(name,c)=>getContextSprite(name,c);
const cloneBy=c=>c?.clone?.isClone?c.clone:null;

function makeVar(name){
    return recordVarBlock("makeVar",{name});
}

registerBlock("makeVar",async b=>{
    const n=String(resolveValue(b.name));
    if(n&&!hasOwn(ENGINE.variables,n))ENGINE.variables[n]=0;
});

function setVar(name,value){
    return recordVarBlock("setVar",{name,value});
}

registerBlock("setVar",async(b,c)=>{
    const n=String(resolveValue(b.name,c));
    if(n)ENGINE.variables[n]=normalizeValue(b.value,c);
});

function deleteVar(name){
    return recordVarBlock("deleteVar",{name});
}

registerBlock("deleteVar",async(b,c)=>{
    const n=String(resolveValue(b.name,c));
    if(n)delete ENGINE.variables[n];
});

function getVar(name){
    return{type:"variable",name:String(resolveValue(name))};
}

function changeVarBy(name,value){
    return recordVarBlock("changeVarBy",{name,value});
}

registerBlock("changeVarBy",async(b,c)=>{
    const n=String(resolveValue(b.name,c));
    if(n)ENGINE.variables[n]=(Number(ENGINE.variables[n])||0)+(numValue(b.value,c)||0);
});


/* Sprite Variable Blocks */

function makeSpriteVar(spriteName,varName){
    return recordVarBlock("makeSpriteVar",{spriteName,varName});
}

registerBlock("makeSpriteVar",async(b,c)=>{
    const s=spriteBy(b.spriteName,c),n=String(resolveValue(b.varName,c));
    if(s&&n&&!hasOwn(s.variables,n))s.variables[n]=0;
});

function getSpriteVar(spriteName,varName){
    return{
        type:"spriteVariable",
        spriteName:String(resolveValue(spriteName)),
        varName:String(resolveValue(varName))
    };
}

function setSpriteVar(spriteName,varName,value){
    return recordVarBlock("setSpriteVar",{spriteName,varName,value});
}

registerBlock("setSpriteVar",async(b,c)=>{
    const s=spriteBy(b.spriteName,c),n=String(resolveValue(b.varName,c));
    if(s&&n)s.variables[n]=normalizeValue(b.value,c);
});

function changeSpriteVarBy(spriteName,varName,value){
    return recordVarBlock("changeSpriteVarBy",{spriteName,varName,value});
}

registerBlock("changeSpriteVarBy",async(b,c)=>{
    const s=spriteBy(b.spriteName,c),n=String(resolveValue(b.varName,c));
    if(s&&n)s.variables[n]=(Number(s.variables[n])||0)+(numValue(b.value,c)||0);
});

registerReporter("spriteVariable",(b,c)=>{
    const s=spriteBy(b.spriteName,c),n=String(resolveValue(b.varName,c));
    return s&&n?s.variables[n]??"":"";
});


/* Clone Variable Blocks */

function makeCloneVar(varName){
    return recordVarBlock("makeCloneVar",{varName});
}

registerBlock("makeCloneVar",async(b,c)=>{
    const clone=cloneBy(c),n=String(resolveValue(b.varName,c));
    if(clone&&n&&!hasOwn(clone.variables,n))clone.variables[n]=0;
});

function getCloneVar(varName){
    return{type:"cloneVariable",varName};
}

function setCloneVar(varName,value){
    return recordVarBlock("setCloneVar",{varName,value});
}

registerBlock("setCloneVar",async(b,c)=>{
    const clone=cloneBy(c),n=String(resolveValue(b.varName,c));
    if(clone&&n)clone.variables[n]=normalizeValue(b.value,c);
});

function changeCloneVarBy(varName,value){
    return recordVarBlock("changeCloneVarBy",{varName,value});
}

registerBlock("changeCloneVarBy",async(b,c)=>{
    const clone=cloneBy(c),n=String(resolveValue(b.varName,c));
    if(clone&&n)
        clone.variables[n]=(Number(clone.variables[n])||0)+(numValue(b.value,c)||0);
});

function deleteCloneVar(varName){
    return recordVarBlock("deleteCloneVar",{varName});
}

registerBlock("deleteCloneVar",async(b,c)=>{
    const clone=cloneBy(c),n=String(resolveValue(b.varName,c));
    if(clone&&n)delete clone.variables[n];
});

registerReporter("cloneVariable",(b,c)=>{
    const clone=cloneBy(c),n=String(resolveValue(b.varName,c));
    return clone&&n?clone.variables[n]??"":"";
});


/* Operator Blocks */

function operator(type,evaluate){
    return{type:"operator",operator:type,evaluate};
}

const opNum=(a,c)=>Number(resolveValue(a,c));

const binaryNum=(type,fn)=>
    (a,b)=>operator(type,c=>fn(opNum(a,c),opNum(b,c)));

const add=binaryNum("add",(a,b)=>a+b);
const sub=binaryNum("sub",(a,b)=>a-b);
const mult=binaryNum("mult",(a,b)=>a*b);
const div=binaryNum("div",(a,b)=>a/b);
const mod=binaryNum("mod",(a,b)=>a%b);

function round(value){
    return operator("round",c=>Math.round(opNum(value,c)));
}

function abs(value){
    return operator("abs",c=>Math.abs(opNum(value,c)));
}

function cos(value){
    return operator("cos",c=>Math.cos(opNum(value,c)*Math.PI/180));
}

function sin(value){
    return operator("sin",c=>Math.sin(opNum(value,c)*Math.PI/180));
}

function randomNum(start_range,end_range){
    return operator("randomNum",c=>{
        const a=opNum(start_range,c),b=opNum(end_range,c);
        return Math.round((Math.random()*(b-a)+a)*10)/10;
    });
}

const compare=(type,fn)=>
    (a,b)=>operator(type,c=>fn(opNum(a,c),opNum(b,c)));

const gThan=compare("gThan",(a,b)=>a>b);
const lThan=compare("lThan",(a,b)=>a<b);
const gEqThan=compare("gEqThan",(a,b)=>a>=b);
const lEqThan=compare("lEqThan",(a,b)=>a<=b);

function equal(value,value2){
    return operator("equal",c=>resolveValue(value,c)===resolveValue(value2,c));
}

const boolBinary=(type,fn)=>
    (a,b)=>operator(type,c=>fn(Boolean(resolveValue(a,c)),Boolean(resolveValue(b,c))));

const and=boolBinary("and",(a,b)=>a&&b);
const or=boolBinary("or",(a,b)=>a||b);

function not(value){
    return operator("not",c=>!Boolean(resolveValue(value,c)));
}

function join(value,value2){
    return operator("join",c=>
        String(resolveValue(value,c))+String(resolveValue(value2,c))
    );
}

function letter(num,value){
    return operator("letter",c=>{
        const i=Math.floor(opNum(num,c))-1,t=String(resolveValue(value,c));
        return i>=0&&i<t.length?t[i]:"";
    });
}

function length(value){
    return operator("length",c=>String(resolveValue(value,c)).length);
}

function contain(val,value){
    return operator("contain",c=>
        String(resolveValue(value,c)).includes(String(resolveValue(val,c)))
    );
}