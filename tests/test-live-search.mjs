import test from 'node:test';
import assert from 'node:assert/strict';
import {liveSearchRecords} from '../assets/js/site-enhancements/live-search.js';
test('search derives new and renamed game content from source data while retaining other pages',()=>{
 const context={roster:{c1:{}},character:()=>({name:'New Character',nickname:'New',affinity:['Fire']}),skills:()=>({B9:{name:'New Skill',description:'Fresh skill text'}}),effects:{fresh:{name:'Fresh Effect',description:'Fresh effect text'}},catalogs:{weapons:{w9:{name:'New Weapon',reference_sections:[{paragraphs:['Fresh weapon text']}]}}}};
 const rows=liveSearchRecords(context,[{type:'Wiki',title:'Article'},{type:'Skill',title:'Outdated'}]);
 assert(rows.some(r=>r.title==='Article'));assert(!rows.some(r=>r.title==='Outdated'));
 for(const name of ['New Character','New · New Skill','Fresh Effect','New Weapon'])assert(rows.some(r=>r.title===name),name);
 assert(rows.find(r=>r.type==='Skill').path.includes('skill=B9'));
});
