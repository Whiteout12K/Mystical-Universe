/* Affiliation identity ignores role notes, casing, and presentation markup. */
window.wikiAffiliations=(()=>{
  const key=value=>value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");
  function parse(value){
    const text=value.replace(/\{\{Spoiler\|([\s\S]*?)\}\}/gi,'$1').replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g,'$1').replace(/fandom:/g,'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'');
    const entries=new Map();
    for(let name of text.split('\n')){
      let previous;
      do{previous=name;name=name.replace(/\([^()]*\)/g,'');}while(previous!==name);
      name=name.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
      if(/^it industr(?:y|ies)$/i.test(name))name='IT Industry';
      if(name&&!/^(none|unknown|n\/a)$/i.test(name)&&!entries.has(key(name)))entries.set(key(name),name);
    }
    return [...entries.values()];
  }
  function shared(a,b){const other=new Set(parse(b.join('\n')).map(key));return parse(a.join('\n')).filter(name=>other.has(key(name)));}
  return {parse,shared};
})();
/* Shared article tools: mobile contents, gallery viewer, and related profiles. */
(() => {
  const toc = document.querySelector('.wiki-toc');
  if (toc) {
    const button = document.createElement('button');
    button.className = 'wiki-mobile-contents'; button.type = 'button';
    button.textContent = ''; button.setAttribute('aria-label', 'Open table of contents');
    button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'wiki-toc-links');
    const close = () => {toc.classList.remove('wiki-toc-open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Open table of contents');};
    button.addEventListener('click', () => {const open = !toc.classList.contains('wiki-toc-open');toc.classList.toggle('wiki-toc-open',open);toc.open = true;button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close table of contents':'Open table of contents');});
    toc.addEventListener('click', event => {if(event.target.closest('a')) close();});
    document.addEventListener('click', event => {if(!toc.contains(event.target)&&!button.contains(event.target))close();});
    document.addEventListener('keydown', event => {if(event.key==='Escape'){close();}});
    document.body.append(button);
  }
  const pictures = [...document.querySelectorAll('.wiki-gallery figure, .wiki-portrait, .wiki-figure')].filter(figure => figure.querySelector('img'));
  if (pictures.length) {
    const dialog = document.createElement('dialog');dialog.className='wiki-gallery-viewer';
    const controls=document.createElement('div');controls.className='wiki-gallery-controls';
    const prev=document.createElement('button'),next=document.createElement('button'),close=document.createElement('button');
    prev.textContent='Previous';next.textContent='Next';close.textContent='Close';close.autofocus=true;
    for(const button of [prev,next,close])button.type='button';
    const image=document.createElement('img');image.draggable=false;const caption=document.createElement('p');caption.id='wiki-gallery-caption';dialog.setAttribute('aria-label','Artwork viewer');dialog.setAttribute('aria-describedby',caption.id);
    controls.append(prev,next,close);dialog.append(controls,image,caption);document.body.append(dialog);
    let index=0,originalOverflow='';
    const show = value => {index=(value+pictures.length)%pictures.length;const original=pictures[index].querySelector('img');image.src=original.currentSrc||original.src;image.alt=original.alt;caption.textContent=pictures[index].querySelector('figcaption')?.textContent||original.alt;prev.hidden=next.hidden=pictures.length<2;};
    pictures.forEach((figure,i)=>{const anchor=figure.querySelector('a');if(!anchor)return;anchor.classList.add('wiki-image-trigger');figure.querySelector('img').draggable=false;anchor.setAttribute('aria-label','Enlarge '+(figure.querySelector('figcaption')?.textContent||figure.querySelector('img').alt));anchor.addEventListener('click',event=>{event.preventDefault();if(matchMedia('(pointer: coarse)').matches)window.getSelection()?.removeAllRanges();show(i);originalOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();close.focus({preventScroll:true});});});
    prev.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{document.body.style.overflow=originalOverflow;});
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(index-1);}if(event.key==='ArrowRight'){event.preventDefault();show(index+1);}});
  }
  window.wikiCharacterArchive = (async () => {
    try {
      const paths=(await window.wikiArticleIndex).map(page=>page.path).filter(path=>path.startsWith('/wiki/char/'));
      const profiles=[];let cursor=0;
      await Promise.all(Array.from({length:Math.min(4,paths.length)},async()=>{while(cursor<paths.length){const path=paths[cursor++];try{let r=await fetch(path);if(r.status===404)r=await fetch(path+'.html');if(!r.ok)continue;const doc=new DOMParser().parseFromString(await r.text(),'text/html');const source=doc.querySelector('#wiki-source')?.textContent;if(!source)continue;
        const field=name=>source.match(new RegExp('^\\|'+name+'=([^]*?)(?=^\\||^\\}\\})','m'))?.[1]?.trim()||'';
        const title=field('title'),base=field('image base')||'/images/character_art/',file=field('image').split(' :: ')[0];
        const image=file?new URL(file.startsWith('/')?file:base.replace(/\/?$/,'/')+file,location.origin).pathname:'';
        const central=window.wikiRelations?.find(path,title);
        const affiliations=window.wikiAffiliations.parse(central?.affiliations??field('Affiliation'));
        profiles.push({title:central?.name||title,path,source,image,affiliations,aliases:[title],relations:(central?.relatives||'').split('\n').filter(Boolean).map(line=>'Relatives: '+line).join('\n'),description:window.wikiArticleSummary(source)});
      }catch{}}}));const portraits=profiles.map(profile=>{profile.portraitReady=window.wikiPortraits.resolve(profile.title,profile.path,profile.image).then(portrait=>{profile.portrait=portrait;return portrait;});return profile.portraitReady;});if(!document.getElementById('wiki-relationship-map'))await Promise.all(portraits);return profiles.sort((a,b)=>a.title.localeCompare(b.title));
    }catch{return [];}
  })();
  window.wikiCharacterArchive.then(profiles=>{
    const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'');
    const current=profiles.find(p=>p.path.replace(/\.html$/,'')===path);if(!current)return;
    const candidates=profiles.filter(p=>p!==current).map(p=>{const direct=current.source.includes(p.path.split('/').pop())||p.relations.includes(current.title)||current.relations.includes(p.title);const shared=window.wikiAffiliations.shared(p.affiliations,current.affiliations);return {profile:p,score:(direct?10:0)+shared.length,reason:direct?'Connected in this article':shared[0]};}).filter(p=>p.score).sort((a,b)=>b.score-a.score||a.profile.title.localeCompare(b.profile.title)).slice(0,4);
    if(!candidates.length)return;
    const section=document.createElement('section');section.className='wiki-related-articles';const heading=document.createElement('h2');heading.textContent='Related articles';const list=document.createElement('div');list.className='wiki-related-article-list';
    for(const {profile,reason} of candidates){const a=document.createElement('a');a.href=profile.path;if(profile.image){const img=document.createElement('img');img.src=profile.image;img.alt='';img.loading='lazy';const frame=document.createElement('span');frame.className='wiki-related-portrait';frame.append(img);a.append(frame);}const text=document.createElement('span');text.textContent=profile.title;const small=document.createElement('small');small.textContent=reason;text.append(small);a.append(text);list.append(a);}
    section.append(heading,list);document.querySelector('.wiki-article-footer')?.before(section);
  });
})();
