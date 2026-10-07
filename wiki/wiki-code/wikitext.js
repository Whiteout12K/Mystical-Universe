/* Shared wiki layout and text renderer. Article content stays in its HTML text block. */
(() => {
  'use strict';
  const source = document.querySelector('script[type="text/x-wiki"]');
  if (!source) return;
  const make = (tag, cls='', text) => {const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const safe = value => {try {const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const escape = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  // Split template parameters only at their own depth, preserving nested links/templates.
  function split(text) {
    const out=[];let start=0,links=0,templates=0;
    for(let i=0;i<text.length;i++){
      const pair=text.slice(i,i+2);
      if(pair==='[['){links++;i++;}else if(pair===']]'){links--;i++;}
      else if(pair==='{{'){templates++;i++;}else if(pair==='}}'){templates--;i++;}
      else if(text[i]==='|'&&!links&&!templates){out.push(text.slice(start,i).trim());start=i+1;}
    }out.push(text.slice(start).trim());return out;
  }
  function templates(text) {
    const out=[];let depth=0,start=0;
    for(let i=0;i<text.length-1;i++){
      const pair=text.slice(i,i+2);
      if(pair==='{{'){if(!depth)start=i;depth++;i++;}
      else if(pair==='}}'&&depth){depth--;i++;if(!depth){const parts=split(text.slice(start+2,i-1));out.push({start,end:i+1,name:parts.shift().toLowerCase(),parts});}}
    }return out;
  }
  const params = parts => parts.map(part=>{const i=part.indexOf('=');return i<0?['',part]:[part.slice(0,i).trim(),part.slice(i+1).trim()];});
  let text=source.textContent.replace(/<div\b[^>]*class=["'][^"']*mw-collapsible[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,'{{Spoiler|$1}}');
  const directives=templates(text).filter(t=>['page','infobox','character','tabs','gallery','references','credits','randomarticle','characters','categorypages','relationshipmap','collapse'].includes(t.name));
  const get=name=>directives.find(t=>t.name===name);
  const page=Object.fromEntries(params(get('page')?.parts||[]).map(([k,v])=>[k.toLowerCase(),v]));
  const title=page.title||document.title.replace(/\s*\|.*$/,'');
  const tabID=label=>label.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'tab';
  const tabNames=[...text.matchAll(/^\|tab\s*=\s*(.+)$/gm)].map(match=>match[1].trim());
  const imageBase=page['image base']||'/images/character_art/';
  const slug=s=>s.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  function href(target){if(target.startsWith('fandom:'))return 'https://mysticallegends.fandom.com/wiki/'+target.slice(7).replace(/ /g,'_').split('/').map(encodeURIComponent).join('/');if(/^(?:https?:|\/|#)/i.test(target))return safe(target);const parts=target.split('/').map(slug);return parts.every(Boolean)?'/wiki/'+parts.join('/'):'';}
  function link(label,target,allowExternal=false){const a=make('a','',label);window.wikiLinks.attach(a,href(target),{allowExternal});return a;}
  function imageURL(file){return safe(file.startsWith('/')||/^https?:/i.test(file)?file:imageBase.replace(/\/?$/,'/')+file);}
  function figure(file,caption='',cls='wiki-figure'){
    const url=imageURL(file);if(!url)return null;
    const f=make('figure',cls),img=make('img');img.src=url;img.alt=caption||title;img.loading='lazy';img.decoding='async';
    const a=link('',url);a.append(img);f.append(a);if(caption)f.append(make('figcaption','',caption));return f;
  }
  function inline(parent,value,allowExternal=false){
    // Protect generated markup with placeholders so plain text can never inject HTML.
    const slots=[];const slot=n=>{slots.push(n);return `\uE000${slots.length-1}\uE001`;};
    let remaining=value;
    for(const t of templates(value).reverse()){
      if(t.name!=='spoiler')continue;
      const d=make('details','wiki-spoiler'),s=make('summary');s.innerHTML='<span class="wiki-show-spoiler">Show Spoiler</span><span class="wiki-hide-spoiler">Hide Spoiler</span>';const c=make('div','wiki-inline-spoiler');inline(c,t.parts.join('|'),allowExternal);d.append(s,c);remaining=remaining.slice(0,t.start)+slot(d)+remaining.slice(t.end);
    }
    remaining=remaining.replace(/\[\[([^\]]+)\]\]/g,(_,inside)=>{const [target,label]=split(inside);if(/^File:/i.test(target))return slot(figure(target.slice(5),label)||make('span'));return slot(link(label||target.replace(/^fandom:/,''),target,allowExternal));});
    remaining=remaining.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g,(_,url,label)=>slot(link(label,url,allowExternal)));
    // Only block spoilers absorb surrounding breaks; inline links retain them.
    remaining=remaining.replace(/(?:<br\s*\/?>\s*)+(\uE000(\d+)\uE001)/gi,
      (match, marker, index) => slots[Number(index)]?.tagName === 'DETAILS' ? marker : match);
    remaining=remaining.replace(/(\uE000(\d+)\uE001)(?:\s*<br\s*\/?>)+/gi,
      (match, marker, index) => slots[Number(index)]?.tagName === 'DETAILS' ? marker : match);
    remaining=remaining.replace(/(?:<br\s*\/?>\s*)+$/gi,'');
    const frag=make('div');frag.innerHTML=escape(remaining).replace(/&lt;br\s*\/?&gt;/gi,'<br>').replace(/'''(.*?)'''/g,'<strong>$1</strong>').replace(/''(.*?)''/g,'<em>$1</em>');
    const walker=document.createTreeWalker(frag,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const n of nodes){if(!/\uE000\d+\uE001/.test(n.textContent))continue;const parts=n.textContent.split(/(\uE000\d+\uE001)/);n.replaceWith(...parts.map(p=>/^\uE000/.test(p)?slots[Number(p.slice(1,-1))]:document.createTextNode(p)));}
    parent.append(...frag.childNodes);
  }
  // All layout is shared; optional elements are appended only when populated.
  const shell=make('main','wiki-shell'),heading=make('header','wiki-heading'),h1=make('h1','',title);h1.id='wiki-title';heading.append(h1);shell.append(heading);
  const content=make('div');content.id='wiki-content';shell.append(content);
  if(page.notice){const n=make('div','wiki-note');inline(n,page.notice);content.append(n);}
  const tabs=get('tabs');if(tabs||tabNames.length>1){const nav=make('nav','wiki-related');nav.setAttribute('aria-label','Related pages');const entries=tabs?params(tabs.parts):tabNames.map(name=>['',name]);for(const [label,target] of entries){const name=label||target;const marker=tabNames.find(tab=>tab===name);const destination=label?target:marker?'#'+tabID(marker):'';if(name)nav.append(link(name,destination));}if(nav.children.length)content.append(nav);}
  const layout=make('div','wiki-layout'),article=make('article','wiki-article');article.id='wiki-body';article.tabIndex=-1;layout.append(article);content.append(layout);
  const intro=make('div','wiki-intro');article.append(intro);
  const toc=make('details','wiki-toc');toc.open=true;toc.append(make('summary','','Contents'));const tocNav=make('nav');tocNav.id='wiki-toc-links';tocNav.setAttribute('aria-label','Article contents');toc.append(tocNav);article.append(toc);
  const sectionRoot=make('div');article.append(sectionRoot);
  const box=get('infobox')||get('character');
  if(box){
    const entries=params(box.parts),boxTitle=entries.find(([k])=>/^(title|name)$/i.test(k))?.[1]||title;
    const aside=make('aside','wiki-infobox');aside.id='wiki-infobox';aside.setAttribute('aria-label',boxTitle+' information');aside.append(make('h2','',boxTitle));
    const images=entries.filter(([k,v])=>/^image$/i.test(k)&&v).map(([,v])=>v.split(' :: ').map(x=>x.trim()));
    if(images.length){const controls=make('div','wiki-portrait-tabs');controls.setAttribute('role','group');controls.setAttribute('aria-label','Appearances');if(images.length>1)aside.append(controls);images.forEach(([file,label],i)=>{const f=figure(file,label,'wiki-portrait');if(!f)return;f.id='portrait-'+i;f.hidden=i!==0;aside.append(f);const b=make('button','',label||`Appearance ${i+1}`);b.type='button';b.dataset.wikiPortrait=f.id;b.setAttribute('aria-controls',f.id);b.setAttribute('aria-pressed',String(i===0));controls.append(b);});}
    let group=null,dl=null;const groups=[];
    for(const [key,value] of entries){if(/^(title|name|image)$/i.test(key))continue;if(/^section$/i.test(key)){group=make('section','wiki-infobox-group');if(value)group.append(make('h3','',value));dl=make('dl');group.append(dl);groups.push(group);continue;}if(!key||!value.trim())continue;if(!dl){group=make('section','wiki-infobox-group');dl=make('dl');group.append(dl);groups.push(group);}const row=make('div','wiki-infobox-row'),dd=make('dd');inline(dd,value.replace(/\n/g,'<br>'));row.append(make('dt','',key),dd);dl.append(row);}
    groups.filter(g=>g.querySelector('dl').children.length).forEach(g=>aside.append(g));
    if(images.length||groups.some(g=>g.querySelector('dl').children.length)){layout.append(aside);}else layout.classList.add('wiki-layout-no-infobox');
  }else layout.classList.add('wiki-layout-no-infobox');
  const collapses=directives.filter(d=>d.name==='collapse');
  for(const d of directives.slice().reverse())text=text.slice(0,d.start)+(d.name==='collapse'?'\nWIKI_COLLAPSE_'+collapses.indexOf(d)+'\n':'')+text.slice(d.end);
  const categories=[];text=text.replace(/\[\[Category:([^\]]+)\]\]/gi,(_,name)=>{const category=name.split('|')[0].trim();if(category&&!categories.includes(category))categories.push(category);return '';});
  function renderText(text,root,nested=false){
  let bodyRoot=root,parent=nested?root:intro,paragraph=[];const stack=[],listStack=[];
  function flush(){if(paragraph.length){const n=make('div','wiki-paragraph');inline(n,paragraph.join(' '));parent.append(n);paragraph=[];}listStack.length=0;}
  function appendList(markers, value) {
    listStack.length=Math.min(listStack.length,markers.length);
    for(let depth=0;depth<markers.length;depth++){
      const marker=markers[depth];
      if(listStack[depth]?.marker!==marker)listStack.length=depth;
      if(!listStack[depth]){
        const list=make(marker==='*'?'ul':'ol');
        (depth?listStack[depth-1].item:parent).append(list);
        listStack.push({marker,list,item:null});
      }
      const entry=listStack[depth];
      if(depth===markers.length-1){const li=make('li');inline(li,value);entry.list.append(li);entry.item=li;}
      else if(!entry.item){entry.item=make('li','wiki-list-placeholder');entry.list.append(entry.item);}
    }
  }
  // Keep multiline spoiler templates as one paragraph token.
  text=text.replace(/\{\{Spoiler\|([\s\S]*?)\}\}/gi,(_,v)=>'{{Spoiler|'+v.replace(/\n/g,' ')+'}}');
  for(const line of text.trim().split('\n')){const collapse=line.match(/^WIKI_COLLAPSE_(\d+)$/);if(collapse){flush();const settings=Object.fromEntries(params(collapses[Number(collapse[1])].parts)),details=make('details','wiki-disclosure'),summary=make('summary','',settings.title||'Read more'),body=make('div');details.append(summary,body);parent.append(details);renderText(settings.content||'',body,true);continue;}const tab=line.match(/^\|tab\s*=\s*(.+)$/);if(tab){flush();stack.length=0;const group=make('div','wiki-tab-content');group.id=tabID(tab[1]);group.dataset.wikiTab=tab[1].trim();root.append(group);bodyRoot=group;parent=group;continue;}const match=line.match(/^(={2,5})\s*(.*?)\s*\1\s*$/);if(match){flush();const depth=match[1].length;while(stack.length&&stack.at(-1).depth>=depth)stack.pop();const s=make('section','wiki-section'),h=make('h'+depth);s.dataset.headingLevel=String(depth);s.style.setProperty('--wiki-section-indent',String(Math.max(0,depth-(stack.at(-1)?.depth||2))));inline(h,match[2]);if(nested)h.dataset.wikiTocExclude='';s.append(h);(stack.at(-1)?.s||bodyRoot).append(s);stack.push({depth,s});parent=s;continue;}if(!line.trim()){flush();continue;}const bullet=line.match(/^([*#]+)\s*(.*)$/);if(bullet){if(paragraph.length)flush();appendList(bullet[1],bullet[2]);continue;}paragraph.push(line.trim());}flush();
  }
  renderText(text,sectionRoot);
  window.addEventListener('hashchange',()=>{let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{}const details=target?.closest('.wiki-disclosure');if(details){details.open=true;requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}});
  const gallery=get('gallery');if(gallery){const section=make('section','wiki-section'),grid=make('div','wiki-gallery');section.append(make('h2','','Gallery'),grid);for(const line of gallery.parts.join('\n').split('\n')){const [file,label]=line.split(' :: ').map(x=>x.trim());if(file){const f=figure(file,label);if(f)grid.append(f);}}if(grid.children.length)article.append(section);}
  const references=get('references');if(references){const section=make('section','wiki-section'),list=make('ol');section.append(make('h2','','References'),list);for(const [label,url] of params(references.parts)){if(!url)continue;const li=make('li');li.append(link(label||url,url,true));list.append(li);}if(list.children.length)article.append(section);}
  const random=get('randomarticle');if(random){const section=make('section','wiki-section');section.append(make('h2','',Object.fromEntries(params(random.parts)).title||'Discover an article'));const host=make('div','wiki-random-article');host.id='wiki-random-article';section.append(host);article.append(section);}
  const characters=get('characters');if(characters){const section=make('section','wiki-section'),grid=make('div','wiki-character-grid');section.append(make('h2','','Meet the Mystical Legends'),grid);for(const [name,value] of params(characters.parts)){if(!name||!value)continue;const [file,target]=value.split(' :: ').map(x=>x.trim());const card=make('div','wiki-character-card'),portrait=link('',target||name);portrait.classList.add('wiki-character-portrait');const img=make('img');if(file)img.src=imageURL(file);img.alt=name;img.loading='lazy';img.decoding='async';portrait.append(img);window.wikiPortraits.resolve(name,target||name,file?imageURL(file):'').then(url=>{if(url)img.src=url;else img.remove();});card.append(portrait,link(name,target||name));grid.append(card);}if(grid.children.length)article.append(section);}
  const categoryPages=get('categorypages');if(categoryPages){const settings=Object.fromEntries(params(categoryPages.parts)),section=make('section','wiki-section'),host=make('div','wiki-category-pages');host.dataset.category=settings.category||title;section.append(make('h2','',settings.title||'Pages in this category'),host);article.append(section);}
  if(get('relationshipmap')){const map=make('div');map.id='wiki-relationship-map';article.append(map);}
  const footer=make('footer','wiki-article-footer');
  if(categories.length){const n=make('div');n.id='wiki-categories';n.setAttribute('aria-label','Categories');categories.forEach(c=>{const tag=link(c,'/wiki/category/'+slug(c));tag.classList.add('wiki-category');n.append(tag);});footer.append(n);}
  const credits=get('credits');if(credits){const n=make('p');inline(n,credits.parts.join('|'),true);footer.append(n);}const backToTop=make('button','wiki-back-to-top','Back to top');backToTop.type='button';backToTop.dataset.wikiBackToTop='';const footerActions=make('div','wiki-actions');footerActions.append(backToTop);
  if(/^\/wiki\/home(?:\.html)?\/?$/.test(location.pathname)){const editor=make('a','','Wiki editor');editor.href='/wiki/wiki-editor/';footerActions.append(editor);}
  footer.append(footerActions);article.append(footer);
  const host=make('div');host.id='wiki-header-placeholder';const skip=link('Skip to article','#wiki-body');skip.className='wiki-skip';const bottom=make('div');bottom.id='subfooter-placeholder';const backdrop=make('div','wiki-content-backdrop');backdrop.append(shell);document.body.append(skip,host,backdrop,bottom);
  document.title=title+' | Mystical Legends Wiki';const description=window.wikiArticleSummary(source.textContent);if(description)document.querySelector('meta[name="description"]')?.setAttribute('content',description);
})();
