// <----- Sound Blocks ----->

const sound=name=>ENGINE.sounds[String(resolveValue(name))];
const soundNum=(v,d=0)=>Number.isFinite(v=Number(resolveValue(v)))?v:d;
const soundBlock=(type,data)=>ENGINE.recordBlock(createBlock(type,data));

function makeSound(name,path){
    return soundBlock("makeSound",{name,path});
}

registerBlock("makeSound",async block=>{
    const name=String(resolveValue(block.name)),path=String(resolveValue(block.path));
    if(!name)return;

    const s=ENGINE.sounds[name];
    if(!s)
        ENGINE.sounds[name]={name,path,pitch:0,speed:100,pan:0,volume:100,instances:[],buffer:null,bufferPath:""};
    else if(s.path!==path){
        s.path=path;
        s.buffer=null;
        s.bufferPath="";
    }
});

function playSound(name){
    return soundBlock("playSound",{name});
}

registerBlock("playSound",async block=>{
    const s=sound(block.name);
    if(s?.path)playSoundInternal(s);
});

function stopAllSound(){
    return soundBlock("stopAllSound");
}

registerBlock("stopAllSound",async()=>{
    Object.values(ENGINE.sounds).forEach(s=>{
        s.instances.forEach(stopSoundInstance);
        s.instances.length=0;
    });
    ENGINE.audioPending.length=0;
});

function stopSound(name){
    return soundBlock("stopSound",{name});
}

registerBlock("stopSound",async block=>{
    const s=sound(block.name);
    if(!s)return;

    s.instances.forEach(stopSoundInstance);
    s.instances.length=0;
    ENGINE.audioPending=ENGINE.audioPending.filter(x=>x.sound!==s);
});


/* SOUND PROPERTY HELPERS */

function setSoundProperty(block,property,min,max,apply){
    const s=sound(block.name);
    if(!s)return;

    s[property]=clamp(soundNum(block.value),min,max);
    s.instances.forEach(i=>apply(i,s[property]));
}

function changeSoundProperty(block,property,min,max,apply){
    const s=sound(block.name);
    if(!s)return;

    s[property]=clamp(s[property]+soundNum(block.value),min,max);
    s.instances.forEach(i=>apply(i,s[property]));
}


/* PITCH */

function setPitch(name,value){
    return soundBlock("setPitch",{name,value});
}

registerBlock("setPitch",async block=>
    setSoundProperty(
        block,"pitch",-100,100,
        (i,v)=>i.source&&(i.source.detune.value=v*12)
    )
);

function changePitch(name,value){
    return soundBlock("changePitch",{name,value});
}

registerBlock("changePitch",async block=>
    changeSoundProperty(
        block,"pitch",-100,100,
        (i,v)=>i.source&&(i.source.detune.value=v*12)
    )
);


/* PAN */

function setPan(name,value){
    return soundBlock("setPan",{name,value});
}

registerBlock("setPan",async block=>
    setSoundProperty(
        block,"pan",-100,100,
        (i,v)=>i.panner&&(i.panner.pan.value=v/100)
    )
);

function changePan(name,value){
    return soundBlock("changePan",{name,value});
}

registerBlock("changePan",async block=>
    changeSoundProperty(
        block,"pan",-100,100,
        (i,v)=>i.panner&&(i.panner.pan.value=v/100)
    )
);


/* VOLUME */

function setVolume(name,value){
    return soundBlock("setVolume",{name,value});
}

registerBlock("setVolume",async block=>
    setSoundProperty(
        block,"volume",0,100,
        (i,v)=>i.gain&&(i.gain.gain.value=v/100)
    )
);

function changeVolume(name,value){
    return soundBlock("changeVolume",{name,value});
}

registerBlock("changeVolume",async block=>
    changeSoundProperty(
        block,"volume",0,100,
        (i,v)=>i.gain&&(i.gain.gain.value=v/100)
    )
);


/* REPORTER */

function volumeOfSound(name){
    return createReporter("volumeOfSound",{name});
}

registerReporter("volumeOfSound",value=>sound(value.name)?.volume??0);
