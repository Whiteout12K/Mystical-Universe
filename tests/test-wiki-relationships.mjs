import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../wiki/wiki-code/relationship.js',import.meta.url),'utf8');
const archiveSource=readFileSync(new URL('../wiki/wiki-code/article-features.js',import.meta.url),'utf8');
const archiveWindow={};
runInNewContext(archiveSource.slice(0,archiveSource.indexOf('/* Shared article tools')),{window:archiveWindow});
const wikiAffiliations=archiveWindow.wikiAffiliations;
const expand=runInNewContext(source.slice(0,source.indexOf('/* Connections come'))+'\nexpandWikiRelationshipProfiles;');
const wikiRelationshipLines=runInNewContext(source.slice(0,source.indexOf('/* Keep named'))+'\nwikiRelationshipLines;');
const profile=(title,path,relations='')=>({title,path,relations,affiliations:[]});
test('unpublished linked and plain-name relatives stay listed once without article paths',()=>{
 const published=[profile('Ted','/wiki/char/teddric_tech','Relatives: [[Timothy Tech]] (father)\nRelatives: Alisha Locks (sister)'),profile('Avery','/wiki/char/avery_obtainia','Relatives: [[fandom:Timothy Tech|Timothy Tech]] (uncle)')];
 const result=expand(published);
 assert.equal(result.length,4);
 for(const name of ['Timothy Tech','Alisha Locks']){const pending=result.find(p=>p.title===name);assert.equal(pending.unpublished,true);assert.equal(pending.path,'');}
 assert.equal(published.length,2);
});
test('published characters resolve through their title or slug without duplicates',()=>{
 const result=expand([profile('Avery','/wiki/char/avery_obtainia','Relatives: [[char/caela_obtainia|Caela]] (mother)'),profile('Caela Obtainia','/wiki/char/caela_obtainia')]);
 assert.equal(result.length,2);assert.ok(result.every(p=>!p.unpublished));
});
test('generic unknown relatives are not invented as shared named characters',()=>{
 assert.equal(expand([profile('Avery','/wiki/char/avery','Relatives: Unnamed father\nRelatives: Unknown')]).length,1);
});

test('missing page paths never match unrelated unlabeled relationship links',()=>{
 const profiles=expand([profile('Ted','/wiki/char/teddric_tech','Relatives: [[Timothy Tech]] (father)'),profile('Lucy','/wiki/char/lucy_terner','Relatives: [[The White Assassin]] (sister)')]);
 const graph=source.slice(source.indexOf('  const edges=[];'),source.indexOf('  let points='));
 const edges=runInNewContext(graph+'\nedges;',{profiles,wikiRelationshipLines,window:{wikiAffiliations}});
 assert.equal(edges.length,2);
 const pairs=edges.map(e=>[profiles[e.i].title,profiles[e.j].title].sort().join(' / ')).sort();
 assert.equal(JSON.stringify(pairs),JSON.stringify(['Lucy / The White Assassin','Ted / Timothy Tech']));
});

test('Pyrus has personal subordinate ties with reciprocal leader labels',()=>{
 const profiles=[profile('Pyrus Bourn','/wiki/char/pyrus_bourn','Relatives: [[char/tom_nado|Tom Nado]] (subordinate)\nRelatives: [[char/tony_smith|Tony Smith]] (subordinate)\nRelatives: [[char/ellie_tracey|Ellie Tracey]] (subordinate)'),...['Tom Nado','Tony Smith','Ellie Tracey'].map(name=>profile(name,'/wiki/char/'+name.toLowerCase().replaceAll(' ','_'),'Leader: [[char/pyrus_bourn|Pyrus Bourn]]'))];
 const graph=source.slice(source.indexOf('  const edges=[];'),source.indexOf('  let points='));
 const edges=runInNewContext(graph+'\nedges;',{profiles,wikiRelationshipLines,window:{wikiAffiliations}});
 assert.equal(edges.length,3);
 for(const edge of edges){assert.equal(edge.type,'personal');assert.equal(edge.close,false);assert.equal(edge.listLabels[0],'subordinate');assert.equal(edge.listLabels[edge.j],'leader');}
});
test('a leader or subordinates field alone supplies the inverse relationship',()=>{
 const graph=source.slice(source.indexOf('  const edges=[];'),source.indexOf('  let points='));
 for(const [field,role,inverse] of [['Leader','leader','subordinate'],['Subordinates','subordinate','leader']]){
  const profiles=[profile('First','/wiki/char/first',field+': [[char/second|Second]]'),profile('Second','/wiki/char/second')];
  const edges=runInNewContext(graph+'\nedges;',{profiles,wikiRelationshipLines,window:{wikiAffiliations}});
  assert.equal(edges.length,1);assert.equal(edges[0].listLabels[0],role);assert.equal(edges[0].listLabels[1],inverse);
 }
});

