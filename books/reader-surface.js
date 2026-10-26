// Visible, selectable book content belongs to the top-level document. EPUB.js
// keeps an inert frame solely for pagination and CFIs, never for touch input.
export class ReaderSurface{
 constructor(host,{navigate}){
  this.host=host;this.root=host.attachShadow({mode:'open'});this.document=null;this.signature='';
  this.fonts=document.createElement('style');this.fonts.dataset.readerFonts='';document.head.append(this.fonts);
  this.root.addEventListener('click',event=>{
   const anchor=event.composedPath().find(node=>node?.matches?.('a[data-epub-target]'));
   if(!anchor||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();event.stopPropagation();navigate(anchor.dataset.epubTarget);
  });
 }
 ready(){return document.fonts.ready;}
 sync(contents,frame,signature){
  if(!contents||!frame)return;
  const source=contents.document,rect=frame.getBoundingClientRect(),box=this.host.getBoundingClientRect();
  // Frame dimensions and inline column styles change after resizing/pagination.
  signature=JSON.stringify([signature,rect.width,rect.height,source.documentElement.getAttribute('style'),source.body.getAttribute('style')]);
  if(this.document!==source||this.signature!==signature){
   const css=[],fonts=[];
   const rules=list=>{for(const rule of list){
    if(rule.type===4){if(source.defaultView.matchMedia(rule.conditionText).matches)rules(rule.cssRules);}
    else if(rule.type===5)fonts.push(rule.cssText);
    else css.push(rule.cssText);
   }};
   for(const sheet of source.styleSheets)rules(sheet.cssRules);
   const viewportUnits=text=>text.replace(/(-?[\d.]+)(vh|vw)\b/g,(_,n,unit)=>Number(n)*(unit==='vh'?source.defaultView.innerHeight:source.defaultView.innerWidth)/100+'px');
   const copy=document.importNode(source.documentElement,true);
   // Never execute or import active content from a book into the website.
   for(const node of copy.querySelectorAll('script,iframe,object,embed,base,link,style,meta[http-equiv]'))node.remove();
   for(const node of [copy,...copy.querySelectorAll('*')])for(const attr of [...node.attributes])if(/^on/i.test(attr.name)||attr.name==='srcdoc'||(/^(href|xlink:href|src|action|formaction)$/i.test(attr.name)&&/^\s*(javascript|vbscript):/i.test(attr.value)))node.removeAttribute(attr.name);
   // A nested body does not propagate overflow to the viewport like a real
   // document body. Let its later columns paint; the host clips the active page.
   const style=document.createElement('style');style.textContent=viewportUnits(css.join('\n'))+'\nhtml{display:block!important;margin:0!important}body{overflow:visible!important;-webkit-touch-callout:default!important;-webkit-user-select:text!important;user-select:text!important}';
   copy.querySelector('head')?.append(style);
   const fontCSS=fonts.join('\n');if(this.fonts.textContent!==fontCSS)this.fonts.textContent=fontCSS;
   // rem inside the visible book uses the same text size as the EPUB frame.
   document.documentElement.style.fontSize=source.documentElement.style.fontSize;
   this.root.replaceChildren(copy);this.copy=copy;this.document=source;this.signature=signature;
  }
  this.copy.style.width=rect.width+'px';this.copy.style.height=rect.height+'px';
  this.copy.style.transform=`translate(${rect.left-box.left}px,${rect.top-box.top}px)`;
  this.copy.style.transformOrigin='0 0';
 }
}
