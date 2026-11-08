import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const loader=fs.readFileSync(new URL('../JScratch/js/program-loader.js',import.meta.url),'utf8');
async function load(files,sourceOverrides={}){
    const listeners=new Map(),startup=[],events=[];
    const sources={'begin.js':'whenStart(()=>broadcast("Ready"));','scenes/world.js':'whenBroadcast("Ready",()=>events.push("world"));',...sourceOverrides};
    const context=vm.createContext({ENGINE:{},URL,location:{href:'http://localhost/JScratch/canvas.html'},events,
        whenStart:fn=>startup.push(fn),whenBroadcast:(name,fn)=>listeners.set(name,fn),broadcast:name=>listeners.get(name)?.(),
        window:{addEventListener(){},removeEventListener(){}},
        fetch:async path=>({ok:path==='program/project.json'||sources[path.slice(8)]!==undefined,json:async()=>({files}),text:async()=>sources[path.slice(8)]}),
        document:{createElement:()=>({remove(){}}),head:{append(script){vm.runInContext(script.textContent,context);}}}
    });
    vm.runInContext(loader,context);await context.ENGINE.programReady;startup.forEach(fn=>fn());return events;
}
test('all program hats register before startup regardless of manifest order or folders',async()=>{
    assert.deepEqual(await load(['begin.js','scenes/world.js']),['world']);assert.deepEqual(await load(['scenes/world.js','begin.js']),['world']);
});
test('missing, unsafe and reference program entries stop loading instead of starting a partial project',async()=>{
    await assert.rejects(load(['missing.js']),/Cannot load/);await assert.rejects(load(['../escape.js']),/Invalid/);await assert.rejects(load(['sample.js']),/Invalid/);await assert.rejects(load(['broken.js'],{'broken.js':'throw new Error("broken");'}),/broken/);
});
