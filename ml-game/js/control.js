
function wait(time){
    return{
        type:"wait",
        time:Math.max(0,Number(resolveValue(time))||0)
    };
}

function waitUntil(condition){
    return{
        type:"waitUntil",
        condition
    };
}

function repeat(times,...blocks){
    return{
        type:"repeat",
        times:Math.max(0,Math.floor(Number(resolveValue(times))||0)),
        blocks
    };
}