function relationships(profiles){
 const graph=source.slice(source.indexOf('  const edges=[];'),source.indexOf('  let points='));
 return runInNewContext(graph+'\nedges;',{profiles,wikiRelationshipLines,window:{wikiAffiliations}});
}
test('accented and unaccented engagement roles are recognized with current/former labels',()=>{
 for(const role of ['fiancé','fiancée','fiance','fiancee','betrothed','former fiancé','former fiancée','ex-fiance','former wife','ex-boyfriend']){
  const profiles=expand([profile('Lux','/wiki/char/lux','Relatives: [[Prince Aether]] ('+role+')')]);
  const [edge]=relationships(profiles),lux=profiles.findIndex(p=>p.title==='Lux'),aether=profiles.findIndex(p=>p.title==='Prince Aether');
  const past=/former|ex-/.test(role);
  assert.equal(edge.type,'personal',role);assert.equal(edge.former,past,role);
  assert.equal(edge.close,!past&&!/boyfriend/.test(role),role);
  assert.equal(edge.listLabels[lux],role);
  assert.equal(edge.listLabels[aether].startsWith('former '),past);
 }
});
test('plain text inside spoiler wrappers and br-separated names forms clean character entries',()=>{
 const profiles=expand([profile('Lux','/wiki/char/lux','Relatives: {{Spoiler|Prince Aether (former fiancé)<br>Second Prince (fiancé)}}')]);
 assert.equal(profiles.length,3);
 assert.ok(profiles.some(p=>p.title==='Prince Aether'));
 assert.ok(profiles.some(p=>p.title==='Second Prince'));
 assert.equal(relationships(profiles).length,2);
});
test('former crushes never become present mutual feelings',()=>{
 const [edge]=relationships([profile('First','/wiki/char/first','Relatives: [[Second]] (former crush)'),profile('Second','/wiki/char/second','Relatives: [[First]] (former crush)')]);
 assert.equal(edge.former,true);assert.equal(edge.close,false);
 assert.match(edge.label,/previously had feelings/);assert.doesNotMatch(edge.label,/have feelings for each other/);
});
test('dedicated former fiancé fields preserve their relationship status',()=>{
 const [edge]=relationships([profile('First','/wiki/char/first','Former Fiancé: [[Second]]'),profile('Second','/wiki/char/second')]);
 assert.equal(edge.former,true);assert.equal(edge.listLabels[0],'former fiancé');assert.equal(edge.listLabels[1],'former fiancé(e)');
});

test('relationship capitalization preserves accents, suffixes, apostrophes, and acronyms',()=>{
 const format=runInNewContext(source.slice(0,source.indexOf('/* Keep named'))+'\nformatWikiRelationshipLabel;');
 for(const [input,expected] of [
  ['fiancé','Fiancé'],['fiancée','Fiancée'],['former fiancé','Former Fiancé'],
  ['former fiancé(e)','Former Fiancé(e)'],['ex-fiancée','Ex-Fiancée'],
  ['fiance\u0301e','Fiance\u0301e'],['élève','Élève'],['spiritual bond','Spiritual Bond'],
  ['IT Agency','IT Agency'],['Pyro’s subordinates','Pyro’s Subordinates']
 ])assert.equal(format(input),expected);
});

