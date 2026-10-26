import {el,link,json,saved,readyWhen} from './core.js';
export async function init(){
 const homepage=['/','/index','/index.html'].includes(location.pathname);
 if(!homepage&&!['/books_main','/books_main.html'].includes(location.pathname))return;
 const {books}=await json('/data/books.json');
 const row=el('aside',{'aria-label':'Continue reading',class:'ml-reading-continue'});
 function refresh(){
  const entry=saved('ml-reading-current',null);
  const book=books.find(b=>b.id===String(entry?.id)&&b.available);
  row.replaceChildren();row.hidden=!book;if(!book)return;
  // The EPUB reader resumes its per-volume CFI; old PDF page numbers are not EPUB pages.
  const resume=link('Continue Vol '+book.id+': '+book.title,book.path);resume.className='ml-continue';row.append(resume);
 }
 refresh();
 readyWhen(homepage?'#reading-continue':'main,.news-section',host=>homepage?host.append(row):host.before(row));
 window.addEventListener('pageshow',refresh);
 window.addEventListener('storage',event=>{if(event.key==='ml-reading-current'||event.key===null)refresh();});
}
