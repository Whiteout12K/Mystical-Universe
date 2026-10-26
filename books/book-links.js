// Resolve against the archive document, never the reader's hosted URL or blob URL.
export function resolveChapterLink(href,currentDocument,sections,origin){
 if(typeof href!=='string'||!href.trim())return null;
 try{
  const base=new URL(currentDocument,origin+'/'),target=new URL(href,base);
  if(!['http:','https:'].includes(target.protocol)||target.origin!==new URL(origin).origin)return null;
  const path=value=>decodeURIComponent(new URL(value,origin+'/').pathname);
  const section=sections.find(item=>path(item.url)===path(target.href));
  return section?section.href+target.hash:null;
 }catch{return null;}
}

// Native link actions (including Safari's Open Link and long-press menu) must
// point to the reader, not to an unextracted chapter on the website's filesystem.
export function readerChapterURL(target,volumeId,origin){
 const url=new URL('/books/reader.html',origin);
 const hash=target.indexOf('#');
 url.searchParams.set('id',volumeId);
 url.searchParams.set('section',hash<0?target:target.slice(0,hash));
 if(hash>=0)url.hash=target.slice(hash);
 return url.href;
}