test('rivals create personal connections with labels in both directions',()=>{
 for(const [field,role] of [['Relatives','rival'],['Relationships','rival'],['Rival',''],['Rivals','']]){
  const [edge]=relationships([profile('First','/wiki/char/first',field+': [[Second]]'+(role?' ('+role+')':'')),profile('Second','/wiki/char/second')]);
  assert.equal(edge.type,'personal');assert.equal(edge.close,false);assert.equal(edge.listLabels[1],'rival');assert.match(edge.listLabels[0],/^rivals?$/);
 }
});
test('unpublished rivals and former rival labels are retained',()=>{
 const profiles=expand([profile('First','/wiki/char/first','Relatives: [[Second]] (former rival)')]);
 const [edge]=relationships(profiles);
 assert.equal(profiles[1].unpublished,true);assert.equal(edge.former,true);assert.equal(edge.listLabels[0],'former rival');assert.equal(edge.listLabels[1],'former rival');
});
test('a friend who is also a rival still has a rivalry connection',()=>{
 const [edge]=relationships([profile('First','/wiki/char/first','Relatives: [[Second]] (friend and rival)'),profile('Second','/wiki/char/second')]);
 assert.equal(edge.type,'personal');assert.equal(edge.listLabels[0],'friend and rival');
});

test('affiliation identity ignores notes, duplicate entries, spacing, and case',()=>{
 const shared=wikiAffiliations.shared(['IT Agency (intern)','  Regnum  Academy (student)','IT Agency'],['it agency (employee)','Regnum Academy (teacher)']);
 assert.equal(JSON.stringify(shared),JSON.stringify(['IT Agency','Regnum Academy']));
});
test('affiliations inside spoiler wrappers or br-separated lists stay available',()=>{
 const names=wikiAffiliations.parse('[[IT|IT Agency]] (intern)\n{{Spoiler|[[Regnum Academy]] (former (student))<br>District 7 (Magni)}}');
 assert.equal(JSON.stringify(names),JSON.stringify(['IT Agency','Regnum Academy','District 7']));
});
test('personal connections retain shared affiliations and also pass the affiliation filter',()=>{
 const profiles=[{...profile('First','/wiki/char/first','Relatives: [[Second]] (rival)'),affiliations:['IT Agency (intern)']},{...profile('Second','/wiki/char/second'),affiliations:['IT Agency (employee)']}];
 const [edge]=relationships(profiles);
 assert.equal(edge.type,'personal');assert.equal(edge.listLabels[0],'rival');assert.equal(JSON.stringify(edge.shared),JSON.stringify(['IT Agency']));
 const fn=source.slice(source.indexOf('  function matchesFilter('),source.indexOf('  function refresh('));
 const matches=runInNewContext(fn+'\nmatchesFilter;',{filter:{value:'affiliation'}});
 assert.equal(matches(edge),true);assert.equal(matches({...edge,shared:[]}),false);
});
test('matching affiliations create an edge without a personal relationship',()=>{
 const [edge]=relationships([{...profile('First','/wiki/char/first'),affiliations:['Regnum Academy (student)']},{...profile('Second','/wiki/char/second'),affiliations:['Regnum Academy']}]);
 assert.equal(edge.type,'affiliation');assert.equal(edge.listLabels[0],'Regnum Academy');
});

test('deity contracts are close personal bonds with matching labels in both directions',()=>{
 for(const field of ['Relatives','Relationships','Deity Contract']){
  const profiles=expand([profile('First','/wiki/char/first',field+': [[Deity]]'+(field==='Deity Contract'?'':' (deity contract)'))]);
  const [edge]=relationships(profiles);
  assert.equal(edge.type,'personal');assert.equal(edge.close,true);
  assert.equal(edge.listLabels[0],'deity contract');assert.equal(edge.listLabels[1],'deity contract');
  assert.equal(profiles.find(p=>p.title==='Deity').unpublished,true);
 }
});

test('demon contracts are close bonds and preserve their type in both directions',()=>{
 for(const field of ['Relatives','Relationships','Demon Contract']){
  const profiles=expand([profile('First','/wiki/char/first',field+': [[Demon]]'+(field==='Demon Contract'?'':' (demon contract)'))]);
  const [edge]=relationships(profiles);
  assert.equal(edge.type,'personal');assert.equal(edge.close,true);
  assert.equal(edge.listLabels[0],'demon contract');assert.equal(edge.listLabels[1],'demon contract');
  assert.equal(profiles.find(p=>p.title==='Demon').unpublished,true);
 }
});
test('current love interests get near-family spacing while former interests do not',()=>{
 for(const [role,expected] of [['love interest',true],['crush',true],['former love interest',false]]){
  const [edge]=relationships([profile('First','/wiki/char/first','Relatives: [[Second]] ('+role+')'),profile('Second','/wiki/char/second')]);
  assert.equal(edge.loveInterest,expected);assert.equal(edge.close,false);
 }
});
