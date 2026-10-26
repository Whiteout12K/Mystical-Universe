import {test} from 'node:test';
import assert from 'node:assert/strict';
import {edgeDirection,wholeBookPage,touchAction} from '../books/page-navigation.js';
import {resolveChapterLink,readerChapterURL} from '../books/book-links.js';
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

test('Contents links resolve within the EPUB on localhost and a hosted HTTPS domain',()=>{
 const sections=[{href:'chapter-001.xhtml',url:'/GoogleDoc/chapter-001.xhtml'},{href:'chapter 2.xhtml',url:'/GoogleDoc/chapter%202.xhtml'}];
 for(const origin of ['http://localhost:8765','https://mysticallegends.org']){
  const current='/GoogleDoc/contents.xhtml';
  assert.equal(resolveChapterLink('chapter-001.xhtml',current,sections,origin),'chapter-001.xhtml');
  assert.equal(resolveChapterLink('./chapter%202.xhtml#heading',current,sections,origin),'chapter 2.xhtml#heading');
  assert.equal(resolveChapterLink('../GoogleDoc/chapter-001.xhtml',current,sections,origin),'chapter-001.xhtml');
  assert.equal(resolveChapterLink(origin+'/GoogleDoc/chapter-001.xhtml#scene',current,sections,origin),'chapter-001.xhtml#scene');
  assert.equal(resolveChapterLink('#scene','/GoogleDoc/chapter-001.xhtml',sections,origin),'chapter-001.xhtml#scene');
  for(const invalid of ['https://other.example/GoogleDoc/chapter-001.xhtml','javascript:alert(1)','/books/reader.html','missing.xhtml',''])assert.equal(resolveChapterLink(invalid,current,sections,origin),null);
 }
});

test('actual published EPUB Contents links all resolve on the hosted domain',async()=>{
 const {execFileSync}=await import('node:child_process');
 const root=new URL('../',import.meta.url);
 const fixtures=JSON.parse(execFileSync('python3',['-c',`
import json,zipfile,posixpath
from pathlib import Path
from xml.etree import ElementTree as E
out=[]
for file in Path('books/epub').glob('*.epub'):
 with zipfile.ZipFile(file) as z:
  container=E.fromstring(z.read('META-INF/container.xml'))
  package_path=next(e.get('full-path') for e in container.iter() if e.tag.endswith('rootfile'))
  folder=posixpath.dirname(package_path);package=E.fromstring(z.read(package_path));ns={'o':'http://www.idpf.org/2007/opf'}
  manifest={e.get('id'):e for e in package.find('o:manifest',ns)}
  sections=[{'href':manifest[e.get('idref')].get('href'),'url':'/'+posixpath.join(folder,manifest[e.get('idref')].get('href'))} for e in package.find('o:spine',ns)]
  links=[]
  for item in manifest.values():
   if item.get('media-type')!='application/xhtml+xml':continue
   path=posixpath.join(folder,item.get('href'))
   for a in E.fromstring(z.read(path)).iter():
    if a.tag.endswith('}a') and a.get('href') and not a.get('href').startswith(('http:','https:','mailto:')):links.append({'from':'/'+path,'href':a.get('href')})
  out.append({'file':str(file),'sections':sections,'links':links})
print(json.dumps(out))
`],{cwd:root,encoding:'utf8'}));
 assert.ok(fixtures.length>=2);
 for(const fixture of fixtures){
  assert.ok(fixture.links.length>0);
  for(const link of fixture.links)assert.ok(resolveChapterLink(link.href,link.from,fixture.sections,'https://mysticallegends.org'),fixture.file+': '+link.href);
 }
});

test('Contents link addresses reopen the reader on real domains and preserve the target section and fragment',()=>{
 for(const origin of ['https://mysticallegends.org','https://mysticallegends.pages.dev','http://localhost:8765']){
  const url=new URL(readerChapterURL('chapter-005.xhtml#h.scene','2',origin));
  assert.equal(url.origin,origin);assert.equal(url.pathname,'/books/reader.html');assert.equal(url.searchParams.get('id'),'2');assert.equal(url.searchParams.get('section'),'chapter-005.xhtml');assert.equal(url.hash,'#h.scene');
 }
 const encoded=new URL(readerChapterURL('Text/chapter 2.xhtml#scene-2','1','https://mysticallegends.org'));
 assert.equal(encoded.searchParams.get('section'),'Text/chapter 2.xhtml');
});
test('holding at an edge leaves native selection and the copy menu available',()=>{
 assert.equal(touchAction(1,1,350),null);assert.equal(touchAction(1,1,500),null);assert.equal(touchAction(1,1,650),null);
 assert.equal(touchAction(1,1,180),'tap');assert.equal(touchAction(0,0,900),null);
});
