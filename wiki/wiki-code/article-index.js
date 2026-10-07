/* One shared inventory for links, search, navigation, and article widgets. */
window.wikiArticleIndex = (async () => {
  try {
    const r=await fetch('/wiki/article-index.json',{cache:'no-cache'});
    if(r.ok){const data=await r.json();if(Array.isArray(data.pages))return data.pages.filter(p=>typeof p.path==='string'&&p.path.startsWith('/wiki/')&&!p.path.includes('..')&&!/\/wiki-(code|editor)\//.test(p.path));}
  }catch{}
  try{const r=await fetch('/sitemap.xml',{cache:'no-cache'});if(!r.ok)return [];const xml=new DOMParser().parseFromString(await r.text(),'application/xml');return [...new Set([...xml.querySelectorAll('loc')].map(n=>new URL(n.textContent).pathname).filter(p=>p.startsWith('/wiki/')&&!/\/wiki-(code|editor)\//.test(p)))].map(path=>({path,title:path.split('/').pop().replace(/_/g,' ')}));}catch{return [];}
})();
