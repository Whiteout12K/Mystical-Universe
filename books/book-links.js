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
