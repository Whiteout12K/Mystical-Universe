import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const reader=readFileSync(new URL('../books/reader.js',import.meta.url),'utf8');
const prepare=reader.slice(reader.indexOf('async function prepareBook(target){'),reader.indexOf("$('pagination-retry').addEventListener"));
async function run(counts){
 const nodes=new Map(),calls=[],locks=[];let section=0;
 const state={preparing:null,readerReady:true,loading:false,pageCounts:[...counts],current:null,
  $:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},
  book:{spine:{spineItems:[{href:'a.xhtml'},{href:'b.xhtml'},{href:'c.xhtml'}]}},toc:[{href:'a.xhtml'}],
  saveReadingPosition:()=>{},surface:{ready:async()=>{}},syncSurface:()=>{},preparingUI:active=>locks.push(active),layoutKey:()=> 'fixed layout',
  rememberChapterPages:(index,total)=>{if(index>=0)state.pageCounts[index]=total},
  rendition:{display:async href=>{calls.push(href);section=['a.xhtml','b.xhtml','c.xhtml'].indexOf(href)},currentLocation:async()=>({start:{index:section,displayed:{page:1,total:[3,4,5][section]}}})},
  waitForPage:async()=>{},status:()=>{},relocated:()=>{}};
 await runInNewContext(prepare+"\nprepareBook('b.xhtml');",state);
 return {state,nodes,calls,locks};
}
test('uncached volumes finish all page measurements before unlocking and restore the requested chapter',async()=>{
 const {state,calls,locks,nodes}=await run([null,null,null]);
 assert.deepEqual(calls,['a.xhtml','b.xhtml','c.xhtml','b.xhtml']);assert.deepEqual(locks,[true,false]);
 assert.deepEqual(state.pageCounts,[3,4,5]);assert.equal(state.current.start.index,1);assert.equal(state.readerReady,true);assert.equal(state.loading,false);assert.equal(nodes.get('pagination-progress').value,3);
});
test('complete cached totals skip the book scan; incomplete caches only measure missing chapters',async()=>{
 assert.deepEqual((await run([3,4,5])).calls,['b.xhtml']);
 assert.deepEqual((await run([3,null,5])).calls,['b.xhtml','b.xhtml']);
});
