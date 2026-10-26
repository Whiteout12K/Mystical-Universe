import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {touchAction} from '../books/page-navigation.js';
const source=readFileSync(new URL('../books/reader.js',import.meta.url),'utf8');
const input=source.slice(source.indexOf('function connectPageInput('),source.indexOf('connectPageInput(document);'));
function gestures(){
 const listeners={},turns=[];let now=0,prevented=0;
 const doc={defaultView:{ontouchstart:null,PointerEvent:class{}},getSelection:()=>({toString:()=>''}),querySelector:()=>null,addEventListener:(name,handler)=>listeners[name]=handler};
 const target={closest:()=>null};
 const context={preventReaderZoom:()=>{},document:doc,Date:{now:()=>now},touchAction,turn:direction=>turns.push(direction),edgeTap:event=>{if(event.clientX<94){event.preventDefault();turns.push(-1)}}};
 runInNewContext(input+'\nconnectPageInput(document);',context);
 const point=(x,y)=>({clientX:x,clientY:y});
 const event=(x,y,end=false)=>({target,touches:end?[]:[point(x,y)],changedTouches:[point(x,y)],preventDefault:()=>prevented++});
 return {listeners,turns,get prevented(){return prevented},start(x=30,y=200){listeners.touchstart(event(x,y))},move(x,y){listeners.touchmove(event(x,y))},end(elapsed=100,x=30,y=200){now=elapsed;listeners.touchend(event(x,y,true))}};
}
test('Safari-style touch input turns on a short edge tap even when Pointer Events are also present',()=>{
 const input=gestures();input.start();input.end();assert.deepEqual(input.turns,[-1]);assert.equal(input.prevented,1);
});
test('a native text-selection hold and a drag returning to its starting point do not turn pages or prevent selection',()=>{
 const hold=gestures();hold.start();hold.end(550);assert.deepEqual(hold.turns,[]);assert.equal(hold.prevented,0);
 const drag=gestures();drag.start();drag.move(60,220);drag.end(200);assert.deepEqual(drag.turns,[]);assert.equal(drag.prevented,0);
});
