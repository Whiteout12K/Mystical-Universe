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
    prev.textContent='Previous';next.textContent='Next';close.textContent='Close';
    for(const button of [prev,next,close])button.type='button';
    const image=document.createElement('img'),caption=document.createElement('p');caption.id='wiki-gallery-caption';dialog.setAttribute('aria-label','Artwork viewer');dialog.setAttribute('aria-describedby',caption.id);
    controls.append(prev,next,close);dialog.append(controls,image,caption);document.body.append(dialog);
    let index=0,originalOverflow='';
    const show = value => {index=(value+pictures.length)%pictures.length;const original=pictures[index].querySelector('img');image.src=original.currentSrc||original.src;image.alt=original.alt;caption.textContent=pictures[index].querySelector('figcaption')?.textContent||original.alt;prev.hidden=next.hidden=pictures.length<2;};
    pictures.forEach((figure,i)=>{const anchor=figure.querySelector('a');if(!anchor)return;anchor.setAttribute('aria-label','Enlarge '+(figure.querySelector('figcaption')?.textContent||figure.querySelector('img').alt));anchor.addEventListener('click',event=>{event.preventDefault();show(i);originalOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();});});
    prev.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{document.body.style.overflow=originalOverflow;});
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(index-1);}if(event.key==='ArrowRight'){event.preventDefault();show(index+1);}});
  }
  window.wikiCharacterArchive = (async () => {
    try {
      const response=await fetch('/sitemap.xml',{cache:'no-cache'});if(!response.ok)throw Error('Archive unavailable');
      const xml=new DOMParser().parseFromString(await response.text(),'application/xml');
      const paths=[...new Set([...xml.querySelectorAll('loc')].map(n=>new URL(n.textContent).pathname).filter(p=>p.startsWith('/wiki/char/')))];
      const profiles=[];let cursor=0;
      await Promise.all(Array.from({length:Math.min(4,paths.length)},async()=>{while(cursor<paths.length){const path=paths[cursor++];try{let r=await fetch(path);if(r.status===404)r=await fetch(path+'.html');if(!r.ok)continue;const doc=new DOMParser().parseFromString(await r.text(),'text/html');const source=doc.querySelector('#wiki-source')?.textContent;if(!source)continue;
        const field=name=>source.match(new RegExp('^\\|'+name+'=([^]*?)(?=^\\||^\\}\\})','m'))?.[1]?.trim()||'';
        const clean=value=>value.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g,'$1').replace(/fandom:/g,'').replace(/\{\{[^]*?\}\}/g,'').trim();
        const title=field('title'),base=field('image base')||'/images/character_art/',file=field('image').split(' :: ')[0];
        const image=file?new URL(file.startsWith('/')?file:base.replace(/\/?$/,'/')+file,location.origin).pathname:'';
        const affiliations=clean(field('Affiliation')).split('\n').map(x=>x.replace(/\s*\([^)]*\)/g,'').trim()).filter(Boolean);
        profiles.push({title,path,source,image,affiliations,relations:['Relatives','Leader','Subordinates'].flatMap(kind=>field(kind).split('\n').filter(Boolean).map(line=>kind+': '+line)).join('\n'),description:window.wikiArticleSummary(source)});
      }catch{}}}));await Promise.all(profiles.map(async profile=>{profile.portrait=await window.wikiPortraits.resolve(profile.title,profile.path,profile.image);}));return profiles.sort((a,b)=>a.title.localeCompare(b.title));
    }catch{return [];}
  })();
  window.wikiCharacterArchive.then(profiles=>{
    const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'');
    const current=profiles.find(p=>p.path.replace(/\.html$/,'')===path);if(!current)return;
    const candidates=profiles.filter(p=>p!==current).map(p=>{const direct=current.source.includes(p.path.split('/').pop())||p.relations.includes(current.title)||current.relations.includes(p.title);const shared=p.affiliations.filter(a=>current.affiliations.includes(a));return {profile:p,score:(direct?10:0)+shared.length,reason:direct?'Connected in this article':shared[0]};}).filter(p=>p.score).sort((a,b)=>b.score-a.score||a.profile.title.localeCompare(b.profile.title)).slice(0,4);
    if(!candidates.length)return;
    const section=document.createElement('section');section.className='wiki-related-articles';const heading=document.createElement('h2');heading.textContent='Related articles';const list=document.createElement('div');list.className='wiki-related-article-list';
    for(const {profile,reason} of candidates){const a=document.createElement('a');a.href=profile.path;if(profile.image){const img=document.createElement('img');img.src=profile.image;img.alt='';img.loading='lazy';const frame=document.createElement('span');frame.className='wiki-related-portrait';frame.append(img);a.append(frame);}const text=document.createElement('span');text.textContent=profile.title;const small=document.createElement('small');small.textContent=reason;text.append(small);a.append(text);list.append(a);}
    section.append(heading,list);document.querySelector('.wiki-article-footer')?.before(section);
  });
})();
