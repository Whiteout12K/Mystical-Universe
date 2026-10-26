import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../books/reader-surface.js',import.meta.url),'utf8').replace('export class ReaderSurface','class ReaderSurface')+'\nReaderSurface;';
function fixture(){
 let copies=0,styles=[];
 const node=()=>({style:{},dataset:{},attributes:[],querySelectorAll:()=>[],remove(){}});
 const source={documentElement:{style:{fontSize:'22px'},getAttribute:()=> 'font-size:22px'},body:{getAttribute:()=> 'column-width:800px'},styleSheets:[],defaultView:{innerWidth:4800,innerHeight:524}};
 const document={head:{append(){}},documentElement:{style:{}},fonts:{ready:Promise.resolve()},createElement:node,importNode(){copies++;const copy=node();copy.querySelector=()=>({append:style=>styles.push(style)});return copy;}};
 const host={attachShadow:()=>({addEventListener(){},replaceChildren(){}}),getBoundingClientRect:()=>({left:240,top:128})};
 const frame={getBoundingClientRect:()=>({left:-1360,top:128,width:4800,height:524})};
 const Surface=vm.runInNewContext(code,{document});
 const surface=new Surface(host,{navigate(){}});
 return {surface,source,frame,styles,get copies(){return copies;}};
}
test('all chapter columns remain visible through the outer page viewport',()=>{
 const f=fixture();f.surface.sync({document:f.source},f.frame,'settings');
 assert.match(f.styles[0].textContent,/body\{overflow:visible!important/);
 assert.equal(f.surface.copy.style.transform,'translate(-1600px,0px)');
});
test('page turns reuse text, while changed column layout rebuilds the surface',()=>{
 const f=fixture();f.surface.sync({document:f.source},f.frame,'settings');
 f.frame.getBoundingClientRect=()=>({left:-2160,top:128,width:4800,height:524});
 f.surface.sync({document:f.source},f.frame,'settings');assert.equal(f.copies,1);
 assert.equal(f.surface.copy.style.transform,'translate(-2400px,0px)');
 f.source.body.getAttribute=()=> 'column-width:390px';
 f.surface.sync({document:f.source},f.frame,'settings');assert.equal(f.copies,2);
 f.frame.getBoundingClientRect=()=>({left:0,top:128,width:3900,height:600});
 f.surface.sync({document:f.source},f.frame,'settings');assert.equal(f.copies,3);
});
