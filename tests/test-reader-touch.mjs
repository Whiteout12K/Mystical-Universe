import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {touchAction,edgeDirection} from '../books/page-navigation.js';
const source=readFileSync(new URL('../books/reader.js',import.meta.url),'utf8');
const input=source.slice(source.indexOf('function connectPageInput('),source.indexOf('connectPageInput(document);'));
const edges=source.slice(source.indexOf('function edgeTap('),source.indexOf('// Handle touch release'));
function gestures(topLevel=false){
 const listeners={},turns=[];let now=0,prevented=0,selection='';
 const frame={getBoundingClientRect:()=>({left:-780,top:-900})};
 const doc={defaultView:{ontouchstart:null,PointerEvent:class{},frameElement:frame},getSelection:()=>({toString:()=>selection}),addEventListener:(name,handler)=>listeners[name]=handler};
 const parent={documentElement:{clientWidth:390},querySelector:()=>null,getSelection:()=>({toString:()=>''})};
 if(topLevel)Object.assign(parent,doc);
 const inputDocument=topLevel?parent:doc;
 const target={closest:()=>null};
 const context={readerReady:true,rendition:{getContents:()=>[]},window:{screenX:0},preventReaderZoom:()=>{},bookDoc:inputDocument,frame,document:parent,Date:{now:()=>now},touchAction,edgeDirection,turn:direction=>turns.push(direction),$:()=>({getBoundingClientRect:()=>({top:100,bottom:750})})};
 runInNewContext(edges+input+'\nconnectPageInput(bookDoc,frame);',context);
 const point=(x,y,screenX=x)=>({clientX:x,clientY:y,screenX});
 const event=(x,y,end=false,screenX=x)=>({target,touches:end?[]:[point(x,y,screenX)],changedTouches:[point(x,y,screenX)],...point(x,y,screenX),pointerType:'touch',isPrimary:true,button:0,detail:1,preventDefault:()=>prevented++});
 return {listeners,turns,get prevented(){return prevented},select(text){selection=text},start(x=30,y=200,screenX=x){listeners.touchstart(event(x,y,false,screenX))},move(x,y){listeners.touchmove(event(x,y))},end(elapsed=100,x=30,y=200,screenX=x){now=elapsed;listeners.touchend(event(x,y,true,screenX))},pointerStart(x=30,y=200){listeners.pointerdown(event(x,y))},pointerEnd(elapsed=100,x=30,y=200){now=elapsed;listeners.pointerup(event(x,y))},click(x=30,y=200){listeners.click(event(x,y))}};
}
test('left and right phone taps turn pages despite translated or offset EPUB iframe coordinates',()=>{
 const left=gestures();left.start();left.end();assert.deepEqual(left.turns,[-1]);assert.equal(left.prevented,1);
 const right=gestures();right.start(1130,200,350);right.end(100,1130,200,350);assert.deepEqual(right.turns,[1]);
 const noScreen=gestures();noScreen.start(350,200,0);noScreen.end(100,350,200,0);assert.deepEqual(noScreen.turns,[1]);
});
test('touch, pointer and compatibility click events for one finger tap turn exactly once',()=>{
 const input=gestures();input.pointerStart();input.start();input.pointerEnd();input.end();input.click();assert.deepEqual(input.turns,[-1]);
});
test('pointer-only phone input works even when an ontouchstart property exists',()=>{
 const input=gestures();input.pointerStart(350);input.pointerEnd(100,350);input.click(350);assert.deepEqual(input.turns,[1]);
});
test('native selection holds, dragging and existing highlighted text never turn pages or prevent selection',()=>{
 for(const x of [30,350]){
  const hold=gestures();hold.start(x);hold.end(550,x);hold.click(x);assert.deepEqual(hold.turns,[]);assert.equal(hold.prevented,0);
  const drag=gestures();drag.start(x);drag.move(x+30,220);drag.end(200,x);assert.deepEqual(drag.turns,[]);assert.equal(drag.prevented,0);
  const selection=gestures();selection.start(x);selection.select('Highlighted text');selection.end(180,x);assert.deepEqual(selection.turns,[]);assert.equal(selection.prevented,0);
 }
});

test('top-level reader receives side taps directly and leaves native long presses alone',()=>{
 for(const [x,direction] of [[30,-1],[350,1]]){
  const tap=gestures(true);tap.start(x);tap.end(100,x);assert.deepEqual(tap.turns,[direction]);
  const hold=gestures(true);hold.start(x);hold.end(550,x);assert.deepEqual(hold.turns,[]);assert.equal(hold.prevented,0);
 }
});
