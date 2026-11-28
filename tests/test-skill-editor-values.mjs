import test from 'node:test';
import assert from 'node:assert/strict';
import {dynamicValueParts} from '../assets/js/skill-editor-values.js';
test('typed dynamic values distinguish numbers and percentages without capturing effect names',()=>{
 assert.deepEqual(dynamicValueParts('Deal [dmg1%] and [dmg2], then gain [Shield].'),[{text:'Deal '},{key:'dmg1',percent:true},{text:' and '},{key:'dmg2',percent:false},{text:', then gain [Shield].'}]);
 assert.deepEqual(dynamicValueParts('[heal%] [heal] [Freeze]',{heal:5}),[{key:'heal',percent:true},{text:' '},{key:'heal',percent:false},{text:' [Freeze]'}]);
 assert.deepEqual(dynamicValueParts('[duration] [Light]'),[{text:'[duration] [Light]'}]);
 assert.deepEqual(dynamicValueParts('[dmg1%] + [dmg1%]'),[{key:'dmg1',percent:true},{text:' + '},{key:'dmg1',percent:true}]);
});
