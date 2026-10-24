#!/usr/bin/env python3
"""Run this file in VS Code to adjust unprepared EPUBs in this folder.

No arguments are needed. Already adjusted EPUBs are skipped.
Normalize a Google Docs EPUB into local, chapter-sized reflowable content.
Usage: python3 books/epub/prepare-epub.py input.epub --archive books/epub/vol-1.epub
"""
import argparse, copy, hashlib, json, posixpath, re, shutil, zipfile, tempfile, os
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET
X='http://www.w3.org/1999/xhtml'; O='http://www.idpf.org/2007/opf'; DC='http://purl.org/dc/elements/1.1/'; EPUB='http://www.idpf.org/2007/ops'
ET.register_namespace('',X);ET.register_namespace('epub',EPUB)
def tag(el):return el.tag.rsplit('}',1)[-1]
def text(el):return ' '.join(''.join(el.itertext()).split())
def css_adjust(css):
 css=re.sub(r'@import\s+[^;]+;','',css)
 # Relative type sizes retain the author's hierarchy while allowing reader zoom.
 css=re.sub(r'font-size\s*:\s*([\d.]+)pt',lambda m:f'font-size:{float(m[1])/12:.5g}rem',css)
 css=re.sub(r'([\d.]+)pt',lambda m:f'{float(m[1])/12:.5g}rem',css)
 css=re.sub(r'(?:^|[;{])\s*(?:color|background-color|width|height|line-height|page-break-before|page-break-after)\s*:[^;}]*',lambda m:'{' if m[0].startswith('{') else ';',css)
 return css
