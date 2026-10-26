import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../books/reader.js',import.meta.url),'utf8');
const factory=source.slice(source.indexOf('function nativeNavigationView('),source.indexOf('async function start(){'));
test('native chapter navigation is allowed only by user activation, without enabling scripts inside EPUBs',()=>{
 const flags=new Set(['allow-same-origin']);let loaded=false;
 class View{create(){assert.equal(loaded,false);return {sandbox:{add:flag=>flags.add(flag)}}}}
 const NativeView=runInNewContext(factory+'\nnativeNavigationView(BaseView);',{BaseView:View});
 new NativeView().create();loaded=true;
 assert.equal(flags.has('allow-top-navigation-by-user-activation'),true);
 assert.equal(flags.has('allow-scripts'),false);assert.equal(flags.has('allow-top-navigation'),false);
});
