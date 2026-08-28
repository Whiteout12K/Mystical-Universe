// <----- Sound Blocks ----->

function makeSound(name,path){
    const block=createBlock(
        "makeSound",
        {
            name,
            path
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("makeSound",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const path=String(
        resolveValue(block.path)
    );

    if(!name)
        return;

    if(!ENGINE.sounds[name]){
        ENGINE.sounds[name]={
            name,
            path,
            pitch:0,
            speed:100,
            pan:0,
            volume:100,
            instances:[],
            buffer:null,
            bufferPath:""
        };
    }else{
        const sound=
            ENGINE.sounds[name];

        if(sound.path!==path){
            sound.path=path;
            sound.buffer=null;
            sound.bufferPath="";
        }
    }
});


function playSound(name){
    const block=createBlock(
        "playSound",
        {
            name
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("playSound",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(
        !sound||
        !sound.path
    )
        return;

    playSoundInternal(sound);
});


function stopAllSound(){
    const block=createBlock(
        "stopAllSound"
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("stopAllSound",async()=>{
    Object.values(
        ENGINE.sounds
    ).forEach(sound=>{
        sound.instances.forEach(
            stopSoundInstance
        );

        sound.instances.length=0;
    });

    ENGINE.audioPending.length=0;
});


function stopSound(name){
    const block=createBlock(
        "stopSound",
        {
            name
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("stopSound",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(!sound)
        return;

    sound.instances.forEach(
        stopSoundInstance
    );

    sound.instances.length=0;

    ENGINE.audioPending=
        ENGINE.audioPending.filter(
            item=>item.sound!==sound
        );
});


function setPitch(name,value){
    const block=createBlock(
        "setPitch",
        {
            name,
            value
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("setPitch",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(!sound)
        return;

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    sound.pitch=
        clamp(
            value,
            -100,
            100
        );

    sound.instances.forEach(
        instance=>{
            if(instance.source){
                instance.source.detune.value=
                    sound.pitch*12;
            }
        }
    );
});


function changePitch(name,value){
    const block=createBlock(
        "changePitch",
        {
            name,
            value
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("changePitch",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(!sound)
        return;

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    sound.pitch=
        clamp(
            sound.pitch+value,
            -100,
            100
        );

    sound.instances.forEach(
        instance=>{
            if(instance.source){
                instance.source.detune.value=
                    sound.pitch*12;
            }
        }
    );
});


function setPan(name,value){
    const block=createBlock(
        "setPan",
        {
            name,
            value
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("setPan",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(!sound)
        return;

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    sound.pan=
        clamp(
            value,
            -100,
            100
        );

    sound.instances.forEach(
        instance=>{
            if(instance.panner){
                instance.panner.pan.value=
                    sound.pan/100;
            }
        }
    );
});


function changePan(name,value){
    const block=createBlock(
        "changePan",
        {
            name,
            value
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("changePan",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(!sound)
        return;

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    sound.pan=
        clamp(
            sound.pan+value,
            -100,
            100
        );

    sound.instances.forEach(
        instance=>{
            if(instance.panner){
                instance.panner.pan.value=
                    sound.pan/100;
            }
        }
    );
});


function setVolume(name,value){
    const block=createBlock(
        "setVolume",
        {
            name,
            value
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("setVolume",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(!sound)
        return;

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    sound.volume=
        clamp(
            value,
            0,
            100
        );

    sound.instances.forEach(
        instance=>{
            if(instance.gain){
                instance.gain.gain.value=
                    sound.volume/100;
            }
        }
    );
});


function changeVolume(name,value){
    const block=createBlock(
        "changeVolume",
        {
            name,
            value
        }
    );

    ENGINE.recordBlock(block);

    return block;
}


registerBlock("changeVolume",async block=>{
    const name=String(
        resolveValue(block.name)
    );

    const sound=
        ENGINE.sounds[name];

    if(!sound)
        return;

    let value=Number(
        resolveValue(block.value)
    );

    if(!Number.isFinite(value))
        value=0;

    sound.volume=
        clamp(
            sound.volume+value,
            0,
            100
        );

    sound.instances.forEach(
        instance=>{
            if(instance.gain){
                instance.gain.gain.value=
                    sound.volume/100;
            }
        }
    );
});


function volumeOfSound(name){
    return createReporter(
        "volumeOfSound",
        {
            name
        }
    );
}


registerReporter(
    "volumeOfSound",
    value=>{
        const name=String(
            resolveValue(value.name)
        );

        const sound=
            ENGINE.sounds[name];

        return sound?
            sound.volume:
            0;
    }
);