BASE_CSS='''
@font-face{font-family:"Crimson Text";src:url("fonts/CrimsonText-Regular.ttf");font-style:normal;font-weight:400}
@font-face{font-family:"Crimson Text";src:url("fonts/CrimsonText-Italic.ttf");font-style:italic;font-weight:400}
@font-face{font-family:"Crimson Text";src:url("fonts/CrimsonText-Bold.ttf");font-style:normal;font-weight:700}
@font-face{font-family:"Crimson Text";src:url("fonts/CrimsonText-BoldItalic.ttf");font-style:italic;font-weight:700}
html{font-size:20px;background:transparent!important;color:var(--reader-ink,#332d28)!important}
body{margin:0!important;padding:24px 24px 64px!important;max-width:none!important;box-sizing:border-box;font-family:var(--reader-font,"Crimson Text",Georgia,serif)!important;line-height:var(--reader-leading,1.8)!important;overflow-wrap:break-word;background:transparent!important;color:inherit!important}
body *{box-sizing:border-box;color:inherit!important;font-family:inherit!important;line-height:inherit!important}
p{margin:0 0 .8em!important;padding-top:0!important;padding-bottom:0!important;font-size:1rem}
p.prose-indent{text-indent:1.35em!important}
h1,h2,h3,h4,h5,h6{line-height:1.3!important;margin:1.7em 0 1em!important;break-after:avoid;padding:0!important}
h1{font-size:1.6rem}h2{font-size:1.4rem}h3{font-size:1.2rem}h1 span,h2 span,h3 span{font-size:inherit!important}
li{font-size:1rem}ul,ol{padding-left:1.6em!important;max-width:100%}blockquote{margin:1em 1.5em}
a{color:var(--reader-link,#8c6027)!important;text-decoration:underline}
.reader-image{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;margin:1.4em auto!important;overflow:visible!important;text-indent:0!important;text-align:center}
.reader-image img{display:block!important;max-width:100%!important;width:auto!important;height:auto!important;max-height:80vh!important;margin:0 auto!important;object-fit:contain!important;transform:none!important}
.reader-table{max-width:100%;overflow-x:auto}table{max-width:100%;border-collapse:collapse}td,th{overflow-wrap:anywhere}
.reader-contents ol{list-style:none;padding:0!important;margin:1.5em 0}
.reader-contents li{list-style:none;margin:0 0 .65em;padding:0}
.reader-contents a{display:inline-block;text-decoration:none;border-bottom:1px solid currentColor;padding:.1em 0}
html[data-reader-mode=paginated] body{padding-top:16px!important;padding-bottom:16px!important}
html[data-reader-mode=paginated] .reader-image{break-inside:avoid;max-height:calc(100vh - 48px)!important;margin:12px auto!important}
html[data-reader-mode=paginated] .reader-image img{max-height:calc(100vh - 72px)!important}
@media(max-width:600px){body{padding:20px 18px 44px!important}}
'''
def prepare(source,output=None,archive=None):
 if output is None:
  if not archive:raise ValueError('Provide --archive for the single EPUB output.')
  with tempfile.TemporaryDirectory() as staging:return prepare(source,staging,archive)
 source=Path(source);output=Path(output);output.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(source) as z:
  # Read only safe relative paths, never extract traversal entries or execute content.
  files={n:z.read(n) for n in z.namelist() if not n.endswith('/') and not PurePosixPath(n).is_absolute() and '..' not in PurePosixPath(n).parts}
 container=ET.fromstring(files['META-INF/container.xml']);opf_path=next(e.attrib['full-path'] for e in container.iter() if tag(e)=='rootfile');folder=posixpath.dirname(opf_path);package=ET.fromstring(files[opf_path]);manifest=package.find('{'+O+'}manifest');spine=package.find('{'+O+'}spine');items={e.attrib['id']:e for e in manifest};nav_item=next(e for e in manifest if 'nav' in e.get('properties','').split());nav_path=posixpath.normpath(posixpath.join(folder,nav_item.get('href')))
 nav=ET.fromstring(files[nav_path]);nav_labels={unquote(a.get('href','').split('#')[-1]):text(a) for a in nav.iter() if tag(a)=='a' and '#' in a.get('href','')}
 chunks=[];styles=[];old_documents=set();image_count=0
 for ref in list(spine):
  item=items[ref.get('idref')];path=posixpath.normpath(posixpath.join(folder,item.get('href')));root=ET.fromstring(files[path]);old_documents.add(path);body=root.find('{'+X+'}body');head=root.find('{'+X+'}head')
  styles.extend(css_adjust(e.text or '') for e in head if tag(e)=='style')
  for link in head:
   if tag(link)=='link' and link.get('rel')=='stylesheet':
    css_path=posixpath.normpath(posixpath.join(posixpath.dirname(path),link.get('href','')))
    if css_path in files:styles.append(css_adjust(files[css_path].decode()))
  group={'title':'Title page' if not chunks else text(head.find('{'+X+'}title')) or 'Section','nodes':[],'source':path}
  for node in list(body):
   if tag(node) in {'h1','h2'} and text(node):
    if group['nodes']:chunks.append(group)
    group={'title':nav_labels.get(node.get('id'),text(node)),'nodes':[],'source':path}
   if tag(node)=='hr' and 'page-break' in node.get('style',''):continue
   if tag(node) in {'p','h1','h2','h3'} and not text(node) and not any(tag(e)=='img' for e in node.iter()):continue
   group['nodes'].append(copy.deepcopy(node))
  if group['nodes']:chunks.append(group)
 if not chunks:raise ValueError('No readable content in EPUB spine')
 # Google Docs often exports the Contents heading without its generated links.
 for index,chunk in enumerate(chunks):
  placeholder=next((node for node in chunk['nodes'] if tag(node)=='p' and text(node).lower()=='contents'),None)
  if placeholder is not None:
   chunk['nodes'].remove(placeholder)
   heading=ET.Element('{'+X+'}h1',{'id':'reader-contents'});heading.text='Contents'
   chunks.insert(index+1,{'title':'Contents','source':chunk['source'],'nodes':[heading],'generated_contents':True})
   break
 ids={};source_first={};number=0
 for chunk in chunks:
  if chunk.get('generated_contents'):chunk['file']='contents.xhtml'
  else:number+=1;chunk['file']=f'chapter-{number:03}.xhtml'
  source_first.setdefault(chunk['source'],chunk['file'])
  for node in chunk['nodes']:
   for e in node.iter():
    if e.get('id'):ids[(chunk['source'],e.get('id'))]=chunk['file']
 for chunk in chunks:
  if chunk.get('generated_contents'):
   contents=ET.Element('{'+X+'}nav',{'class':'reader-contents','{'+EPUB+'}type':'toc','aria-label':'Table of contents'})
   links=ET.SubElement(contents,'{'+X+'}ol')
   for target in chunks:
    if target is chunk:continue
    ET.SubElement(ET.SubElement(links,'{'+X+'}li'),'{'+X+'}a',{'href':target['file']}).text=target['title']
   chunk['nodes'].append(contents)
  html=ET.Element('{'+X+'}html',{'lang':'en'});head=ET.SubElement(html,'{'+X+'}head');ET.SubElement(head,'{'+X+'}meta',{'charset':'utf-8'});ET.SubElement(head,'{'+X+'}title').text=chunk['title'];ET.SubElement(head,'{'+X+'}link',{'rel':'stylesheet','href':'reader.css'});body=ET.SubElement(html,'{'+X+'}body')
  for node in chunk['nodes']:body.append(node)
  for parent in list(body.iter()):
   for e in list(parent):
    if tag(e) in {'script','iframe','object','embed'}:parent.remove(e)
  for e in body.iter():
   for key in list(e.attrib):
    if key.lower().startswith('on'):del e.attrib[key]
   style=e.get('style','')
   if tag(e)=='img':
    image_count+=1;src=e.get('src','');resolved=posixpath.normpath(posixpath.join(posixpath.dirname(chunk['source']),unquote(src)))
    if resolved not in files:raise ValueError(f'Missing embedded image: {src}')
    e.set('src',posixpath.relpath(resolved,folder));e.set('alt',e.get('alt') or f'{chunk["title"]} — illustration');e.set('style','');e.attrib.pop('width',None);e.attrib.pop('height',None)
   elif any(tag(c)=='img' for c in e):e.set('class',e.get('class','')+' reader-image');e.set('style','')
   elif style:e.set('style',css_adjust('{'+style+'}')[1:-1])
   if tag(e)=='p':
    first=next((c for c in e.iter() if c.text and c.text.strip()),None)
    if first is not None and re.match(r'^[ \u00a0]{2,}',first.text):
     first.text=first.text.lstrip(' \u00a0');e.set('class',e.get('class','')+' prose-indent')
   if tag(e)=='a':
    href=e.get('href','');parsed=urlsplit(href)
    if parsed.scheme and parsed.scheme not in {'https','http','mailto'}:e.attrib.pop('href',None);continue
    if parsed.scheme: e.set('rel','noopener noreferrer');continue
    target=posixpath.normpath(posixpath.join(posixpath.dirname(chunk['source']),unquote(parsed.path))) if parsed.path else chunk['source'];fragment=unquote(parsed.fragment)
    if target in old_documents:e.set('href',ids.get((target,fragment),source_first[target])+('#'+fragment if fragment else ''))
  files[posixpath.join(folder,chunk['file'])]=ET.tostring(html,encoding='utf-8',xml_declaration=True)
 # Replace the monolithic spine, preserving metadata and image resources.
 for e in list(manifest):
  target=posixpath.normpath(posixpath.join(folder,e.get('href','')))
  if target in old_documents:manifest.remove(e);files.pop(target,None)
 for ref in list(spine):spine.remove(ref)
 for i,chunk in enumerate(chunks):
  ident=f'reader-chapter-{i+1}';ET.SubElement(manifest,'{'+O+'}item',{'id':ident,'href':chunk['file'],'media-type':'application/xhtml+xml'});ET.SubElement(spine,'{'+O+'}itemref',{'idref':ident})
 fonts=Path(__file__).resolve().parents[2]/'books/fonts'
 for p in fonts.glob('*.ttf'):
  files[posixpath.join(folder,'fonts',p.name)]=p.read_bytes();ET.SubElement(manifest,'{'+O+'}item',{'id':'font-'+p.stem,'href':'fonts/'+p.name,'media-type':'font/ttf'})
 files[posixpath.join(folder,'fonts/OFL.txt')]=(fonts/'OFL-CrimsonText.txt').read_bytes()
 ET.SubElement(manifest,'{'+O+'}item',{'id':'font-license','href':'fonts/OFL.txt','media-type':'text/plain'})
 files[posixpath.join(folder,'reader.css')]=('\n'.join(styles)+'\n'+BASE_CSS).encode();ET.SubElement(manifest,'{'+O+'}item',{'id':'reader-css','href':'reader.css','media-type':'text/css'})
 nav_html=ET.Element('{'+X+'}html',{'lang':'en'});nh=ET.SubElement(nav_html,'{'+X+'}head');ET.SubElement(nh,'{'+X+'}title').text='Contents';nb=ET.SubElement(nav_html,'{'+X+'}body');nn=ET.SubElement(nb,'{'+X+'}nav',{'{'+EPUB+'}type':'toc'});ol=ET.SubElement(nn,'{'+X+'}ol')
 for chunk in chunks:ET.SubElement(ET.SubElement(ol,'{'+X+'}li'),'{'+X+'}a',{'href':chunk['file']}).text=chunk['title']
 files[nav_path]=ET.tostring(nav_html,encoding='utf-8',xml_declaration=True);files[opf_path]=ET.tostring(package,encoding='utf-8',xml_declaration=True)
 files['META-INF/ml-reader.json']=json.dumps({'version':1}).encode()
 # Writing known outputs only leaves user files in the output folder untouched.
 for name,content in files.items():
  target=output/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content)
 report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'chapters':[{k:c[k] for k in ['file','title']} for c in chunks],'images':image_count,'package':opf_path,'source':source.name}
 (output/'preparation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 if archive:
  archive=Path(archive);archive.parent.mkdir(parents=True,exist_ok=True)
  with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
   z.writestr('mimetype',b'application/epub+zip',compress_type=zipfile.ZIP_STORED)
   for name,content in files.items():
    if name!='mimetype':z.writestr(name,content)
 print(f'Prepared {len(chunks)} reading sections and {image_count} images in {output}')
 return report
def is_adjusted(source):
 with zipfile.ZipFile(source) as z:
  if 'META-INF/ml-reader.json' in z.namelist():
   return json.loads(z.read('META-INF/ml-reader.json')).get('version')==1
  # Recognize volumes prepared before the explicit version marker existed.
  container=ET.fromstring(z.read('META-INF/container.xml'))
  package_path=next(e.get('full-path') for e in container.iter() if tag(e)=='rootfile')
  package=ET.fromstring(z.read(package_path));manifest=package.find('{'+O+'}manifest');spine=package.find('{'+O+'}spine')
  return any(e.get('id')=='reader-css' for e in manifest) and bool(len(spine)) and all(e.get('idref','').startswith('reader-chapter-') for e in spine)

def scan_folder(folder=None):
 repo=Path(__file__).resolve().parents[2];folder=Path(folder) if folder else repo/'books/epub'
 folder.mkdir(parents=True,exist_ok=True);changed=[];failures=[]
 for source in sorted(folder.rglob('*')):
  if not source.is_file() or source.suffix.lower()!='.epub':continue
  try:
   if is_adjusted(source):
    print(f'Already adjusted: {source.name}');continue
   # Build and validate beside the original, then replace only after success.
   with tempfile.TemporaryDirectory(prefix='.epub-adjust-',dir=source.parent) as staging:
    target=Path(staging)/'prepared.epub';prepare(source,archive=target)
    with zipfile.ZipFile(target) as z:
     if z.testzip():raise ValueError('Prepared EPUB failed ZIP integrity validation')
    if not is_adjusted(target):raise ValueError('Prepared EPUB marker is missing')
    os.chmod(target,source.stat().st_mode);os.replace(target,source)
   changed.append(source);print(f'Adjusted: {source.name}')
  except Exception as error:
   failures.append(str(source));print(f'ERROR {source.name}: {error}; original file retained')
 if failures:raise RuntimeError(f'{len(failures)} EPUB file(s) could not be adjusted')
 print(f'Adjusted {len(changed)} new EPUB(s).')
 return changed

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('input',nargs='?');p.add_argument('--scan',action='store_true',help='Adjust all unprepared EPUBs in books/epub in place');p.add_argument('--output',help='Optional extracted debugging output; normally omit this');p.add_argument('--archive',help='Single prepared EPUB output');p.add_argument('--id',help='Register this volume in the website catalog');p.add_argument('--title',help='Book title, required with --id');p.add_argument('--label',help='Series and volume label')
 args=p.parse_args()
 if args.scan or not args.input:
  scan_folder();raise SystemExit(0)
 repo=Path(__file__).resolve().parents[2]
 if args.id and (not args.id.isdecimal() or not args.title):p.error('--id must be numeric and requires --title')
 archive=args.archive or (repo/'books/epub'/f'vol-{args.id}.epub' if args.id else None)
 if not archive and not args.output:p.error('Provide --archive or --id')
 if args.id:
  try:relative=Path(archive).resolve().relative_to(repo)
  except ValueError:p.error('Registered EPUB output must be inside the website folder')
 prepare(args.input,args.output,archive)
 if args.id:
  catalog_path=repo/'books/catalog.json';catalog=json.loads(catalog_path.read_text()) if catalog_path.exists() else {}
  catalog[args.id]={'title':args.title,'label':args.label or f'Mystical Legends · Volume {args.id}','source':'/'+relative.as_posix()}
  catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
  print(f'Registered /books/reader.html?id={args.id}; run python3 scripts/build-site-index.py after updating the book listing.')
