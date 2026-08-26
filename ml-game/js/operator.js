// operator.js

function add(value,value2){
    return Number(resolveValue(value))+Number(resolveValue(value2));
}

function sub(value,value2){
    return Number(resolveValue(value))-Number(resolveValue(value2));
}

function mult(value,value2){
    return Number(resolveValue(value))*Number(resolveValue(value2));
}

function div(value,value2){
    return Number(resolveValue(value))/Number(resolveValue(value2));
}

function mod(value,value2){
    return Number(resolveValue(value))%Number(resolveValue(value2));
}

function round(value){
    return Math.round(Number(resolveValue(value)));
}

function randomNum(start_range, end_range){
    const start=Number(resolveValue(start_range));
    const end=Number(resolveValue(end_range));
    return Math.random()*(end-start)+start;
}

function greaterThan(value,value1){
    return Number(resolveValue(value)) > Number(resolveValue(value1));
}

function lessThan(value,value1){
    return Number(resolveValue(value)) < Number(resolveValue(value1));
}

function equal(value,value2){
    return resolveValue(value) === resolveValue(value2);
}

function and(value,value2){
    return Boolean(resolveValue(value)) && Boolean(resolveValue(value2));
}

function or(value,value2){
    return Boolean(resolveValue(value)) || Boolean(resolveValue(value2));
}

function not(value){
    return ! Boolean(resolveValue(value));
}

function join(value,value2){
    return{type:"join",values:[value,value2]};
}

function letter(num,value){
    const index=Math.floor(Number(resolveValue(num)))-1;
    const text=String(resolveValue(value));
    return index>=0&&index<text.length?text[index]:"";
}

function length(value){
    return String(resolveValue(value)).length;
}

function contain(val,value){
    return String(resolveValue(value)).includes(String(resolveValue(val)));
}