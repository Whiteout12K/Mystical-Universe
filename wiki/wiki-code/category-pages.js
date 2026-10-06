/* Category membership is read from existing wiki articles, including nested folders. */
(async () => {
  const hosts=[...document.querySelectorAll('.wiki-category-pages')];if(!hosts.length)return;
  const normalize=value=>value.trim().replace(/_/g,' ').replace(/\s+/g,' ').toLowerCase();
  const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  hosts.forEach(host=>{host.setAttribute('aria-live','polite');host.append(make('p','','Loading category pages…'));});
  try{
    const response=await fetch('/sitemap.xml',{cache:'no-cache'});if(!response.ok)throw Error('Archive unavailable');
    const xml=new DOMParser().parseFromString(await response.text(),'application/xml');
    const paths=[...new Set([...xml.getElementsByTagName('loc')].map(node=>new URL(node.textContent).pathname).filter(path=>path.startsWith('/wiki/')&&!/^\/wiki\/wiki-(?:code|editor)\//.test(path)))];
    const articles=[];let cursor=0,failures=0;
    await Promise.all(Array.from({length:Math.min(4,paths.length)},async()=>{
      while(cursor<paths.length){const path=paths[cursor++];
        try{
          let page=await fetch(path,{cache:'no-cache'});if(page.status===404&&!/\.html?$/i.test(path))page=await fetch(path+'.html',{cache:'no-cache'});if(!page.ok)throw Error('Page unavailable');
          const doc=new DOMParser().parseFromString(await page.text(),'text/html'),source=doc.querySelector('script[type="text/x-wiki"]')?.textContent;if(!source)continue;
          const categories=[...source.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi)].map(match=>normalize(match[1]));
          if(!categories.length)continue;
          const title=source.match(/\|title\s*=([^\n|}]+)/)?.[1].trim()||doc.title.replace(/\s*\|.*$/,'');
          articles.push({path,title,categories,summary:window.wikiArticleSummary(source)});
        }catch{failures++;}
      }
    }));
    articles.sort((a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base'}));
    for(const host of hosts){
      host.replaceChildren();const matches=articles.filter(article=>article.categories.includes(normalize(host.dataset.category)));
      if(!matches.length)host.append(make('p','',failures?'Some articles could not be loaded. Refresh to try again.':'No wiki pages have this category yet.'));
      if(matches.length){const list=make('ul','wiki-category-list');for(const article of matches){const item=make('li'),link=make('a','',article.title);window.wikiLinks.attach(link,article.path);item.append(link);list.append(item);}host.append(list);}
      if(matches.length&&failures)host.append(make('p','','Some articles could not be loaded. Refresh to see the complete list.'));
    }
  }catch{hosts.forEach(host=>host.replaceChildren(make('p','','Category pages could not be loaded. Please refresh to try again.')));}
})();
