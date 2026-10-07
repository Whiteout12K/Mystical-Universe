/* Discover portraits by character name; no head-image path is needed in articles. */
(() => {
  const pending=new Map();
  const slug=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  function candidates(name,target){
    const page=String(target||'').replace(/^fandom:/,'').split(/[?#]/)[0].replace(/\.html?$/i,'').split('/').pop();
    return [...new Set([slug(name),slug(page||'')].filter(Boolean))].flatMap(base=>['png','webp','jpg','jpeg','svg'].map(extension=>`/images/character_art/Character_Heads/${base}_head.${extension}`));
  }
  window.wikiPortraits={async resolve(name,target='',fallback=''){
    const paths=candidates(name,target),key=paths.join('|');
    if(!pending.has(key))pending.set(key,(async()=>{for(const path of paths){try{const response=await fetch(path,{method:'HEAD'});if(response.ok&&/^image\//i.test(response.headers.get('content-type')||''))return path;}catch{}}return '';})());
    return await pending.get(key)||fallback;
  }};
})();
