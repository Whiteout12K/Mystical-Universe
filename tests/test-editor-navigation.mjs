import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {isLocalEditorHost,editorLinks} from '../assets/js/site-enhancements/editor-navigation.js';
test('editor shortcuts appear only on local hosts',()=>{
 for(const host of ['localhost','wiki.localhost','127.0.0.1','127.0.1.2','[::1]','::1'])assert.equal(isLocalEditorHost(host),true,host);
 for(const host of ['mystical-universe.org','localhost.example.org','example.org',''])assert.equal(isLocalEditorHost(host),false,host);
});
test('all authoring shortcuts point to existing local pages without duplicates',()=>{
 assert.equal(new Set(editorLinks.map(item=>item.href)).size,editorLinks.length);
 for(const item of editorLinks)assert(existsSync(new URL('../'+item.href.slice(1),import.meta.url)),item.href);
 for(const label of ['Wiki Editor','Relations Edit','Skill Editor','JScratch Editor'])assert(editorLinks.some(item=>item.label===label));
});
