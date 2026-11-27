import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/js/site-enhancements/build-catalog.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
test('Used by refreshes names and effect references directly from authored character and tree JSON',async()=>{
 let name='Original skill',requests=[];
 const scope=vm.createContext({fetch:async(path,options)=>{requests.push({path,cache:options.cache});return {ok:true,json:async()=>path.endsWith('skill-tree.json')?{nodes:{n001:{name}}}:{B1:{name,description:'{{effect:freeze}}'}}};}});
 vm.runInContext(source,scope);
 const context={roster:{c1:{},c4:{},c1b:{base_character:'c1'}},skills:()=>({B1:{name:'Stale compiled name'}}),character:id=>({skills_path:'/Characters/'+id.toUpperCase()})};
 let live=await scope.refreshBuildSkills(context);
 assert.equal(live.skills('c1').B1.name,'Original skill');assert.equal(live.skills('c1b').B1.name,'Original skill');assert.equal(live.skills('c4')['tree-n001'].name,'Original skill');
 assert.equal(requests.length,2);assert(requests.every(request=>request.cache==='no-cache'));
 name='Renamed skill';live=await scope.refreshBuildSkills(context);
 assert.equal(live.skills('c1').B1.name,'Renamed skill');assert.equal(live.skills('c1').B1.description,'{{effect:freeze}}');
});
