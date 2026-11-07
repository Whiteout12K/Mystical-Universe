import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
class Element{
 constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.dataset={};this.style={setProperty(){}};this.parentElement=null;}
 get children(){return this.childNodes.filter(n=>n.nodeType===1);}get lastElementChild(){return this.children.at(-1);}
 append(...nodes){for(let node of nodes){if(typeof node==='string')node={nodeType:3,textContent:node};node.parentElement=this;this.childNodes.push(node);}}
 get textContent(){return this.childNodes.map(n=>n.textContent).join('');}set textContent(text){this.childNodes=[];this.append({nodeType:3,textContent:text});}
 getAttribute(name){return this[name]||null;}
}
const make=(tag,cls,text)=>{const node=new Element(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
const descendants=root=>root.children.flatMap(node=>[node,...descendants(node)]);
function visual(){const window={};let source=readFileSync(new URL('../wiki/wiki-editor/visual.js',import.meta.url),'utf8');source=source.replace('window.WikiVisual={','window.WikiVisual={body,');runInNewContext(source,{window,Node:{TEXT_NODE:3,ELEMENT_NODE:1},location:{href:'https://example.test/wiki/'},URL,document:{createElement:tag=>new Element(tag),createTextNode:textContent=>({nodeType:3,textContent})}});return window.WikiVisual;}
function renderPublic(source,nested=false){
 const script=readFileSync(new URL('../wiki/wiki-code/wikitext.js',import.meta.url),'utf8');const from=script.indexOf('  function renderText('),to=script.indexOf('  renderText(text,sectionRoot);',from),root=make('div');
 const context={make,inline:(parent,text)=>{parent.textContent=text;},intro:root,tabID:label=>label.toLowerCase().replaceAll(' ','-')};
 runInNewContext(script.slice(from,to)+'\nrenderText('+JSON.stringify(source)+',intro,'+nested+');',context);return root;
}
test('public list headings keep their nested list structure and full contents depth',()=>{
 const source='== Powers ==\n* === Soul Magic ===\n** ==== Soul Corridor ====\n*** ===== Soul Sage =====\n**** ====== Asoryne ======\n***** ====== Astral Projection ======\n* Ordinary sibling';
 const root=renderPublic(source),headings=descendants(root).filter(n=>n.dataset.wikiListHeading!==undefined);
 assert.equal(headings.length,5);assert.deepEqual(headings.map(n=>n.parentElement.tagName),['LI','LI','LI','LI','LI']);
 assert.deepEqual(headings.map(n=>n.dataset.wikiTocDepth),['1','2','3','4','5']);
 assert.equal(headings[4].parentElement.parentElement.parentElement,headings[3].parentElement);
 assert.equal(headings[0].parentElement.parentElement.children.at(-1).textContent,'Ordinary sibling');
});
test('visual rendering and source serialization preserve mixed list headings, formatting, links, and deep indentation',()=>{
 const api=visual(),root=make('div');
 const source="* === Lightning ===\n** ==== [[fandom:Judgment|Judgment]] ====\n*** ===== '''Power''' =====\n**** ====== Soul Sage ======\n***** ====== Astral Projection ======\n***** Plain ability\n* === Other ===";
 api.body(root,source,'/images/');assert.equal(api.serialize(root).trim(),source);
 assert.equal(descendants(root).filter(n=>/^H[2-6]$/.test(n.tagName)).length,6);
});
test('ordered list headings and headings in nested disclosures retain their normal behavior',()=>{
 const root=renderPublic('# === First ===\n## ==== Child ====\n# === Second ===',true),headings=descendants(root).filter(n=>n.dataset.wikiListHeading!==undefined);
 assert.equal(headings.length,3);assert.ok(headings.every(n=>n.parentElement.parentElement.tagName==='OL'));
 assert.ok(headings.every(n=>n.dataset.wikiTocExclude===''));
});
test('Kiara includes every requested branch at the intended indentation',()=>{
 const source=readFileSync(new URL('../wiki/char/kiara_katzol.html',import.meta.url),'utf8').split('|tab=Powers & Abilities')[1].split('|tab=Relationships')[0];
 const expected=[['Lightning Discharge',1],['Judgment',2],['Dark Lightning',2],['Sage Mana Zone',2],['Contamination',2],['Material Creation',3],['Element Affinity Creation',3],['Poison Creation',3],['Shadow Clones',2],['Parallel Existence',3],['Electro-charged',2],['Lunar Lightning Creation',3],['Space Phasing',2],['Transformation (lightning)',2],['Absolute Transcendalism',3],['Element Manipulation',4],['Evolution of Omnipotency',4],['Tigress Sage',3],['Insurrection Incarnate',3],['Soul Magic',2],['Entropy Manipulation',3],['Chaos Manipulation',4],['Severance',4],['Destiny in Death',4],['Absolute Annihilus',4],['Requiem of Death',3],['Soul Corridor',3],['Asoryne',4],['Astral Projection',5],['Soul Link',4],['Soul Communication',5],['Mind Control',4],['Mind Reading',4],['Soul Singularity',4],['Energy Condensation',2],['Gathering Sickle',1],['Harvest',2],['Soul Harvest',3],['Transmutation',2],['Purification',3],['Awareness and Empowerment Qi',1],['Felior Characteristics',1],['Enhanced Sight',2],['Elevated Speed',2]];
 const lines=source.split('\n');for(const [name,depth] of expected)assert.ok(lines.some(line=>line.startsWith('*'.repeat(depth)+' ')&&!line.startsWith('*'.repeat(depth+1))&&line.includes(name)),name);
 assert.match(source,/All of Kiara’s skills/);assert.match(source,/Artiana’s First Blessing/);assert.match(source,/Hadestias’ Second Blessing/);
});
