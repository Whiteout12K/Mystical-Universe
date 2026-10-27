/* DON'T TOUCH: shared wiki assets. Each article needs only this loader and wiki text. */
(async () => {
  const theme = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('wiki_theme='))?.split('=')[1];
  document.documentElement.dataset.wikiTheme = theme === 'light' ? 'light' : 'dark';
  try{const account=await import('/js/account-preferences.js');await account.loadAccountPreferences();account.applyWikiTheme();}catch{/* The cookie remains the fallback when account settings are unavailable. */}
  const icon=document.createElement('link');icon.rel='icon';icon.href='/images/website/favicon.png';document.head.append(icon);
  for (const href of ['/css/bootstrap-min.css','/css/home.css','/css/mlg.css','/wiki/wiki-code/wiki.css']) {
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);
  }
  for (const src of ['/js/bootstrap-bundle-min.js','/wiki/wiki-code/article-index.js','/wiki/wiki-code/links.js','/wiki/wiki-code/summary.js','/wiki/wiki-code/portraits.js','/wiki/wiki-code/relations-store.js','/wiki/wiki-code/wikitext.js','/js/include.js','/wiki/wiki-code/home-widgets.js','/wiki/wiki-code/category-pages.js','/wiki/wiki-code/wiki.js','/wiki/wiki-code/theme.js','/wiki/wiki-code/article-features.js','/wiki/wiki-code/relationship-layout.js','/wiki/wiki-code/relationship.js','/wiki/wiki-code/search.js','/wiki/wiki-code/header-wiki.js','/js/home.js']) {
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=async()=>{if(src.includes('/relations-store.js'))await window.wikiRelationsReady;if(src.includes('/links.js')){await window.wikiLinksReady;}resolve();};s.onerror=()=>reject(Error('Unable to load '+src));document.head.append(s);});
  }
  document.body.dataset.wikiReady='true';
})();
