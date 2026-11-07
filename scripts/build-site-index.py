#!/usr/bin/env python3
"""Build spoiler-safe search and character indexes from local website content."""
from pathlib import Path
import argparse, html, json, re
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def strip_templates(text):
 out=[];depth=0;i=0
 while i<len(text):
  pair=text[i:i+2]
  if pair=='{{':depth+=1;i+=2
  elif pair=='}}' and depth:depth-=1;i+=2
  else:
   if not depth:out.append(text[i])
   i+=1
 return ''.join(out)
def plain(text):
 text=re.sub(r'\[\[(?:Category|File):[^\]]*\]\]','',text,flags=re.I)
 text=re.sub(r'\[\[([^\]]+)\]\]',lambda m:m[1].split('|')[-1].removeprefix('fandom:'),text)
 text=re.sub(r'\[https?://\S+\s+([^\]]+)\]',r'\1',text)
 text=re.sub(r'<[^>]*>',' ',text)
 return re.sub(r'\s+',' ',html.unescape(text).replace("'''",'').replace("''",'')).strip()
def summary(source):
 body=strip_templates(source)
 for part in re.split(r'\n\s*\n',body):
  lines=[l for l in part.splitlines() if l.strip() and not re.match(r'\s*(?:=|\||[*#])',l)]
  value=plain(' '.join(lines))
  if value:return value[:280]
 return ''
def text_values(value):
 if isinstance(value,str):yield value
 elif isinstance(value,dict):
  for k,v in value.items():
   if k not in ['style','base_damage']:yield from text_values(v)
 elif isinstance(value,list):
  for v in value:yield from text_values(v)
def nickname_text(text,roster,cid,variant=None,damage=None):
 def replace(m):
  kind,target,index=m.groups();entry=roster.get(target or cid,{})
  if index is not None:entry=(entry.get('skill_variants')or[])[int(index)]
  elif not target and variant is not None:entry=variant
  if kind.lower()=='nickname':return entry.get('nickname') or entry.get('name','Character').split(' ')[0]
  sets={'male':{'subject':'he','object':'him','possessive':'his','possessive_pronoun':'his','reflexive':'himself'},'female':{'subject':'she','object':'her','possessive':'her','possessive_pronoun':'hers','reflexive':'herself'},'neutral':{'subject':'they','object':'them','possessive':'their','possessive_pronoun':'theirs','reflexive':'themself'}}
  value=sets.get(entry.get('gender','neutral'),sets['neutral']).get(kind.lower(),'')
  return value.capitalize() if kind[0].isupper() else value
 text=re.sub(r'<span\b[^>]*data-dmg=["\']([^"\']+)["\'][^>]*>[^<]*</span>',lambda m:str((damage or {}).get(m[1],'')),text)
 return re.sub(r'\{\{(nickname|[Ss]ubject|[Oo]bject|[Pp]ossessive_pronoun|[Pp]ossessive|[Rr]eflexive)(?::(c\d+[a-z]?)(?::(\d+))?)?\}\}',replace,text)
