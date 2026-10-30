import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../books/reader-print-layout.js',import.meta.url),'utf8').replace(/^import .*\n/,'').replaceAll('export ','');
function load(){const c={};runInNewContext(code+'\nglobalThis.page=PRINT_PAGE;',c);return c;}
test('print trim is exactly A6 in portrait with 11-point text, independent of any viewport',()=>{
 const {page}=load();assert.ok(Math.abs(page.width*.75-105*72/25.4)<1e-9);assert.ok(Math.abs(page.height*.75-148*72/25.4)<1e-9);
 assert.ok(page.height>page.width);assert.equal(page.fontSize*.75,11);assert.ok(page.margin>0);
});
function illustration({portrait=true,text='',heading=false}={}){
 const classes=new Set(),style={};const title=heading?{matches:()=>true}:null;
 const block={textContent:text,previousElementSibling:title,querySelectorAll:()=>[{}],classList:{add:name=>classes.add(name),contains:name=>classes.has(name)},style:{setProperty:(key,value)=>style[key]=value},prepend:node=>{block.moved=node;}};
 const image={naturalWidth:1000,naturalHeight:portrait?1500:600,closest:()=>block};return {image,block,classes,style,title};
}
test('vertical artwork gets a whole page and its preceding heading stays with it',()=>{
 const c=load(),vertical=illustration({heading:true}),landscape=illustration({portrait:false}),captioned=illustration({text:'Caption'});
 c.prepareIllustrations({images:[vertical.image,landscape.image,captioned.image]});
 assert.equal(vertical.classes.has('print-illustration'),true);assert.equal(vertical.classes.has('print-with-heading'),true);assert.equal(vertical.block.moved,vertical.title);
 assert.ok(parseFloat(vertical.style['--print-image-height'])<c.page.height-2*c.page.margin);
 assert.equal(landscape.classes.size,0);assert.equal(captioned.classes.size,0);
});
