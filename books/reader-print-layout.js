import {ReaderSurface} from './reader-surface.js';
// A6/bunko trim. CSS pixels and PDF points both derive from these physical sizes.
export const PRINT_PAGE={width:105*96/25.4,height:148*96/25.4,margin:12*96/25.4,fontSize:11*96/72};
export function prepareIllustrations(doc){
 const contentHeight=PRINT_PAGE.height-2*PRINT_PAGE.margin-1;
 for(const image of doc.images){
  if(image.naturalHeight<image.naturalWidth*1.1)continue;
  const block=image.closest('p,figure')||image.parentElement;
  if(block.textContent.trim()||block.querySelectorAll('img').length!==1)continue;
  block.classList.add('print-illustration');
  const heading=block.previousElementSibling;
  if(heading?.matches('h1,h2,h3,h4,h5,h6')){block.prepend(heading);block.classList.add('print-with-heading');}
  block.style.setProperty('--print-image-height',(contentHeight-(block.classList.contains('print-with-heading')?80:0))+'px');
 }
}
async function waitForAssets(rendition){
 let timeout;
 try{await Promise.race([
  Promise.all(rendition.getContents().flatMap(content=>[content.document.fonts.ready,...[...content.document.images].map(image=>image.complete?(image.naturalWidth?Promise.resolve():Promise.reject(Error('A book illustration could not load.'))):image.decode())])),
  new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('The print fonts or illustrations could not load.')),15000);})
 ]);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}finally{clearTimeout(timeout);}
}
export async function createPrintLayout(book,fontFamily){
 const {width,height,margin,fontSize}=PRINT_PAGE,originalFont=document.documentElement.style.fontSize,originalRendition=book.rendition;
 const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.inert=true;
 host.style.cssText=`position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;overflow:hidden`;
 const frames=document.createElement('div'),page=document.createElement('article');
 frames.style.cssText=`width:${width}px;height:${height}px`;page.style.cssText='position:absolute;inset:0;overflow:hidden;margin:0';
 host.append(frames,page);document.body.append(host);
 const surface=new ReaderSurface(page,{navigate:()=>{}});
 // A dedicated rendition leaves the visible reader, its CFIs and page cache alone.
 const rendition=book.renderTo(frames,{width,height,flow:'paginated',spread:'none',manager:'default',gap:margin*2,allowScriptedContent:false});
 const cleanup=()=>{rendition.destroy();host.remove();surface.fonts.remove();document.documentElement.style.fontSize=originalFont;book.rendition=originalRendition;};
 rendition.hooks.content.register(async content=>{
  const doc=content.document,root=doc.documentElement;root.dataset.readerMode='print';
  root.style.setProperty('font-size',fontSize+'px','important');
  root.style.setProperty('--reader-font',fontFamily);root.style.setProperty('--reader-leading','1.45');root.style.setProperty('--reader-ink','#222222');root.style.setProperty('--reader-link','#222222');
  const style=doc.createElement('style');style.textContent=`
   html,body{background:#fff!important;color:#222!important}
   body{padding-top:${margin}px!important;padding-bottom:${margin}px!important}
   p{margin-bottom:.55em!important;orphans:2;widows:2}
   h1,h2,h3,h4,h5,h6{margin-top:.8em!important;break-after:avoid}
   body>h1:first-child,body>h2:first-child{margin-top:0!important}
   .reader-image{break-inside:avoid;max-height:${height-2*margin-1}px!important}
   .reader-image img{max-height:${height-2*margin-1}px!important}
   .print-illustration{display:flex!important;flex-direction:column;align-items:center;justify-content:center;width:100%!important;height:${height-2*margin-1}px!important;margin:0!important;padding:0!important;text-indent:0!important;break-before:column;break-after:column;break-inside:avoid}
   .print-illustration:first-child{break-before:auto}
   .print-illustration h1,.print-illustration h2,.print-illustration h3{flex:none;margin:0 0 1em!important}
   .print-illustration .reader-image{display:flex!important;align-items:center;justify-content:center;width:100%!important;margin:0!important;max-height:var(--print-image-height)!important}
   .print-illustration img{max-width:100%!important;max-height:var(--print-image-height)!important;width:auto!important;height:auto!important;object-fit:contain!important}
  `;doc.head.append(style);
  await Promise.all([...doc.images].map(image=>image.complete?Promise.resolve():image.decode()));
  prepareIllustrations(doc);
 });
 try{await rendition.started;}catch(error){cleanup();throw error;}
 return {rendition,surface,width,height,
  async wait(){await waitForAssets(rendition);},
  sync(){const content=rendition.getContents()[0];surface.sync(content,content.document.defaultView.frameElement,'print-a6-v1');},
  cleanup};
}
