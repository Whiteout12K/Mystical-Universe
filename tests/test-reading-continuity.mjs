import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/js/site-enhancements/reading.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'').replace('export async function init','async function init');
function setup(path,initial){
 let entry=initial,selector,row;const events={};
 const node=()=>({children:[],append(child){this.children.push(child)},replaceChildren(){this.children=[]}});
 const host=node();host.before=child=>{row=child};
 const context={location:{pathname:path},window:{addEventListener:(name,fn)=>events[name]=fn},el:()=>{row=node();return row},link:(text,href)=>({text,href}),json:async()=>({books:[{id:'1',title:'Beginning',available:true,path:'/books/reader.html?id=1'},{id:'2',title:'Awakening',available:true,path:'/books/reader.html?id=2'}]}),saved:()=>entry,readyWhen:(target,fn)=>{selector=target;fn(host)}};
 return {async init(){await runInNewContext(source+'\ninit();',context)},get row(){return row},get selector(){return selector},get host(){return host},setEntry(value){entry=value},events};
}
test('homepage continuation accepts EPUB CFIs without obsolete PDF page numbers and lives inside hero',async()=>{
 const app=setup('/index.html',{id:'2',cfi:'epubcfi(...)'});await app.init();
 assert.equal(app.selector,'#reading-continue');assert.equal(app.host.children[0],app.row);
 assert.equal(app.row.children[0].text,'Continue Vol 2: Awakening');assert.equal(app.row.children[0].href,'/books/reader.html?id=2');
 app.setEntry({id:'1',cfi:'epubcfi(other)'});app.events.storage({key:'ml-reading-current'});
 assert.equal(app.row.children[0].text,'Continue Vol 1: Beginning');
 app.setEntry({id:'unknown'});app.events.pageshow();assert.equal(app.row.hidden,true);
});
test('books page refreshes latest viewed volume on browser back and supports older progress records',async()=>{
 const app=setup('/books/series.html',{id:'1',page:20});await app.init();assert.equal(app.selector,'main,.news-section');
 app.setEntry({id:'2',cfi:'epubcfi(...)'});app.events.pageshow();assert.equal(app.row.children[0].href,'/books/reader.html?id=2');
});
