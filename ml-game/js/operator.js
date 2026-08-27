// Variable Blocks

function makeVar(name){
    const block=createBlock("makeVar",{
        name
    });

    ENGINE.recordBlock(block);

    return block;
}

registerBlock("makeVar",async block=>{
    const name=String(resolveValue(block.name));

    if(
        name&&
        !Object.prototype.hasOwnProperty.call(
            ENGINE.variables,
            name
        )
    )
        ENGINE.variables[name]=0;
});


function setVar(name,value){
    const block=createBlock("setVar",{
        name,
        value
    });

    ENGINE.recordBlock(block);

    return block;
}

registerBlock("setVar",async block=>{
    const name=String(resolveValue(block.name));
    let value=resolveValue(block.value);

    if(
        typeof value==="string"&&
        value.trim()!==""&&
        !isNaN(Number(value))
    )
        value=Number(value);

    if(name)
        ENGINE.variables[name]=value;
});


function getVar(name){
    return{
        type:"variable",
        name:String(resolveValue(name))
    };
}


function changeVarBy(name,value){
    const block=createBlock("changeVarBy",{
        name,
        value
    });

    ENGINE.recordBlock(block);

    return block;
}

registerBlock("changeVarBy",async block=>{
    const name=String(resolveValue(block.name));
    const value=
        Number(resolveValue(block.value))||0;

    const current=
        Number(ENGINE.variables[name])||0;

    if(name)
        ENGINE.variables[name]=current+value;
});


// Operator Blocks

function operator(type,evaluate){
    return{
        type:"operator",
        operator:type,
        evaluate
    };
}

function add(value,value2){
    return operator("add",()=>{
        return Number(resolveValue(value))+
            Number(resolveValue(value2));
    });
}

function sub(value,value2){
    return operator("sub",()=>{
        return Number(resolveValue(value))-
            Number(resolveValue(value2));
    });
}

function mult(value,value2){
    return operator("mult",()=>{
        return Number(resolveValue(value))*
            Number(resolveValue(value2));
    });
}

function div(value,value2){
    return operator("div",()=>{
        return Number(resolveValue(value))/
            Number(resolveValue(value2));
    });
}

function mod(value,value2){
    return operator("mod",()=>{
        return Number(resolveValue(value))%
            Number(resolveValue(value2));
    });
}

function round(value){
    return operator("round",()=>{
        return Math.round(
            Number(resolveValue(value))
        );
    });
}

function abs(value){
    return operator("abs",()=>{
        return Math.abs(
            Number(resolveValue(value))
        );
    });
}

function randomNum(start_range,end_range){
    return operator("randomNum",()=>{
        const start=
            Number(resolveValue(start_range));

        const end=
            Number(resolveValue(end_range));

        return Math.random()*(end-start)+start;
    });
}

function gThan(value,value1){
    return operator("gThan",()=>{
        return Number(resolveValue(value))>
            Number(resolveValue(value1));
    });
}

function lThan(value,value1){
    return operator("lThan",()=>{
        return Number(resolveValue(value))<
            Number(resolveValue(value1));
    });
}

function gEqThan(value,value1){
    return operator("gEqThan",()=>{
        return Number(resolveValue(value))>=
            Number(resolveValue(value1));
    });
}

function lEqThan(value,value1){
    return operator("lEqThan",()=>{
        return Number(resolveValue(value))<=
            Number(resolveValue(value1));
    });
}

function equal(value,value2){
    return operator("equal",()=>{
        return resolveValue(value)===
            resolveValue(value2);
    });
}

function and(value,value2){
    return operator("and",()=>{
        return Boolean(resolveValue(value))&&
            Boolean(resolveValue(value2));
    });
}

function or(value,value2){
    return operator("or",()=>{
        return Boolean(resolveValue(value))||
            Boolean(resolveValue(value2));
    });
}

function not(value){
    return operator("not",()=>{
        return !Boolean(resolveValue(value));
    });
}

function join(value,value2){
    return operator("join",()=>{
        return String(resolveValue(value))+
            String(resolveValue(value2));
    });
}

function letter(num,value){
    return operator("letter",()=>{
        const index=
            Math.floor(
                Number(resolveValue(num))
            )-1;

        const text=
            String(resolveValue(value));

        return index>=0&&index<text.length
            ?text[index]
            :"";
    });
}

function length(value){
    return operator("length",()=>{
        return String(
            resolveValue(value)
        ).length;
    });
}

function contain(val,value){
    return operator("contain",()=>{
        return String(
            resolveValue(value)
        ).includes(
            String(resolveValue(val))
        );
    });
}