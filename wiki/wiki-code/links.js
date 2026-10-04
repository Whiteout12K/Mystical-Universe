/* Only published local sitemap pages and existing assets can be followed. */
window.wikiLinksReady = (async () => {
  const normalize = path => path.replace(/\.html?$/i,'').replace(/\/index$/i,'/').replace(/\/$/,'') || '/';
  const pages = new Set([normalize(location.pathname)]);
  try {
    const r=await fetch('/sitemap.xml',{cache:'no-cache'});
    if(r.ok){const xml=new DOMParser().parseFromString(await r.text(),'application/xml');for(const n of xml.getElementsByTagName('loc'))pages.add(normalize(new URL(n.textContent).pathname));}
  } catch {}
  const slug = name => name.split('/').map(s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')).join('/');
  const assets=new Map();
  function candidate(target) {
    try {
      if(typeof target !== 'string' || !target.trim())return null;
      if(target.startsWith('fandom:'))return new URL('/wiki/'+slug(target.slice(7)),location.origin);
      const u=new URL(target,location.href);
      if(u.hostname==='mysticallegends.fandom.com')return new URL('/wiki/'+slug(decodeURIComponent(u.pathname.replace(/^\/wiki\//,''))),location.origin);
      if(!['http:','https:'].includes(u.protocol))return null;
      if(u.origin!==location.origin&&u.hostname!=='mysticallegends.org')return null;
      return new URL(u.pathname+u.search+u.hash,location.origin);
    }catch{return null;}
  }
  function enable(a,u){a.href=u.href;a.removeAttribute('aria-disabled');a.classList.remove('wiki-link-unavailable');a.addEventListener('click',event=>{if(normalize(u.pathname)===normalize(location.pathname)&&u.hash){try{if(!document.getElementById(decodeURIComponent(u.hash.slice(1))))event.preventDefault();}catch{event.preventDefault();}}});}
  window.wikiLinks = {attach(a,target){
    a.removeAttribute('href');a.removeAttribute('target');a.removeAttribute('rel');a.setAttribute('aria-disabled','true');a.classList.add('wiki-link-unavailable');
    const u=candidate(target);if(!u)return a;
    if(pages.has(normalize(u.pathname))){enable(a,u);return a;}
    if(/\.(?:png|jpe?g|webp|gif|svg|pdf|mp3|mp4|ogg|wav)$/i.test(u.pathname)){
      if(!assets.has(u.pathname))assets.set(u.pathname,fetch(u.pathname,{method:'HEAD'}).then(r=>r.ok&&!/text\/html/i.test(r.headers.get('content-type')||'')).catch(()=>false));
      assets.get(u.pathname).then(valid=>{if(valid)enable(a,u);});
    }
    return a;
  }};
})();
