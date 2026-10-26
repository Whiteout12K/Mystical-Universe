import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../books/reader.js',import.meta.url),'utf8');
const initialization=source.slice(source.indexOf('const volumeId='),source.indexOf('let book,rendition'));
const save=source.slice(source.indexOf('function saveReadingPosition(){'),source.indexOf('function relocated('));
function open(id,storage){
 const context={URLSearchParams,location:{search:'?id='+id},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},$:()=>({})};
 return runInNewContext(initialization+`\nlet readerReady=true,current=null,toc=[{label:'Chapter'}],index=0;\n`+save+`\n({settings,saved,setPosition(cfi){current={start:{cfi}};saveReadingPosition();},prepare(){readerReady=false;current={start:{cfi:'temporary-counting-page'}};saveReadingPosition();}});`,context);
}
test('each volume restores its own last passage across reader sessions',()=>{
 const storage=new Map();
 open('1',storage).setPosition('epubcfi(volume-one-page)');
 open('2',storage).setPosition('epubcfi(volume-two-page)');
 assert.equal(open('1',storage).saved.cfi,'epubcfi(volume-one-page)');
 assert.equal(open('2',storage).saved.cfi,'epubcfi(volume-two-page)');
 assert.equal(JSON.parse(storage.get('ml-reading-current')).id,'2');
});
test('pagination measurements never replace a saved reading position',()=>{
 const storage=new Map(),reader=open('1',storage);
 reader.setPosition('epubcfi(last-read)');reader.prepare();
 assert.equal(open('1',storage).saved.cfi,'epubcfi(last-read)');
});
test('font size and theme restore together for all volumes with safe defaults',()=>{
 const storage=new Map([['ml-epub-preferences-v1',JSON.stringify({size:28,theme:'night',font:'serif',leading:'2.1'})]]);
 for(const id of ['1','2']){
  const reader=open(id,storage);assert.equal(reader.settings.size,28);assert.equal(reader.settings.theme,'night');
 }
 storage.set('ml-epub-preferences-v1','broken JSON');
 assert.equal(open('1',storage).settings.size,22);
});
test('page saves happen immediately and before a new pagination scan',()=>{
 const relocated=source.slice(source.indexOf('function relocated('),source.indexOf('async function turn('));
 assert.match(relocated,/if\(adjusting\)return;saveReadingPosition\(\)/);
 assert.doesNotMatch(relocated,/setTimeout/);
 assert.match(source,/saveReadingPosition\(\);readerReady=false;loading=true;preparingUI\(true\)/);
});
