import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../books/reader-pdf.js',import.meta.url),'utf8').replaceAll('export ','').replace("await import('./reader-print-layout.js')",'({createPrintLayout:makePrintLayout})');
function load(extra={}){const context={setTimeout:resolve=>resolve(),...extra};runInNewContext(code+'\nglobalThis.local=isLocalReader;',context);return context;}
test('PDF tools only allow loopback hosts',()=>{
 const c=load();for(const host of ['localhost','127.0.0.1','::1','[::1]'])assert.equal(c.local(host),true);
 for(const host of ['mysticallegends.org','localhost.example.com','192.168.1.2'])assert.equal(c.local(host),false);
});
test('PDF text is visible vector text, sized and positioned from the viewer',()=>{
 const calls=[];let size;
 const c=load();c.addSelectableText({setFont:()=>{},setFontSize:n=>size=n,setTextColor:()=>{},getTextWidth:()=>30,text:(...args)=>calls.push(args)},[{text:'Magic’s',x:40,y:80,width:60,size:22,family:'Crimson Text',style:'normal',color:'rgb(51,45,40)'}],new Map());
 assert.equal(size,16.5);assert.equal(calls[0][0],'Magic’s');assert.equal(calls[0][1],30);assert.equal(calls[0][2],60);
 assert.equal(calls[0][3].renderingMode,'fill');assert.equal(calls[0][3].baseline,'alphabetic');assert.equal(calls[0][3].horizontalScale,1.5);
});
test('only current-page text is exported, with its measured font baseline',()=>{
 const nodes=[{textContent:'Magic’s origin',x:40},{textContent:'Next page',x:900},{textContent:'Hidden',x:40,hidden:true}];
 for(const node of nodes)node.parentElement={node,closest:()=>false};
 let selected,start,end,index=0;
 const range={selectNodeContents:node=>{selected=node;start=0;end=node.textContent.length;},setStart:(node,n)=>{selected=node;start=n;},setEnd:(node,n)=>{selected=node;end=n;},getClientRects:()=>[{left:selected.x+start*6,right:selected.x+end*6,top:20,bottom:42,width:(end-start)*6,height:22}]};
 const doc={createElement:()=>({getContext:()=>({measureText:()=>({fontBoundingBoxDescent:5})})}),createRange:()=>range,createTreeWalker:()=>({nextNode:()=>nodes[index++]})};
 const surface={host:{getBoundingClientRect:()=>({left:0,right:800,top:0,bottom:600})},copy:{ownerDocument:doc,querySelector:()=>({})}};
 const c=load({getComputedStyle:el=>({visibility:el.node.hidden?'hidden':'visible',display:'block',fontSize:'22px',fontWeight:'400',fontStyle:'normal',fontFamily:'Crimson Text',color:'rgb(0,0,0)',textDecorationLine:'none'})});
 const runs=c.visiblePageText(surface);assert.deepEqual(Array.from(runs,run=>run.text),['Magic’s','origin']);assert.equal(runs[0].x,40);assert.equal(runs[0].y,37);
});
function builder(sizes){
 let outputs=0;const drawn=[],quality=[];
 const c=load({window:{jspdf:{jsPDF:class{
  setProperties(){}addPage(){}setFillColor(){}rect(){}saveGraphicsState(){}clip(){}discardPath(){}restoreGraphicsState(){}addImage(...a){drawn.push(a);}output(type){assert.equal(type,'blob');return {size:sizes[Math.min(outputs++,sizes.length-1)]};}
 }}}});
 c.optimizedImages=(_,pixels,q)=>{quality.push([pixels,q]);return new Map([['cover',{data:'jpeg',alias:'cover-once'}]]);};
 c.addSelectableText=()=>{};
 const args={pages:[{background:'rgb(250,247,240)',text:[],images:[{url:'cover',x:10,y:20,width:100,height:200}]},{background:'rgb(250,247,240)',text:[],images:[]}],fonts:new Map(),images:new Map(),width:800,height:600,title:'Book',checkLayout:()=>{},progress:()=>{}};
 return {c,args,drawn,quality,get outputs(){return outputs;}};
}
test('the exact serialized blob is checked against the decimal 5 MB limit',async()=>{
 const f=builder([5_000_001,5_000_000]);const result=await f.c.buildCompactPDF(f.args);
 assert.equal(result.bytes,5_000_000);assert.equal(result.blob.size,5_000_000);assert.equal(f.outputs,2);assert.equal(f.quality.length,2);
 assert.equal(f.drawn[0][1],'JPEG');assert.equal(f.drawn[0][6],'cover-once');
});
test('oversized PDFs are rejected instead of silently downloading',async()=>{
 const f=builder([5_000_001]);await assert.rejects(f.c.buildCompactPDF(f.args),/5 MB/);assert.equal(f.outputs,4);
});
test('a separate print rendition collects all pages and is cleaned up after downloading the checked blob',async()=>{
 let section=0,page=1,downloaded=0,cleaned=0;const seen=[],blob={size:123};
 const c=load({document:{head:{append:s=>s.onload()},body:{append:()=>{}},createElement:()=>({click:()=>downloaded++,remove:()=>{}})},URL:{createObjectURL:b=>{assert.equal(b,blob);return 'blob:checked';},revokeObjectURL:()=>{}},getComputedStyle:()=>({backgroundColor:'rgb(250,247,240)'})});
 c.collectFonts=async()=>{};c.pageImages=()=>[];c.visiblePageText=()=>{seen.push([section,page]);return [{text:"page"}];};
 c.buildCompactPDF=async({pages})=>{assert.equal(pages.length,5);return {blob,bytes:123};};
 const args={hostname:'localhost',title:'Book',sections:[{href:'cover',index:0},{href:'chapter',index:1}],totalPages:5,surface:{host:{getBoundingClientRect:()=>({width:800,height:600})},ready:async()=>{}},rendition:{display:async href=>{section=href==='cover'?0:1;page=1;},currentLocation:async()=>({start:{index:section,displayed:{page,total:section===0?2:3}}}),next:async()=>page++},wait:async()=>{},sync:()=>{},checkLayout:()=>{},progress:()=>{}};
 args.book={spine:{spineItems:args.sections}};
 c.makePrintLayout=async()=>({rendition:args.rendition,surface:args.surface,width:397,height:559,wait:args.wait,sync:args.sync,cleanup:()=>cleaned++});
 assert.equal((await c.exportReaderPDF(args)).bytes,123);assert.equal(cleaned,1);assert.deepEqual(seen,[[0,1],[0,2],[1,1],[1,2],[1,3]]);assert.equal(downloaded,1);
 await assert.rejects(c.exportReaderPDF({...args,hostname:'mysticallegends.org'}),/localhost/);
 let checks=0;await assert.rejects(c.exportReaderPDF({...args,checkLayout:()=>{if(++checks>1)throw Error('cancelled');}}),/cancelled/);assert.equal(cleaned,2);
});
