// Restrict authoring tools to the same loopback hosts as the wiki editor.
export const isLocalReader=hostname=>['localhost','127.0.0.1','::1','[::1]'].includes(hostname);
let libraries;
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('The local PDF library could not load.'));};document.head.append(script);});}
async function loadLibraries(){
 if(!libraries)libraries=loadScript('/books/vendor/pdf-export/jspdf.umd.min.js').catch(error=>{libraries=null;throw error;});
 await libraries;
}
// Read the real laid-out glyph ranges, including column translations. Only text
// on this page enters its PDF text layer; the rest of the chapter stays out.
export function visiblePageText(surface){
 const box=surface.host.getBoundingClientRect(),doc=surface.copy.ownerDocument;
 const metrics=doc.createElement('canvas').getContext('2d');
 const walker=doc.createTreeWalker(surface.copy.querySelector('body'),4),range=doc.createRange(),runs=[];
 const visible=rect=>rect.width>0&&rect.height>0&&rect.left>=box.left-.5&&rect.right<=box.right+.5&&rect.top+rect.height/2>=box.top&&rect.top+rect.height/2<box.bottom;
 let node;
 while((node=walker.nextNode())){
  if(!node.textContent.trim()||node.parentElement.closest('script,style,noscript'))continue;
  const style=getComputedStyle(node.parentElement);if(style.visibility!=='visible'||style.display==='none')continue;
  range.selectNodeContents(node);if(![...range.getClientRects()].some(rect=>rect.right>box.left&&rect.left<box.right&&rect.bottom>box.top&&rect.top<box.bottom))continue;
  metrics.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const descent=metrics.measureText('Hg').fontBoundingBoxDescent||0;
  const add=(text,rect)=>{if(visible(rect))runs.push({text,x:rect.left-box.left,y:rect.bottom-box.top-descent,width:rect.width,size:parseFloat(style.fontSize),family:style.fontFamily,style:(Number(style.fontWeight)>=600?'bold':'')+(style.fontStyle==='italic'?'italic':'' )||'normal',color:style.color,underline:style.textDecorationLine.includes('underline')});};
  for(const match of node.textContent.matchAll(/\S+/gu)){
   range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
   const rects=[...range.getClientRects()];
   if(rects.length===1)add(match[0],rects[0]);
   else{
    // Long words may themselves wrap across lines or page columns.
    let offset=match.index;
    for(const character of match[0]){range.setStart(node,offset);offset+=character.length;range.setEnd(node,offset);for(const rect of range.getClientRects())add(character,rect);}
   }
  }
 }
 return runs;
}
export const MAX_PDF_BYTES=5_000_000;
async function collectFonts(surface,fonts){
 for(const face of surface.fonts.textContent.match(/@font-face\s*{[^}]+}/g)||[]){
  const url=face.match(/url\(["']?([^"')]+)["']?\)/)?.[1];if(!url||fonts.has(url))continue;
  const family=face.match(/font-family:\s*["']?([^;"'}]+)/)?.[1]?.trim();
  const style=(/font-weight:\s*(bold|[6-9]00)/.test(face)?'bold':'')+(/font-style:\s*(italic|oblique)/.test(face)?'italic':'')||'normal';
  const response=await fetch(url);if(!response.ok)throw Error('The book font could not load.');
  const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
  for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  fonts.set(url,{family,style,name:'ReaderFont'+fonts.size,data:btoa(binary)});
 }
}
function pdfFont(pdf,run,fonts){
 const primary=run.family.split(',')[0].replace(/["']/g,'').trim();
 const font=[...fonts.values()].find(font=>font.family===primary&&font.style===run.style)||[...fonts.values()].find(font=>font.family===primary);
 pdf.setFont(font?.name||(/Arial|sans-serif|system-ui/i.test(run.family)?'helvetica':'times'),font?.style||run.style);
}
function color(value){return (value.match(/[\d.]+/g)||['0','0','0']).slice(0,3).map(Number);}
export function addSelectableText(pdf,runs,fonts){
 for(const run of runs){
  pdfFont(pdf,run,fonts);pdf.setFontSize(run.size*.75);pdf.setTextColor(...color(run.color));
  const natural=pdf.getTextWidth(run.text);if(!natural)continue;
  pdf.text(run.text,run.x*.75,run.y*.75,{baseline:'alphabetic',renderingMode:'fill',horizontalScale:run.width*.75/natural});
  if(run.underline){pdf.setDrawColor(...color(run.color));pdf.setLineWidth(.35);pdf.line(run.x*.75,(run.y+1.5)*.75,(run.x+run.width)*.75,(run.y+1.5)*.75);}
 }
}
function pageImages(surface,images){
 const box=surface.host.getBoundingClientRect(),result=[];
 for(const image of surface.copy.querySelectorAll('img')){
  const rect=image.getBoundingClientRect(),style=getComputedStyle(image);
  if(!rect.width||!rect.height||rect.right<=box.left||rect.left>=box.right||rect.bottom<=box.top||rect.top>=box.bottom||style.visibility==='hidden')continue;
  const url=image.currentSrc||image.src;if(!images.has(url))images.set(url,image);
  result.push({url,x:rect.left-box.left,y:rect.top-box.top,width:rect.width,height:rect.height});
 }
 return result;
}
function optimizedImages(images,maxPixels,quality,background){
 const result=new Map();let index=0;
 for(const [url,image]of images){
  const scale=Math.min(1,maxPixels/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  result.set(url,{data:canvas.toDataURL('image/jpeg',quality),alias:'illustration-'+index++});canvas.width=canvas.height=0;
 }
 return result;
}
export async function buildCompactPDF({pages,fonts,images,width,height,title,checkLayout,progress}){
 const format=[width*.75,height*.75],orientation=width>height?'landscape':'portrait';
 // Rebuild only the illustrations if needed; vector text is never rasterized.
 for(const [pixels,quality]of [[1600,.82],[1200,.72],[900,.6],[640,.5]]){
  checkLayout();const assets=optimizedImages(images,pixels,quality,pages[0].background);
  const pdf=new window.jspdf.jsPDF({unit:'pt',format,orientation,compress:true,putOnlyUsedFonts:true,floatPrecision:3});
  pdf.setProperties({title,creator:'Mystical Legends EPUB Reader'});
  for(const font of fonts.values()){pdf.addFileToVFS(font.name+'.ttf',font.data);pdf.addFont(font.name+'.ttf',font.name,font.style);}
  for(let index=0;index<pages.length;index++){
   checkLayout();if(index)pdf.addPage(format,orientation);const page=pages[index];
   pdf.setFillColor(...color(page.background));pdf.rect(0,0,...format,'F');
   pdf.saveGraphicsState();pdf.rect(0,0,...format,null);pdf.clip();pdf.discardPath();
   for(const image of page.images){const asset=assets.get(image.url);pdf.addImage(asset.data,'JPEG',image.x*.75,image.y*.75,image.width*.75,image.height*.75,asset.alias);}
   addSelectableText(pdf,page.text,fonts);pdf.restoreGraphicsState();
   if(index%30===0){progress(index+1,pages.length,'Writing PDF');await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const blob=pdf.output('blob');
  if(blob.size<=MAX_PDF_BYTES)return {blob,bytes:blob.size};
 }
 throw Error('This layout could not fit within 5 MB. The illustrations could not be compressed enough.');
}
export async function exportReaderPDF({hostname,title,book,fontFamily='"Crimson Text", Georgia, serif',checkLayout,progress}){
 if(!isLocalReader(hostname))throw Error('PDF export is only available on localhost.');
 await loadLibraries();checkLayout();
 const {createPrintLayout}=await import('./reader-print-layout.js');
 const print=await createPrintLayout(book,fontFamily);
 try{
  const {rendition,surface,width,height}=print,pages=[],fonts=new Map(),images=new Map(),sections=book.spine.spineItems;
  for(const section of sections){
   checkLayout();await rendition.display(section.href);await print.wait();
   let location=await rendition.currentLocation();const total=location.start.displayed.total;
   for(let page=1;page<=total;page++){
    checkLayout();location=await rendition.currentLocation();
    if(location.start.index!==section.index||location.start.displayed.page!==page)throw Error('The print pagination changed. Please retry.');
    print.sync();await surface.ready();await collectFonts(surface,fonts);
    const text=visiblePageText(surface),art=pageImages(surface,images);
    if(text.length||art.length)pages.push({text,images:art,background:'rgb(255,255,255)'});
    progress(section.index+1,sections.length,`Typesetting A6 · ${pages.length} pages`);
    if(page<total){await rendition.next();await print.wait();}
   }
  }
  if(!pages.length)throw Error('No printable pages were found.');
  const {blob,bytes}=await buildCompactPDF({pages,fonts,images,width,height,title,checkLayout,progress});
  checkLayout();const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=(title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim()||'book')+'.pdf';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  return {bytes,pages:pages.length};
 }finally{print.cleanup();}
}
