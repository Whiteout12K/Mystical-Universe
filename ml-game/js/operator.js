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


function deleteVar(name){
    const block=createBlock("deleteVar",{
        name
    });

    ENGINE.recordBlock(block);

    return block;
}

registerBlock("deleteVar",async block=>{
    const name=String(resolveValue(block.name));

    if(name)
        delete ENGINE.variables[name];
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


// Sprite Variable Blocks

function makeSpriteVar(spriteName,varName){
    const block=createBlock("makeSpriteVar",{
        spriteName,
        varName
    });

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("makeSpriteVar",async block=>{
    const spriteName=String(
        resolveValue(block.spriteName)
    );

    const varName=String(
        resolveValue(block.varName)
    );

    const sprite=ENGINE.sprites[spriteName];

    if(
        !sprite||
        !varName
    )
        return;

    if(
        !Object.prototype.hasOwnProperty.call(
            sprite.variables,
            varName
        )
    )
        sprite.variables[varName]=0;
});


function getSpriteVar(spriteName,varName){
    return{
        type:"spriteVariable",
        spriteName:String(
            resolveValue(spriteName)
        ),
        varName:String(
            resolveValue(varName)
        )
    };
}


function setSpriteVar(spriteName,varName,value){
    const block=createBlock("setSpriteVar",{
        spriteName,
        varName,
        value
    });

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("setSpriteVar",async block=>{
    const spriteName=String(
        resolveValue(block.spriteName)
    );

    const varName=String(
        resolveValue(block.varName)
    );

    let value=resolveValue(block.value);

    if(
        typeof value==="string"&&
        value.trim()!==""&&
        !isNaN(Number(value))
    )
        value=Number(value);

    const sprite=ENGINE.sprites[spriteName];

    if(
        !sprite||
        !varName
    )
        return;

    sprite.variables[varName]=value;
});


function changeSpriteVarBy(spriteName,varName,value){
    const block=createBlock("changeSpriteVarBy",{
        spriteName,
        varName,
        value
    });

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("changeSpriteVarBy",async block=>{
    const spriteName=String(
        resolveValue(block.spriteName)
    );

    const varName=String(
        resolveValue(block.varName)
    );

    const value=
        Number(
            resolveValue(block.value)
        )||0;

    const sprite=ENGINE.sprites[spriteName];

    if(
        !sprite||
        !varName
    )
        return;

    const current=
        Number(
            sprite.variables[varName]
        )||0;

    sprite.variables[varName]=
        current+value;
});


registerReporter(
    "spriteVariable",
    (value,context)=>{
        const spriteName=String(
            resolveValue(
                value.spriteName,
                context
            )
        );

        const varName=String(
            resolveValue(
                value.varName,
                context
            )
        );

        const sprite=ENGINE.sprites[spriteName];

        if(
            !sprite||
            !varName
        )
            return"";

        return sprite.variables[varName]??"";
    }
);


// Clone Variable Blocks

function makeCloneVar(varName){
    const block=createBlock("makeCloneVar",{
        varName
    });

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("makeCloneVar",async(block,context)=>{
    const varName=String(
        resolveValue(
            block.varName,
            context
        )
    );

    const clone=context?.clone;

    if(
        !clone||
        !clone.isClone||
        !varName
    )
        return;

    if(
        !Object.prototype.hasOwnProperty.call(
            clone.variables,
            varName
        )
    )
        clone.variables[varName]=0;
});


function getCloneVar(varName){
    return{
        type:"cloneVariable",
        varName
    };
}


function setCloneVar(varName,value){
    const block=createBlock("setCloneVar",{
        varName,
        value
    });

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("setCloneVar",async(block,context)=>{
    const varName=String(
        resolveValue(
            block.varName,
            context
        )
    );

    let value=resolveValue(
        block.value,
        context
    );

    if(
        typeof value==="string"&&
        value.trim()!==""&&
        !isNaN(Number(value))
    )
        value=Number(value);

    const clone=context?.clone;

    if(
        !clone||
        !clone.isClone||
        !varName
    )
        return;

    clone.variables[varName]=value;
});


function changeCloneVarBy(varName,value){
    const block=createBlock("changeCloneVarBy",{
        varName,
        value
    });

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("changeCloneVarBy",async(block,context)=>{
    const varName=String(
        resolveValue(
            block.varName,
            context
        )
    );

    const value=
        Number(
            resolveValue(
                block.value,
                context
            )
        )||0;

    const clone=context?.clone;

    if(
        !clone||
        !clone.isClone||
        !varName
    )
        return;

    const current=
        Number(
            clone.variables[varName]
        )||0;

    clone.variables[varName]=
        current+value;
});


function deleteCloneVar(varName){
    const block=createBlock("deleteCloneVar",{
        varName
    });

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("deleteCloneVar",async(block,context)=>{
    const varName=String(
        resolveValue(
            block.varName,
            context
        )
    );

    const clone=context?.clone;

    if(
        !clone||
        !clone.isClone||
        !varName
    )
        return;

    delete clone.variables[varName];
});


registerReporter(
    "cloneVariable",
    (value,context)=>{
        const varName=String(
            resolveValue(
                value.varName,
                context
            )
        );

        const clone=context?.clone;

        if(
            !clone||
            !clone.isClone||
            !varName
        )
            return"";

        return clone.variables[varName]??"";
    }
);


function getCloneName(){
    return{
        type:"cloneName"
    };
}


function getCloneId(){
    return{
        type:"cloneId"
    };
}


registerReporter(
    "cloneName",
    (value,context)=>
        context?.clone?.cloneName??""
);


registerReporter(
    "cloneId",
    (value,context)=>
        context?.clone?.cloneId??""
);



// Operator Blocks

function operator(type,evaluate){
    return{
        type:"operator",
        operator:type,
        evaluate
    };
}

function add(value,value2){
    return operator("add",context=>{
        return Number(resolveValue(value,context))+
            Number(resolveValue(value2,context));
    });
}

function sub(value,value2){
    return operator("sub",context=>{
        return Number(resolveValue(value,context))-
            Number(resolveValue(value2,context));
    });
}

function mult(value,value2){
    return operator("mult",context=>{
        return Number(resolveValue(value,context))*
            Number(resolveValue(value2,context));
    });
}

function div(value,value2){
    return operator("div",context=>{
        return Number(resolveValue(value,context))/
            Number(resolveValue(value2,context));
    });
}

function mod(value,value2){
    return operator("mod",context=>{
        return Number(resolveValue(value,context))%
            Number(resolveValue(value2,context));
    });
}

function round(value){
    return operator("round",context=>{
        return Math.round(
            Number(resolveValue(value,context))
        );
    });
}

function abs(value){
    return operator("abs",context=>{
        return Math.abs(
            Number(resolveValue(value,context))
        );
    });
}

function cos(value){
    return operator("cos",context=>{
        return Math.cos(
            Number(resolveValue(value,context))*
            Math.PI/180
        );
    });
}

function sin(value){
    return operator("sin",context=>{
        return Math.sin(
            Number(resolveValue(value,context))*
            Math.PI/180
        );
    });
}

function randomNum(start_range,end_range){
    return operator("randomNum",context=>{
        const start=
            Number(resolveValue(start_range,context));

        const end=
            Number(resolveValue(end_range,context));

        return Math.round(
            (Math.random()*(end-start)+start)*10
        )/10;
    });
}

function gThan(value,value1){
    return operator("gThan",context=>{
        return Number(resolveValue(value,context))>
            Number(resolveValue(value1,context));
    });
}

function lThan(value,value1){
    return operator("lThan",context=>{
        return Number(resolveValue(value,context))<
            Number(resolveValue(value1,context));
    });
}

function gEqThan(value,value1){
    return operator("gEqThan",context=>{
        return Number(resolveValue(value,context))>=
            Number(resolveValue(value1,context));
    });
}

function lEqThan(value,value1){
    return operator("lEqThan",context=>{
        return Number(resolveValue(value,context))<=
            Number(resolveValue(value1,context));
    });
}

function equal(value,value2){
    return operator("equal",context=>{
        return resolveValue(value,context)===
            resolveValue(value2,context);
    });
}

function and(value,value2){
    return operator("and",context=>{
        return Boolean(resolveValue(value,context))&&
            Boolean(resolveValue(value2,context));
    });
}

function or(value,value2){
    return operator("or",context=>{
        return Boolean(resolveValue(value,context))||
            Boolean(resolveValue(value2,context));
    });
}

function not(value){
    return operator("not",context=>{
        return !Boolean(resolveValue(value,context));
    });
}

function join(value,value2){
    return operator("join",context=>{
        return String(resolveValue(value,context))+
            String(resolveValue(value2,context));
    });
}

function letter(num,value){
    return operator("letter",context=>{
        const index=
            Math.floor(
                Number(resolveValue(num,context))
            )-1;

        const text=
            String(resolveValue(value,context));

        return index>=0&&index<text.length
            ?text[index]
            :"";
    });
}

function length(value){
    return operator("length",context=>{
        return String(
            resolveValue(value,context)
        ).length;
    });
}

function contain(val,value){
    return operator("contain",context=>{
        return String(
            resolveValue(value,context)
        ).includes(
            String(resolveValue(val,context))
        );
    });
}