def build():
 roster=read('images/mlg-assets/data-character.json');effects=read('images/mlg-assets/data-effects.json');wiki=[];profiles=[];records=[]
 for path in sorted((ROOT/'wiki').rglob('*.html')):
  document=path.read_text();match=re.search(r'<script\b[^>]*type=["\']text/x-wiki["\'][^>]*>([\s\S]*?)</script>',document,re.I)
  if not match:continue
  source=match[1];safe=strip_templates(source);title=re.search(r'^\|title=([^\n]+)',source,re.M)
  title=title[1].strip() if title else path.stem.replace('_',' ').title();url='/'+str(path.relative_to(ROOT));description=summary(source)
  row={'type':'Wiki','title':title,'path':url,'description':description,'search':title+' '+path.stem.replace('_',' ')};wiki.append(row);records.append(row)
  if path.parent.name=='char':
   relations=list(dict.fromkeys(re.findall(r'\[\[(?:char/)?([a-z_]+)(?:\|[^\]]*)?\]\]',safe)))
   first=re.search(r'^\|(?:First Appearance|First appearance|Debut)=([^\n]+)',source,re.M)
   profiles.append({'title':title,'path':url,'slug':path.stem,'connections':relations,'appearance':plain(strip_templates(first[1])) if first else ''})
 def game_url(cid):return '/webpages/game-c.html?char=c1#b' if cid=='c1b' else '/webpages/game-c.html?char='+cid
 for cid,c in roster.items():
  if cid.startswith('#'):continue
  name=re.sub(r'\s*\(Alter\)$','',c['name']);profile=next((p for p in profiles if p['title'].lower()==name.lower()),None)
  if profile:profile.setdefault('gameIds',[]).append(cid)
  records.append({'type':'Character','title':c['name'],'path':game_url(cid),'description':' · '.join([c.get('rarity',''),', '.join(c.get('role',[])),', '.join(c.get('affinity',[]))]),'search':c['name']+' '+c.get('nickname','')+' '+' '.join(c.get('species',[])+c.get('role',[])+c.get('affinity',[]))})
  source=c.get('base_character',cid);file=ROOT/f'images/mlg-assets/Characters/{source.upper()}/{source}.json'
  if not file.exists():continue
  definitions=json.loads(file.read_text());keys=c.get('skills',roster.get(source,{}).get('skills',[]));keys=list(keys)
  for variant_index,v in enumerate(c.get('skill_variants',[])):
   keys.extend(v.get('skill_overrides',{}).values())
  for key in dict.fromkeys(keys):
   skill=next((s for k,s in definitions.items() if k.lower()==key.lower()),None)
   if not skill:continue
   variant=None;variant_index=0
   for vi,v in enumerate(c.get('skill_variants',[])):
    if key in v.get('skill_overrides',{}).values():variant=v;variant_index=vi;break
   title=plain(nickname_text(skill.get('name',key),roster,cid,variant));description=plain(strip_templates(nickname_text(skill.get('description',''),roster,cid,variant,skill.get('base_damage',{}))))
   from urllib.parse import urlencode
   url='/webpages/apps/skill.html?'+urlencode({'char':source,'form':cid,'skill':key,'variant':variant_index,'id':5 if key.lower().startswith('dupes') else 1})
   records.append({'type':'Skill','title':title+' — '+(variant.get('name') if variant else c['name']),'path':url,'description':description[:230],'search':title+' '+c['name']+' '+key+' '+description})
 for eid,e in effects.items():
  description=plain(strip_templates(' '.join(v for k,v in e.items() if re.fullmatch(r'description\d*',k) and isinstance(v,str))))[:230]
  records.append({'type':'Effect','title':e.get('name',eid),'path':'/webpages/game-codex.html#'+eid,'description':description,'search':e.get('name',eid)+' '+eid+' '+e.get('type','')+' '+description})
 for filename,kind,anchor in [('data-weapon.json','Weapon','weapon'),('data-accessory.json','Accessory','accessory'),('data-artifact.json','Artifact','artifact')]:
  for eid,item in read('images/mlg-assets/'+filename).items():
   bonus_text=[p for bonus in item.get('set_bonuses',[]) for p in bonus.get('description',[])]
   prose=' '.join(bonus_text+[p for section in item.get('reference_sections',[]) if not (bonus_text and re.fullmatch(r'\d+-Piece Bonus',section.get('title',''))) for p in section.get('paragraphs',[])])
   prose=re.sub(r'\{\{effect:([^}]+)\}\}',lambda m:' '.join([effects.get(m[1],{}).get('name',m[1])]+[v for k,v in effects.get(m[1],{}).items() if re.fullmatch(r'description\d*',k) and isinstance(v,str)]),prose)
   pieces=' '.join(item.get(f'piece_num_{n}_name','') for n in range(1,5))
   records.append({'type':kind,'title':item['name'],'path':'/webpages/game-codex.html#'+anchor+'-'+eid,'description':plain(prose)[:230], 'search':' '.join([item['name'],item.get('previous_name',''),item.get('weapon_type',''),item.get('seal_ring_name',''),pieces,plain(prose)])})
 document=(ROOT/'books_main.html').read_text();books=[]
 for item in re.findall(r'<article\b[^>]*id="book\d+"[\s\S]*?</article>',document):
  id=re.search(r'id="book(\d+)"',item)[1];title=plain(re.search(r'<h2>([\s\S]*?)</h2>',item)[1]);paragraph=re.search(r'<p>([\s\S]*?)</p>',item);volume=json.loads((ROOT/'books/catalog.json').read_text()).get(id);available=bool(volume and (ROOT/volume['source'].lstrip('/')).is_file())
  book={'id':id,'title':title,'available':available,'path':('/books/reader.html?id='+id) if available else '/books_main.html#book'+id};books.append(book)
  records.append({'type':'Book','title':'Volume '+id+': '+title,'path':book['path'],'description':plain(paragraph[1]) if paragraph else '', 'search':title+' volume '+id})
 return {'data/search-index.json':{'version':1,'records':records},'data/wiki-search-index.json':{'version':1,'pages':wiki},'data/character-connections.json':{'profiles':profiles},'data/books.json':{'books':books}}
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();stale=[]
 for filename,data in build().items():
  text=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n';path=ROOT/filename
  if args.check:
   if not path.exists() or path.read_text()!=text:stale.append(filename)
  else:path.parent.mkdir(exist_ok=True);path.write_text(text);print(filename,len(text.encode()),'bytes')
 if stale:print('Stale indexes: '+', '.join(stale));raise SystemExit(1)
 if args.check:print('Generated indexes are current.')
if __name__=='__main__':main()
