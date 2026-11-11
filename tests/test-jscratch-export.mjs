import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectPaths,migrateEditorStorage} from '../JScratch/editor/paths.mjs';
import {projectDirectories} from '../JScratch/editor/project.mjs';
const root=new URL('../JScratch/',import.meta.url);
test('game entry uses only runtime scripts that exist without the editor folder',()=>{
    const html=fs.readFileSync(new URL('canvas.html',root),'utf8'),scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);assert.ok(scripts.includes('js/program-loader.js'));for(const path of scripts){assert.ok(path.startsWith('js/'));assert.ok(fs.existsSync(new URL(path,root)));}
    for(const name of fs.readdirSync(new URL('js/',root)).filter(n=>/\.(js|mjs)$/.test(n))){const source=fs.readFileSync(new URL('js/'+name,root),'utf8');assert.doesNotMatch(source,/(?:import|fetch)\s*\([^)]*["'][^"']*editor\//);}
    for(const path of ['editor.html','inspector.html','js/live-inspector.mjs','js/inspector-model.mjs','program/editor-data.json','program/editor-layouts.json'])assert.equal(fs.existsSync(new URL(path,root)),false,path);
    for(const path of ['editor/index.html','editor/inspector.html','editor/player.html','editor/live-inspector.mjs','editor/inspector-model.mjs','editor/editor-data.json','editor/editor-layouts.json'])assert.ok(fs.existsSync(new URL(path,root)),path);
});
test('editor resolves project URLs independently of directory redirects and nesting',()=>{
    const p=projectPaths('https://example.test/games/JScratch/editor/app.mjs');assert.equal(p.url('program/begin.js').href,'https://example.test/games/JScratch/program/begin.js');assert.equal(p.url('editor/player.html').href,'https://example.test/games/JScratch/editor/player.html');assert.equal(p.storagePath,'/games/JScratch/editor');
});
test('moving editor pages preserves old browser layouts and existing canonical values',()=>{
    const items=new Map([['jscratch-layout-v1:/JScratch/editor.html:begin.js','old layout'],['jscratch-editor-files:/JScratch/editor.html:active','world.js'],['jscratch-symbols:/JScratch/editor/','names'],['jscratch-run-entry:/JScratch/editor','World']]);const storage={get length(){return items.size;},key:i=>[...items.keys()][i],getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v)};migrateEditorStorage(storage,'/JScratch/editor','/JScratch/editor/');assert.equal(items.get('jscratch-layout-v1:/JScratch/editor:begin.js'),'old layout');assert.equal(items.get('jscratch-editor-files:/JScratch/editor:active'),'world.js');assert.equal(items.get('jscratch-symbols:/JScratch/editor'),'names');assert.equal(items.get('jscratch-run-entry:/JScratch/editor'),'World');
});
test('project grants separate program scripts from editor metadata and retain legacy grants',async()=>{
    const program={name:'program'},editor={name:'editor'},root={name:'JScratch',getDirectoryHandle:async name=>({program,editor})[name]};assert.deepEqual(await projectDirectories(root),{program,editor,root});assert.deepEqual(await projectDirectories(program),{program,editor:null,root:null});await assert.rejects(projectDirectories({name:'wrong',getDirectoryHandle:async()=>{throw new Error('missing');}}),/JScratch folder/);
});
