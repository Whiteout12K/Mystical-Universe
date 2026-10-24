import {test} from 'node:test';
import assert from 'node:assert/strict';
import {edgeDirection,wholeBookPage,touchAction} from '../books/page-navigation.js';
test('phone page-turn zones reach inward while the center stays available',()=>{
 assert.equal(edgeDirection(80,390),-1);assert.equal(edgeDirection(310,390),1);assert.equal(edgeDirection(195,390),0);
 assert.equal(edgeDirection(170,1280),-1);assert.equal(edgeDirection(1110,1280),1);assert.equal(edgeDirection(640,1280),0);assert.equal(edgeDirection(-1,390),0);assert.equal(edgeDirection(391,390),0);
});
test('whole-book numbering spans chapters without skipped or repeated numbers',()=>{
 const counts=[3,2,10];assert.deepEqual(wholeBookPage(counts,0,1),{page:1,total:15});assert.deepEqual(wholeBookPage(counts,0,3),{page:3,total:15});assert.deepEqual(wholeBookPage(counts,1,1),{page:4,total:15});assert.deepEqual(wholeBookPage(counts,2,10),{page:15,total:15});assert.deepEqual(wholeBookPage(counts,2,100),{page:15,total:15});assert.equal(wholeBookPage([3,null,10],0,1),null);assert.equal(wholeBookPage([],0,1),null);assert.equal(wholeBookPage(counts,3,1),null);
});

test('touch releases accept normal finger jitter and distinguish swipes and selection',()=>{
 assert.equal(touchAction(0,0,100),'tap');assert.equal(touchAction(10,-12,240),'tap');
 assert.equal(touchAction(-70,10,200),'next');assert.equal(touchAction(70,10,200),'previous');
 assert.equal(touchAction(5,50,200),null);assert.equal(touchAction(1,1,900),null);
});
