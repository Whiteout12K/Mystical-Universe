import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterNames} from '../JScratch/editor/parameters.mjs';
import {isLiteralField} from '../JScratch/editor/model.mjs';
test('parameter header parsing accepts literal names and never evaluates computed definitions',()=>{
    assert.deepEqual(parameterNames('["target", \'amount\']'),['target','amount']);assert.deepEqual(parameterNames('[]'),[]);for(const source of ['["a","a"]','[""]','[name]','[...args]','(()=>{throw new Error("executed")})()','[null]','[1]','["a",,]'])assert.equal(parameterNames(source),null);
});
test('only primitive defaults become replaceable shadow fields',()=>{
    for(const source of ['0','-3','+5','true','null','"Player"',"'Player'"])assert.equal(isLiteralField(source),true);for(const source of ['getVar("Score")','score','1+2','/test/','["a"]','({a:1})'])assert.equal(isLiteralField(source),false);
});
