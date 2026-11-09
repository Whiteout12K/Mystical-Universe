import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../webpages/apps/skill.html',import.meta.url),'utf8');
const grouping=html.slice(html.indexOf('  function renderDupeAdditional('),html.indexOf('  function renderDupeLine('));
function render(items,selected=16){return runInNewContext(grouping+'\nrenderDupeAdditional(items,selected,{});',{items,selected,MAX_DUPE_LEVEL:16,renderContent:item=>item.text||item,renderDupeLine:item=>item.text||item});}
test('dupe groups render all sixteen star images and preserve continuation descriptions',()=>{
 const items=Array.from({length:16},(_,i)=>[{level:i+1,text:'Star '+(i+1)+' ability'},{text:'More details '+(i+1)}]).flat();const output=render(items);
 assert.equal((output.match(/class="dupe-level/g)||[]).length,16);
 for(let level=1;level<=16;level++){assert.ok(output.includes('Star-'+level+'.svg'));assert.ok(output.includes('More details '+level));}
 assert.doesNotMatch(output,/dimmed/);
});
test('dupe level selection dims higher stars and ignores unsupported star image numbers',()=>{
 const output=render([{level:6,text:'Six'},{level:16,text:'Sixteen'},{level:17,text:'Invalid'},{level:1.5,text:'Fractional'},{level:0,text:'Zero'}],6);
 assert.match(output,/class="dupe-level dimmed"/);assert.match(output,/Star-16.svg/);assert.doesNotMatch(output,/Star-17|Star-1.5|Star-0/);
});
test('missing effect images use a fixed empty frame instead of an empty image URL',()=>{
 const source=html.slice(html.indexOf('  function renderEffect('),html.indexOf('  function prepareEffectIcons('));
 const output=runInNewContext(source+"\nrenderEffect('missing',{missing:{name:'New Effect',type:'Buff',description:'Effect text.'}});",{effectsGlossaryEnabled:false,buildStyle:()=>'',renderEmbeddedContent:text=>text});
 assert.match(output,/effect-icon-empty/);assert.doesNotMatch(output,/<img/);assert.match(output,/Effect text/);
 const present=runInNewContext(source+"\nrenderEffect('shield',{shield:{name:'Shield',icon:'/shield.svg',type:'Buff'}});",{effectsGlossaryEnabled:false,buildStyle:()=>'',renderEmbeddedContent:text=>text});
 assert.match(present,/<img src="\/shield.svg"/);assert.doesNotMatch(present,/effect-icon-empty/);
});
