import importlib.util, json, re, tempfile, unittest, zipfile
from pathlib import Path
from urllib.parse import unquote,urlsplit
from xml.etree import ElementTree as E
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_epub',ROOT/'books/epub/prepare-epub.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
X='{http://www.w3.org/1999/xhtml}';O='{http://www.idpf.org/2007/opf}'
class EpubTests(unittest.TestCase):
 def test_catalog_archives_contain_all_resources_and_contents(self):
  import posixpath
  catalog=json.loads((ROOT/'books/catalog.json').read_text())
  self.assertTrue(catalog)
  for volume in catalog.values():
   with self.subTest(book=volume['title']), zipfile.ZipFile(ROOT/volume['source'].lstrip('/')) as z:
    names=set(z.namelist())
    self.assertEqual(z.infolist()[0].filename,'mimetype');self.assertEqual(z.infolist()[0].compress_type,zipfile.ZIP_STORED)
    package=E.fromstring(z.read('GoogleDoc/package.opf'));manifest={e.get('id'):e.get('href') for e in package.find(O+'manifest')};spine=[manifest[e.get('idref')] for e in package.find(O+'spine')]
    self.assertGreater(len(spine),2)
    self.assertEqual(spine[1],'contents.xhtml')
    for href in manifest.values():self.assertIn('GoogleDoc/'+unquote(href),names)
    images=[]
    for href in [*spine,'nav.xhtml']:
     root=E.fromstring(z.read('GoogleDoc/'+unquote(href)))
     for el in root.iter():
      if el.tag==X+'img':
       src=el.get('src')
       images.append(src);self.assertIn('GoogleDoc/'+unquote(src),names)
      if el.tag==X+'a':
       url=urlsplit(el.get('href',''))
       if url.scheme or url.netloc or (not url.path and not url.fragment):continue
       target=posixpath.normpath('GoogleDoc/'+unquote(url.path or href));self.assertIn(target,names)
       if url.fragment:self.assertTrue(any(e.get('id')==unquote(url.fragment) for e in E.fromstring(z.read(target)).iter()),el.get('href'))
    self.assertTrue(images,'Expected illustrations in the packaged book')
    def entries(document):
     return [a.get('href') for a in E.fromstring(z.read('GoogleDoc/'+document)).findall('.//'+X+'a')]
    navigation=entries('nav.xhtml')
    contents=entries('contents.xhtml')
    self.assertEqual([unquote(urlsplit(href).path) for href in navigation], [unquote(href) for href in spine])
    self.assertEqual(contents,[href for href in navigation if href!='contents.xhtml'])
    css=z.read('GoogleDoc/reader.css').decode();self.assertNotIn('@import',css);self.assertIn('height:auto!important',css)
 def test_prepare_preserves_text_emphasis_alignment_images_and_link_targets(self):
  with tempfile.TemporaryDirectory() as td:
   temp=Path(td);source=temp/'test.epub'
   content={'mimetype':'application/epub+zip','META-INF/container.xml':'<container><rootfiles><rootfile full-path="Book/package.opf"/></rootfiles></container>','Book/package.opf':'<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><manifest><item id="nav" href="nav.xhtml" properties="nav"/><item id="main" href="main.xhtml"/></manifest><spine><itemref idref="main"/></spine></package>','Book/nav.xhtml':f'<html xmlns="{X[1:-1]}"><body><a href="main.xhtml#two">Chapter Two</a></body></html>','Book/main.xhtml':f'<html xmlns="{X[1:-1]}"><head><title>Test</title><style>.center{{text-align:center;font-size:12pt}}</style></head><body><p>Front matter</p><h1 id="one">One</h1><p class="center"><b>Bold</b> <i>italic</i> <a href="#two">Jump</a></p><span style="width:600px;height:900px"><img src="images/test.png" style="width:600px;height:900px"/></span><h2 id="two">Two</h2><p>  Indented text.</p><script>bad()</script></body></html>','Book/images/test.png':b'test-image'}
   with zipfile.ZipFile(source,'w') as z:
    for name,data in content.items():z.writestr(name,data)
   module.prepare(source,archive=temp/'single.epub');self.assertTrue((temp/'single.epub').is_file());self.assertTrue(module.is_adjusted(temp/'single.epub'));report=module.prepare(source,temp/'out',temp/'out.epub');self.assertEqual(len(report['chapters']),3);self.assertEqual(report['images'],1)
   chapters=[E.parse(temp/'out/Book'/c['file']).getroot() for c in report['chapters']];second=chapters[1];self.assertEqual(second.find('.//'+X+'b').text,'Bold');self.assertEqual(second.find('.//'+X+'i').text,'italic');self.assertEqual(second.find('.//'+X+'a').get('href'),'chapter-003.xhtml#two');self.assertEqual((temp/'out/Book/images/test.png').read_bytes(),b'test-image');self.assertIsNone(chapters[2].find('.//'+X+'script'));self.assertIn('text-align:center',(temp/'out/Book/reader.css').read_text());self.assertEqual(chapters[2].find('.//'+X+'p').text,'Indented text.')
 def test_scanner_skips_existing_books_and_preserves_invalid_files(self):
  import shutil
  with tempfile.TemporaryDirectory() as td:
   folder=Path(td);book=folder/'adjusted.epub';shutil.copy2(ROOT/'books/epub/vol-1.epub',book)
   before=book.read_bytes();self.assertEqual(module.scan_folder(folder),[]);self.assertEqual(book.read_bytes(),before)
   invalid=folder/'broken.epub';invalid.write_bytes(b'not an EPUB')
   with self.assertRaises(RuntimeError):module.scan_folder(folder)
   self.assertEqual(invalid.read_bytes(),b'not an EPUB');self.assertEqual(book.read_bytes(),before)
if __name__=='__main__':unittest.main()
