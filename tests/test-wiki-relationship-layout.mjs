import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../wiki/wiki-code/relationship-layout.js',import.meta.url),'utf8');
function setup(){const window={};let yields=0;runInNewContext(source,{window,setTimeout:resolve=>{yields++;resolve();}});return {layout:window.layoutWikiRelationships,get yields(){return yields;}};}
const distance=(p,i,j)=>Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y);
test('family and spiritual bonds sit closer than other personal ties and affiliations',async()=>{
 const {layout}=setup();
 const edges=[{i:0,j:1,type:'personal',close:true},{i:0,j:2,type:'personal',close:true},{i:0,j:3,type:'personal',close:false},{i:0,j:4,type:'affiliation',close:false}];
 const p=await layout(5,edges);
 assert.ok(Math.max(distance(p,0,1),distance(p,0,2))<distance(p,0,3));
 assert.ok(distance(p,0,3)<distance(p,0,4));
});
test('measured names stay separated, including long labels and isolated characters',async()=>{
 const api=setup(),bounds=Array.from({length:24},(_,i)=>({x:i%3?-65:-160,y:-38,width:i%3?130:320,height:108}));
 const edges=Array.from({length:16},(_,i)=>({i:Math.floor(i/4),j:i+4,type:'personal',close:true}));
 const p=await api.layout(bounds.length,edges,bounds);
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  const a=bounds[i],b=bounds[j];
  assert.ok(p[i].x+a.x+a.width+17.9<=p[j].x+b.x||p[j].x+b.x+b.width+17.9<=p[i].x+a.x||p[i].y+a.y+a.height+17.9<=p[j].y+b.y||p[j].y+b.y+b.height+17.9<=p[i].y+a.y,`labels ${i} and ${j} overlap`);
 }
 assert.ok(api.yields>0,'layout yields to input and painting');
});
test('layout is deterministic and supports empty or disconnected graphs',async()=>{
 const {layout}=setup();assert.equal((await layout(0,[])).length,0);
 const a=await layout(8,[]),b=await layout(8,[]);
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.ok(a.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('former partners sit farther apart than current personal ties',async()=>{
 const {layout}=setup();
 const p=await layout(4,[{i:0,j:1,type:'personal'},{i:0,j:2,type:'personal',former:true},{i:0,j:3,type:'affiliation'}]);
 assert.ok(distance(p,0,1)<distance(p,0,2));
 assert.ok(distance(p,0,2)<distance(p,0,3));
});
test('love interests sit almost as close as family and closer than other personal ties',async()=>{
 const {layout}=setup();
 const p=await layout(4,[{i:0,j:1,type:'personal',close:true},{i:0,j:2,type:'personal',loveInterest:true},{i:0,j:3,type:'personal'}]);
 const family=distance(p,0,1),love=distance(p,0,2),other=distance(p,0,3);
 assert.ok(love>family);assert.ok(love<family*1.4);assert.ok(love<other);
});

test('portrait sizes grow with distinct connections and stop at the maximum',()=>{
 const script=readFileSync(new URL('../wiki/wiki-code/relationship.js',import.meta.url),'utf8');
 const context={};runInNewContext(script.slice(0,script.indexOf('/* Capitalize')),context);
 const edges=Array.from({length:19},(_,i)=>({i:0,j:i+1}));
 const radii=context.wikiRelationshipRadii(21,[...edges,edges[0]]);
 assert.equal(radii[20],38);assert.equal(radii[1],38);assert.equal(radii[0],62);
 assert.ok(context.wikiRelationshipRadii(4,[{i:0,j:1},{i:0,j:2}])[0]>radii[1]);
});

test('relative circle sizes use 150 percent of the average as the floor even in dense maps',()=>{
 const script=readFileSync(new URL('../wiki/wiki-code/relationship.js',import.meta.url),'utf8'),context={};
 runInNewContext(script.slice(0,script.indexOf('/* Capitalize')),context);
 const edges=Array.from({length:20},(_,i)=>({i,j:(i+1)%20}));
 const uniform=context.wikiRelationshipRadii(20,edges);
 assert.ok(uniform.every(radius=>radius===38),'equal connection counts stay at baseline');
 for(let j=2;j<19;j++)edges.push({i:0,j});
 const varied=context.wikiRelationshipRadii(20,edges);
 assert.equal(varied[19],38);assert.equal(varied[0],62);
 assert.equal(varied[2],38);
 assert.equal(context.wikiRelationshipRadii(0,[]).length,0);
});

test('affiliation reach outweighs family and overlapping affiliations do not count people twice',()=>{
 const script=readFileSync(new URL('../wiki/wiki-code/relationship.js',import.meta.url),'utf8'),context={};
 runInNewContext(script.slice(0,script.indexOf('/* Capitalize')),context);
 const family=[{i:0,j:1,type:'personal',family:true},{i:0,j:2,type:'personal',family:true}];
 const affiliations=[{i:3,j:4,type:'affiliation',shared:['Guild']},{i:3,j:5,type:'affiliation',shared:['Guild']}];
 const radii=context.wikiRelationshipRadii(7,[...family,...affiliations]);
 assert.ok(radii[3]>radii[0]);assert.equal(radii[4],38);assert.equal(radii[1],38);
 const overlapping=affiliations.map(edge=>({...edge,shared:['Guild','Academy']}));
 assert.equal(JSON.stringify(context.wikiRelationshipRadii(7,[...family,...overlapping,{...overlapping[0],i:4,j:3}])),JSON.stringify(radii));
 const more=context.wikiRelationshipRadii(7,[...family,...affiliations,{i:0,j:6,type:'affiliation',shared:['Academy']},{i:0,j:4,type:'affiliation',shared:['Academy']}]);
 assert.ok(more[0]>radii[0],'another unique affiliation member increases reach');
 assert.equal(Math.min(...more),38);assert.equal(Math.max(...more),62);
});

test('a low-connection outlier does not enlarge the rest of a dense cast',()=>{
 const script=readFileSync(new URL('../wiki/wiki-code/relationship.js',import.meta.url),'utf8'),context={};
 runInNewContext(script.slice(0,script.indexOf('/* Capitalize')),context);
 const edges=[];
 // Eight well-connected characters, one isolated character, and one larger hub.
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)edges.push({i,j,type:'affiliation'});
 edges.push({i:0,j:8,type:'affiliation'});
 const radii=context.wikiRelationshipRadii(10,edges);
 // Scores: 8, seven 7s, 1, 0. Average 5.8; threshold 8.7 exceeds max 8.
 assert.ok(radii.every(radius=>radius===38),'all scores below 150% of average remain at minimum');
 const star=context.wikiRelationshipRadii(6,Array.from({length:5},(_,i)=>({i:0,j:i+1,type:'affiliation'})));
 assert.equal(star[0],62);assert.ok(star.slice(1).every(radius=>radius===38));
});

test('only scores above 150 percent of the average scale up, with exact threshold at minimum',()=>{
 const script=readFileSync(new URL('../wiki/wiki-code/relationship.js',import.meta.url),'utf8'),context={};
 runInNewContext(script.slice(0,script.indexOf('/* Capitalize')),context);
 // Degrees 4,3,2,1,1,1: mean 2, threshold 3. Only degree 4 grows.
 const edges=[[0,1],[0,2],[0,3],[0,4],[1,2],[1,5]].map(([i,j])=>({i,j,type:'affiliation'}));
 const radii=context.wikiRelationshipRadii(6,edges);
 assert.equal(radii[0],62);assert.ok(radii.slice(1).every(radius=>radius===38));
 // Adding empty records lowers the mean: degree 3 now lies between the floor and maximum.
 const expanded=context.wikiRelationshipRadii(8,edges),floor=1.5*12/8;
 assert.ok(Math.abs(expanded[1]-(38+24*(3-floor)/(4-floor)))<1e-9);
 assert.ok(expanded.every(radius=>Number.isFinite(radius)&&radius>=38&&radius<=62));
});

test('more shared affiliations pull a pair closer, with bounded influence and no duplicate boost',async()=>{
 const {layout}=setup();
 const gap=async shared=>distance(await layout(2,[{i:0,j:1,type:'affiliation',shared}]),0,1);
 const one=await gap(['Guild']),two=await gap(['Guild','Academy']),four=await gap(['Guild','Academy','District','Team']);
 assert.ok(two<one);assert.ok(four<two);
 assert.equal(await gap(['Guild','Academy','District','Team','Society','Order']),four,'extra memberships stop shrinking the target at the cap');
 assert.equal(await gap(['Guild',' guild ','GUILD']),one,'duplicate memberships do not strengthen attraction');
 const family=distance(await layout(2,[{i:0,j:1,type:'personal',close:true}]),0,1);
 assert.ok(family<four,'even heavily affiliated pairs retain more distance than close family');
});
test('shared affiliations also prioritize personal pairs without changing close bonds',async()=>{
 const {layout}=setup(),shared=['Guild','Academy','District','Team'];
 const gap=async edge=>distance(await layout(2,[{i:0,j:1,type:'personal',...edge}]),0,1);
 assert.ok(await gap({shared})<await gap({}));
 assert.equal(await gap({close:true,shared}),await gap({close:true}));
 assert.equal(await gap({loveInterest:true,shared}),await gap({loveInterest:true}));
 assert.ok(await gap({former:true,shared})>await gap({shared}));
});

test('each mode uses only its own connection priorities without modifying the shared graph',async()=>{
 const window={};runInNewContext(source,{window,setTimeout:resolve=>resolve()});
 const edges=[{i:0,j:1,type:'personal',close:true,shared:['Guild']},{i:0,j:2,type:'affiliation',shared:['Guild','Academy','Team','District']}];
 const original=JSON.stringify(edges),family=window.wikiRelationshipLayoutEdges(edges,'personal'),affiliations=window.wikiRelationshipLayoutEdges(edges,'affiliation');
 assert.equal(family.length,1);assert.equal(family[0].close,true);assert.equal(family[0].shared.length,0);
 assert.equal(affiliations.length,2);assert.ok(affiliations.every(e=>e.type==='affiliation'&&!e.close&&!e.former&&!e.loveInterest));
 const familyPoints=await window.layoutWikiRelationships(3,family),affiliationPoints=await window.layoutWikiRelationships(3,affiliations),allPoints=await window.layoutWikiRelationships(3,window.wikiRelationshipLayoutEdges(edges,'all'));
 assert.ok(distance(familyPoints,0,1)<distance(affiliationPoints,0,1),'family view gives family connection priority');
 assert.ok(distance(affiliationPoints,0,2)<distance(familyPoints,0,2),'affiliation view groups shared memberships');
 assert.notEqual(JSON.stringify(familyPoints),JSON.stringify(allPoints));assert.notEqual(JSON.stringify(affiliationPoints),JSON.stringify(allPoints));
 assert.equal(JSON.stringify(edges),original);
});
