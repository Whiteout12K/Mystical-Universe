import importlib.util, json, re, tempfile, unittest, zipfile
from pathlib import Path
from urllib.parse import unquote,urlsplit
from xml.etree import ElementTree as E
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_epub',ROOT/'books/epub/prepare-epub.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
X='{http://www.w3.org/1999/xhtml}';O='{http://www.idpf.org/2007/opf}';EPUB='{http://www.idpf.org/2007/ops}'
class EpubTests(unittest.TestCase):
 def test_catalog_archives_contain_all_resources_and_contents(self):
  import posixpath
  catalog=json.loads((ROOT/'books/catalog.json').read_text())
  self.assertTrue(catalog)
  for volume in catalog.values():
   with self.subTest(book=volume['title']), zipfile.ZipFile(ROOT/volume['source'].lstrip('/')) as z:
    names=set(z.namelist())
    self.assertEqual(z.infolist()[0].filename,'mimetype');self.assertEqual(z.infolist()[0].compress_type,zipfile.ZIP_STORED)
    container=E.fromstring(z.read('META-INF/container.xml'))
    package_path=next(e.get('full-path') for e in container.iter() if e.tag.rsplit('}',1)[-1]=='rootfile')
    folder=posixpath.dirname(package_path)
    package=E.fromstring(z.read(package_path))
    manifest={e.get('id'):e for e in package.find(O+'manifest')}
    def archive_path(document,href):
     return posixpath.normpath(posixpath.join(posixpath.dirname(document),unquote(href)))
    spine=[archive_path(package_path,manifest[e.get('idref')].get('href')) for e in package.find(O+'spine')]
    self.assertTrue(spine)
    nav_path=archive_path(package_path,next(e.get('href') for e in manifest.values() if 'nav' in e.get('properties','').split()))
    for item in manifest.values():self.assertIn(archive_path(package_path,item.get('href')),names)
    navigation=[]
    contents={}
    for document in dict.fromkeys([*spine,nav_path]):
     root=E.fromstring(z.read(document))
     def internal_target(href):
      url=urlsplit(href)
      if url.scheme or url.netloc or (not url.path and not url.fragment):return None
      return (archive_path(document,url.path) if url.path else document,unquote(url.fragment))
     for el in root.iter():
      if el.tag==X+'img':
       self.assertIn(archive_path(document,el.get('src')),names)
      if el.tag==X+'a' and (target:=internal_target(el.get('href',''))):
       path,fragment=target
       self.assertIn(path,names)
       if fragment:self.assertTrue(any(e.get('id')==fragment for e in E.fromstring(z.read(path)).iter()),el.get('href'))
      if el.tag==X+'nav' and 'toc' in el.get(EPUB+'type','').split():
       entries=[internal_target(a.get('href','')) for a in el.iter(X+'a')]
       self.assertTrue(entries)
       self.assertTrue(all(entries),'Contents entries must navigate within the book')
       if document==nav_path:navigation=entries
       else:contents[document]=entries
    # Multiple entries may point at headings in the same spine document.
    self.assertEqual(list(dict.fromkeys(path for path,_ in navigation)),spine)
    for document,entries in contents.items():
     self.assertEqual(entries,[entry for entry in navigation if entry[0]!=document])
 def test_prepare_preserves_text_emphasis_alignment_images_and_link_targets(self):
  with tempfile.TemporaryDirectory() as td:
   temp=Path(td);source=temp/'test.epub'
   content={'mimetype':'application/epub+zip','META-INF/container.xml':'<container><rootfiles><rootfile full-path="Book/package.opf"/></rootfiles></container>','Book/package.opf':'<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><manifest><item id="nav" href="nav.xhtml" properties="nav"/><item id="main" href="main.xhtml"/></manifest><spine><itemref idref="main"/></spine></package>','Book/nav.xhtml':f'<html xmlns="{X[1:-1]}"><body><a href="main.xhtml#two">Chapter Two</a></body></html>','Book/main.xhtml':f'<html xmlns="{X[1:-1]}"><head><title>Test</title><style>.center{{text-align:center;font-size:12pt}}</style></head><body><p>Front matter</p><h1 id="one">One</h1><p class="center"><b>Bold</b> <i>italic</i> <a href="#two">Jump</a></p><span style="width:600px;height:900px"><img src="images/test.png" style="width:600px;height:900px"/></span><h2 id="two">Two</h2><p>  Indented text.</p><h2 id="extra">New interlude</h2><p>Added later.</p><script>bad()</script></body></html>','Book/images/test.png':b'test-image'}
   with zipfile.ZipFile(source,'w') as z:
    for name,data in content.items():z.writestr(name,data)
   module.prepare(source,archive=temp/'single.epub');self.assertTrue((temp/'single.epub').is_file());self.assertTrue(module.is_adjusted(temp/'single.epub'));report=module.prepare(source,temp/'out',temp/'out.epub');self.assertEqual(len(report['chapters']),4);self.assertEqual(report['images'],1)
   chapters=[E.parse(temp/'out/Book'/c['file']).getroot() for c in report['chapters']];second=chapters[1];self.assertEqual(second.find('.//'+X+'b').text,'Bold');self.assertEqual(second.find('.//'+X+'i').text,'italic');self.assertEqual(second.find('.//'+X+'a').get('href'),'chapter-003.xhtml#two');self.assertEqual((temp/'out/Book/images/test.png').read_bytes(),b'test-image');self.assertIsNone(chapters[3].find('.//'+X+'script'));self.assertIn('text-align:center',(temp/'out/Book/reader.css').read_text());self.assertEqual(chapters[2].find('.//'+X+'p').text,'Indented text.')
   navigation=E.parse(temp/'out/Book/nav.xhtml').getroot().findall('.//'+X+'a')
   self.assertEqual([a.get('href') for a in navigation],[c['file'] for c in report['chapters']])
   self.assertEqual(navigation[-1].text,'New interlude')
 def test_scanner_skips_existing_books_and_preserves_invalid_files(self):
  import shutil
  with tempfile.TemporaryDirectory() as td:
   folder=Path(td);book=folder/'adjusted.epub';shutil.copy2(ROOT/'books/epub/vol-1.epub',book)
   before=book.read_bytes();self.assertEqual(module.scan_folder(folder),[]);self.assertEqual(book.read_bytes(),before)
   invalid=folder/'broken.epub';invalid.write_bytes(b'not an EPUB')
   with self.assertRaises(RuntimeError):module.scan_folder(folder)
   self.assertEqual(invalid.read_bytes(),b'not an EPUB');self.assertEqual(book.read_bytes(),before)
if __name__=='__main__':unittest.main()
