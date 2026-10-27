import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseRelationsSource,serializeRelations} from '../wiki/wiki-code/relations-data.js';
const visualSource=readFileSync(new URL('../wiki/wiki-editor/visual.js',import.meta.url),'utf8');
function visual(){const window={};runInNewContext(visualSource,{window,Node:{TEXT_NODE:3,ELEMENT_NODE:1},document:{createTextNode:textContent=>({nodeType:3,textContent})}});return window.WikiVisual;}
test('full CharacterRelations tag stays literal, editable text and round-trips unchanged',()=>{
 const api=visual(),nodes=[];api.inline({append:node=>nodes.push(node)},'{{CharacterRelations}}','/images/');
 const token=nodes.find(node=>node.textContent==='{{CharacterRelations}}');assert.equal(token.nodeType,3);
 assert.equal(api.serialize(token,{field:true}),'{{CharacterRelations}}');
});
test('insert content adds the full tag inside the infobox without duplicating it',()=>{
 const api=visual(),source='{{Page|title=Test}}\n{{Infobox\n|title=Test\n|section=Character Information\n|English Name=Test\n|Age=20\n}}';
 const result=api.characterRelationsSource(source);
 assert.match(result.source,/\|English Name=Test\n\|Relatives=\{\{CharacterRelations\}\}\n\|Age=20/);
 assert.equal(api.characterRelationsSource(result.source).source,result.source);
});
test('inserting the tag handles blank fields and preserves existing authored relationships',()=>{
 const api=visual();assert.match(api.characterRelationsSource('{{Infobox\n|Relatives=\n}}').source,/\|Relatives=\{\{CharacterRelations\}\}/);
 const original='{{Infobox\n|Relatives=[[Other]] (sibling)\n}}';assert.equal(api.characterRelationsSource(original).source,original);
 assert.equal(api.characterRelationsSource('No infobox').source,'No infobox');
});
const editor=readFileSync(new URL('../wiki/wiki-editor/relations.js',import.meta.url),'utf8');
const switchFunction=editor.slice(editor.indexOf('function switchMode('),editor.indexOf("for(const name of ['wiki','source'])",editor.indexOf('function switchMode(')));
const data={version:1,characters:[{id:'first',name:'First',path:'',relatives:''}]};
test('source changes become visual relationship fields without losing markup',()=>{
 const next=structuredClone(data);next.characters[0].relatives='{{Spoiler|[[Other]] (love interest)}}';
 const state={data,mode:'source',busy:false,rawSource:serializeRelations(next),parseRelationsSource,serialize:serializeRelations,render:()=>{},status:()=>{}};
 assert.equal(runInNewContext(switchFunction+"\nswitchMode('wiki');",state),true);
 assert.equal(state.data.characters[0].relatives,next.characters[0].relatives);assert.equal(state.mode,'wiki');
});
test('invalid source is kept for correction and cannot replace the last valid visual data',()=>{
 let message='';const state={data,mode:'source',busy:false,rawSource:'{"characters":',parseRelationsSource,render:()=>{throw Error('must not render');},status:text=>{message=text;}};
 assert.equal(runInNewContext(switchFunction+"\nswitchMode('wiki');",state),false);
 assert.equal(state.data,data);assert.equal(state.mode,'source');assert.equal(state.rawSource,'{"characters":');assert.match(message,/Source code/);
});
const editLinkFunction=editor.slice(editor.indexOf('function editRelationLink('),editor.indexOf('let lastLinkTap='));
test('editing a linked name changes its target and updates the relationship field',()=>{
 let changes=0;const link={dataset:{wikiTarget:'Old name'},closest:()=>({dispatchEvent:()=>changes++})};
 runInNewContext(editLinkFunction+'\neditRelationLink(link);',{local:true,busy:false,link,prompt:()=> ' New name ',Event:class{}});
 assert.equal(link.dataset.wikiTarget,'New name');assert.equal(changes,1);
});
test('cancelling link editing preserves its destination',()=>{
 const link={dataset:{wikiTarget:'Old name'},closest:()=>{throw Error('must not change');}};
 runInNewContext(editLinkFunction+'\neditRelationLink(link);',{local:true,busy:false,link,prompt:()=>null});
 assert.equal(link.dataset.wikiTarget,'Old name');
});

test('full CharacterAffiliations tag is editable and can be inserted without replacing existing affiliations',()=>{
 const api=visual(),nodes=[];api.inline({append:node=>nodes.push(node)},'{{CharacterAffiliations}}','/images/');
 const token=nodes.find(node=>node.textContent==='{{CharacterAffiliations}}');assert.equal(token.nodeType,3);assert.equal(api.serialize(token,{field:true}),'{{CharacterAffiliations}}');
 const source='{{Infobox\n|English Name=Test\n|Relatives={{CharacterRelations}}\n}}';
 const result=api.characterAffiliationsSource(source);assert.match(result.source,/\|Affiliation=\{\{CharacterAffiliations\}\}/);
 assert.equal(api.characterAffiliationsSource(result.source).source,result.source);
 const authored='{{Infobox\n|Affiliation=[[Guild]] (leader)\n}}';assert.equal(api.characterAffiliationsSource(authored).source,authored);
});
