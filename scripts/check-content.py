#!/usr/bin/env python3
"""Check character data, skill/effect references, assets, links, and generated indexes."""
import argparse, importlib.util, json, re, sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote, urljoin
ROOT=Path(__file__).resolve().parents[1]
BASELINE=ROOT/'data/content-check-baseline.json'
def audit():
 issues=set()
 def report(path,kind,message):issues.add(str(path.relative_to(ROOT))+': '+kind+': '+message)
 def read(path):
  try:return json.loads(path.read_text())
  except Exception as error:report(path,'invalid JSON',str(error));return {}
 def strings(value):
  if isinstance(value,str):yield value
  elif isinstance(value,dict):
   for item in value.values():yield from strings(item)
  elif isinstance(value,list):
   for item in value:yield from strings(item)
 def exists(url,source):
  path=unquote(urlsplit(urljoin('https://local/'+str(source.relative_to(ROOT)),url)).path)
  if not path:return True
  if path.startswith('/api/') or path.startswith('/view/') or path in ['/login','/create-user']:return True
  target=ROOT/path.lstrip('/') if path.startswith('/') else source.parent/path
  return target.exists() or target.with_suffix('.html').is_file() or (target/'index.html').is_file()
 roster_path=ROOT/'images/mlg-assets/data-character.json';roster=read(roster_path);effects=read(ROOT/'images/mlg-assets/data-effects.json')
 catalogue_path=ROOT/'images/mlg-assets/account-styles.json'
 if catalogue_path.exists():
  catalogue=read(catalogue_path)
  for group in ['avatar','background']:
   for key,asset in catalogue.get(group,{}).items():
    if not isinstance(asset,str):report(catalogue_path,'invalid style asset',group+'/'+key)
    elif asset and not exists(asset,catalogue_path):report(catalogue_path,'missing style asset',asset)
    if key.startswith('img_') and not catalogue.get('labels',{}).get(group,{}).get(key):report(catalogue_path,'missing style label',group+'/'+key)

 definitions={}
 for path in (ROOT/'images/mlg-assets/Characters').glob('*/c*.json'):
  definitions[path.stem]=read(path)
  for skill,value in definitions[path.stem].items():
   for text in strings(value):
    for token in re.findall(r'\{\{([^{}]+)\}\}',text):
     if token.startswith('effect:'):
      if token[7:] not in effects:report(path,'missing effect',token[7:])
     else:
      match=re.fullmatch(r'(?:nickname|[Ss]ubject|[Oo]bject|[Pp]ossessive_pronoun|[Pp]ossessive|[Rr]eflexive)(?::(c\d+[a-z]?)(?::(\d+))?)?',token)
      if not match:report(path,'unknown placeholder',token)
      elif match[1] and match[1] not in roster:report(path,'missing placeholder character',match[1])
      elif match[2] and int(match[2])>=len(roster[match[1]].get('skill_variants',[])):report(path,'missing placeholder variant',token)
    for damage in re.findall(r'data-dmg=["\']([^"\']+)',text):
     if damage not in value.get('base_damage',{}):report(path,'missing damage value',skill+'/'+damage)
 for cid,c in roster.items():
  if not c.get('nickname'):report(roster_path,'missing nickname',cid)
  if c.get('gender') not in ['male','female','neutral']:report(roster_path,'unsupported gender',cid)
  base=c.get('base_character',cid)
  if c.get('base_character') and base not in roster:report(roster_path,'missing base character',cid+' → '+base)
  skills=c.get('skills',roster.get(base,{}).get('skills',[]));extra=c.get('additional_skills',[]);keys=list(skills)+list(extra)
  for variant in c.get('skill_variants',[]):
   if not variant.get('nickname') or variant.get('gender') not in ['male','female','neutral']:report(roster_path,'variant metadata',cid+'/'+variant.get('name','?'))
   keys.extend(variant.get('skill_overrides',{}).values())
  available={key.lower() for key in definitions.get(base,{})}
  overrides={k for v in c.get('skill_variants',[]) for k in v.get('skill_overrides',{})}
  for key in keys:
   if key.lower() not in available and key not in overrides:report(roster_path,'missing skill',cid+'/'+key+' in '+base+'.json')
  for text in strings(c):
   if text.startswith('/images/') and not exists(text,roster_path):report(roster_path,'missing asset',text)
 for eid,effect in effects.items():
  icon=effect.get('icon')
  if icon and not exists(icon,ROOT/'images/mlg-assets/data-effects.json'):report(ROOT/'images/mlg-assets/data-effects.json','missing icon',icon)
  for text in strings(effect):
   for target in re.findall(r'\{\{effect:([^}]+)\}\}',text):
    if target not in effects:report(ROOT/'images/mlg-assets/data-effects.json','missing effect',target)
 class Links(HTMLParser):
  def __init__(self,path):super().__init__();self.path=path
  def handle_starttag(self,tag,attrs):
   for key,value in attrs:
    if key not in ['src','href'] or not value or value.startswith(('#','http:','https:','mailto:','tel:','data:','javascript:','//')):continue
    if any(token in value for token in ['${','{{','<%']):continue
    if not exists(value,self.path):report(self.path,'broken '+key,value)
 for path in ROOT.rglob('*.html'):
  if any(part in ['.git','.wrangler','node_modules','pdfjs'] for part in path.parts):continue
  try:Links(path).feed(path.read_text())
  except UnicodeDecodeError:continue
 return sorted(issues)
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--baseline',action='store_true',help='Record known issues; review the report before accepting new issues.');parser.add_argument('--strict',action='store_true',help='Fail for all known issues as well as new ones.');args=parser.parse_args()
 flags=json.loads((ROOT/'data/site-features.json').read_text())
 if not flags.get('contentChecks',True) and not args.baseline:print('Content checks disabled in site-features.json.');return
 issues=audit();known=set(json.loads(BASELINE.read_text()).get('known_issues',[])) if BASELINE.exists() else set()
 if args.baseline:BASELINE.write_text(json.dumps({'known_issues':issues},ensure_ascii=False,indent=2)+'\n');known=set(issues)
 new=issues if args.strict else [issue for issue in issues if issue not in known]
 fixed=known-set(issues)
 print(f'{len(issues)} existing issues; {len(new)} '+('total failures' if args.strict else 'new failures')+f'; {len(fixed)} baseline issues now resolved.')
 for issue in new:print('ERROR '+issue)
 if args.baseline:
  report=ROOT/'CONTENT-AUDIT.md';report.write_text('# Existing content issues\n\nThese issues were already present when the website improvements were added. No missing story or skill content has been invented. New issues fail the default check; `--strict` also fails for these known issues.\n\n'+''.join('- '+issue+'\n' for issue in issues))
 spec=importlib.util.spec_from_file_location('site_index',ROOT/'scripts/build-site-index.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 stale=[]
 for filename,data in module.build().items():
  expected=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n';path=ROOT/filename
  if not path.exists() or path.read_text()!=expected:stale.append(filename)
 if stale:print('ERROR Stale indexes: '+', '.join(stale)+'; run python3 scripts/build-site-index.py')
 if new or stale:raise SystemExit(1)
 print('Content checks passed (known issues are recorded in CONTENT-AUDIT.md).')
if __name__=='__main__':main()
