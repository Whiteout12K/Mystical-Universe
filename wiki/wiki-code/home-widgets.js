/* Optional homepage feature: choose only wiki articles present in the sitemap. */
(async () => {
  const host=document.getElementById('wiki-random-article');if(!host)return;
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const message=make('p','','Opening the archive…');host.append(message);
  try {
    const response=await fetch('/sitemap.xml',{cache:'no-cache'});if(!response.ok)throw Error('Archive unavailable');
    const sitemap=new DOMParser().parseFromString(await response.text(),'application/xml');
    const paths=[...new Set([...sitemap.getElementsByTagName('loc')].map(n=>new URL(n.textContent).pathname).filter(p=>p.startsWith('/wiki/')&&!p.startsWith('/wiki/wiki-code/')&&!['/wiki/home','/wiki/home.html'].includes(p)))];
    let remaining=[...paths],current='';
    const card=make('div','wiki-random-card'),body=make('div','wiki-random-copy'),title=make('a','wiki-random-title'),summary=make('p'),button=make('button','','Show another article');button.type='button';
    body.append(title,summary,button);card.append(body);
    async function show() {
      button.disabled=true;
      while(remaining.length){
        const choices=remaining.filter(p=>p!==current),path=choices[Math.floor(Math.random()*choices.length)]||remaining[0];
        try {
          const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw Error();
          const doc=new DOMParser().parseFromString(await r.text(),'text/html'),source=doc.querySelector('script[type="text/x-wiki"]');if(!source)throw Error();
          const name=source.textContent.match(/\|title\s*=([^\n|}]+)/)?.[1]?.trim()||doc.title.replace(/\s*\|.*$/,'');
          title.textContent=name;title.href=path;summary.textContent=doc.querySelector('meta[name="description"]')?.content||'Explore this article from the Mystical Legends archive.';
          card.querySelector('img')?.remove();
          const file=source.textContent.match(/\|image\s*=([^\n|}]+)/)?.[1]?.split(' :: ')[0].trim();
          if(file){const base=source.textContent.match(/\|image base\s*=([^\n|}]+)/)?.[1]?.trim()||'/images/character_art/';const img=make('img','wiki-random-image');const url=new URL(file.startsWith('/')||/^https?:/i.test(file)?file:base.replace(/\/?$/,'/')+file,location.href);if(['http:','https:'].includes(url.protocol)){img.src=url.href;img.alt=name;img.loading='lazy';card.prepend(img);}}
          current=path;host.replaceChildren(card);button.hidden=remaining.length<2;button.disabled=false;return;
        }catch{remaining=remaining.filter(p=>p!==path);}
      }
      host.replaceChildren(make('p','','New wiki articles will appear here as the archive grows.'));
    }
    button.addEventListener('click',show);await show();
  }catch{host.replaceChildren(make('p','','The archive could not be loaded. Please refresh to try again.'));}
})();
