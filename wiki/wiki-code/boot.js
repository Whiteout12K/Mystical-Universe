/* DON'T TOUCH: shared wiki assets. Each article needs only this loader and wiki text. */
(async () => {
  const icon=document.createElement('link');icon.rel='icon';icon.href='/images/website/favicon.png';document.head.append(icon);
  for (const href of ['/css/bootstrap-min.css','/css/home.css','/css/mlg.css','/wiki/wiki-code/wiki.css?v=10']) {
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);
  }
  for (const src of ['/js/bootstrap-bundle-min.js','/wiki/wiki-code/wikitext.js?v=7','/js/include.js','/wiki/wiki-code/home-widgets.js?v=1','/wiki/wiki-code/wiki.js?v=10','/wiki/wiki-code/header-wiki.js?v=2','/js/home.js']) {
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Unable to load '+src));document.head.append(s);});
  }
  document.body.dataset.wikiReady='true';
})();
