import * as pdfjsLib from "./pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc="./pdfjs/pdf.worker.mjs";

const params=new URLSearchParams(location.search);
const id=params.get("id")||"1";
const readingEnhancements=await fetch('/data/site-features.json').then(r=>r.ok?r.json():{}).then(f=>f.readingContinuity===true).catch(()=>false);
let chapterLocations=[],chapterControls=null;
if(readingEnhancements){const css=document.createElement('link');css.rel='stylesheet';css.href='/css/site-enhancements.css';document.head.append(css);}

const books={
    "1":"/books/pdf/Mystical Legends 1.pdf",
    "2":"/books/pdf/Mystical Legends 2.pdf",
    "3":"/books/pdf/Mystical Legends 3.pdf"
};

const url=books[id];

if(!url){
    document.body.innerHTML=
        "<h1 style='color:white;text-align:center'>Invalid Book ID</h1>";

    throw new Error("Invalid book id");
}

const viewer=document.getElementById("viewer");
const sidebar=document.getElementById("sidebar");
const outlineEl=document.getElementById("outline");
const overlay=document.getElementById("sidebarOverlay");

const scale=1.5;
const pageElements=new Map();

let pdf;
try { pdf=await pdfjsLib.getDocument(url).promise; }
catch(error) {
    document.getElementById('readingProgress').textContent='Book could not be loaded.';
    const notice=document.createElement('p');notice.textContent='Unable to open this book. ';
    const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>location.reload();notice.append(retry);viewer.append(notice);
    throw error;
}
const storageKey=`ml-reader-${id}`;
let saved={};
try { const value=JSON.parse(localStorage.getItem(storageKey)||'{}'); if(value && typeof value==='object' && !Array.isArray(value))saved=value; } catch {}
let currentPage=1;
function saveReading(){try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}}
function jump(page){const target=pageElements.get(Number(page));if(target)viewer.scrollTop=target.offsetTop-20;}
const resume=document.getElementById('resumeReading');
const resumePage=saved.page;
resume.hidden=!(resumePage>1 && resumePage<=pdf.numPages);
resume.onclick=()=>{jump(resumePage);closeSidebar();};
const validPage=page=>Number.isInteger(page) && page>=1 && page<=pdf.numPages;
saved.bookmarks=[...new Set((Array.isArray(saved.bookmarks)?saved.bookmarks:[saved.bookmark]).filter(validPage))].sort((a,b)=>a-b);
delete saved.bookmark;
const addBookmark=document.getElementById('saveBookmark');
function renderBookmarks(){
 const list=document.getElementById('bookmarkList');list.replaceChildren();
 document.getElementById('bookmarkEmpty').hidden=saved.bookmarks.length>0;
 for(const page of saved.bookmarks){
  const row=document.createElement('li');
  const go=document.createElement('button');go.type='button';go.className='bookmark-jump';go.textContent=`Page ${page}`;go.onclick=()=>{jump(page);closeSidebar();};
  const remove=document.createElement('button');remove.type='button';remove.className='bookmark-remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove bookmark for page ${page}`);
  remove.onclick=()=>{saved.bookmarks=saved.bookmarks.filter(p=>p!==page);saveReading();renderBookmarks();document.getElementById('bookmarkStatus').textContent=`Bookmark for page ${page} removed.`;addBookmark.focus();};
  row.append(go,remove);list.append(row);
 }
 addBookmark.disabled=saved.bookmarks.includes(currentPage);
 addBookmark.textContent=addBookmark.disabled?'Page saved':'Add page';
 addBookmark.setAttribute('aria-label',addBookmark.disabled?`Page ${currentPage} is bookmarked`:`Bookmark page ${currentPage}`);
}
addBookmark.onclick=()=>{if(!saved.bookmarks.includes(currentPage)){saved.bookmarks.push(currentPage);saved.bookmarks.sort((a,b)=>a-b);saveReading();renderBookmarks();document.getElementById('bookmarkStatus').textContent=`Page ${currentPage} bookmarked.`;}};
renderBookmarks();
let scrollFrame;
viewer.addEventListener('scroll',()=>{
 if(scrollFrame)return;
 scrollFrame=requestAnimationFrame(()=>{scrollFrame=null;
 const line=viewer.scrollTop+viewer.clientHeight*.35;
 for(const [number,element] of pageElements){if(element.offsetTop<=line)currentPage=number;else break;}
 saved.page=currentPage;
 if(readingEnhancements){const wrapper=pageElements.get(currentPage);saved.offset=wrapper?Math.max(0,Math.min(1,(viewer.scrollTop-wrapper.offsetTop)/wrapper.offsetHeight)):0;try{localStorage.setItem('ml-reading-current',JSON.stringify({id,page:currentPage,updatedAt:Date.now()}));}catch{}updateChapterControls();}
 saveReading();renderBookmarks();document.getElementById('readingProgress').textContent=`Page ${currentPage} of ${pdf.numPages}`;
 });
},{passive:true});

/* ---------------- Sidebar ---------------- */

function openSidebar(){
    sidebar.inert=false;
    sidebar.classList.add("open");
    document.getElementById("openSidebar").setAttribute("aria-expanded","true");
    document.getElementById("closeSidebar").focus();
    overlay.classList.add("show");
}

function closeSidebar(){
    sidebar.classList.remove("open");
    sidebar.inert=true;
    document.getElementById("openSidebar").setAttribute("aria-expanded","false");
    document.getElementById("openSidebar").focus();
    overlay.classList.remove("show");
}

document.getElementById("openSidebar").onclick=openSidebar;
document.getElementById("closeSidebar").onclick=closeSidebar;
overlay.onclick=closeSidebar;

document.addEventListener("keydown",e=>{
    if(e.key==="Escape" && sidebar.classList.contains("open"))closeSidebar();
    if(e.key==="Tab" && sidebar.classList.contains("open")){
      const controls=[...sidebar.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>!el.hidden && el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    }
});

/* ---------------- Destinations ---------------- */

async function getDestination(dest){
    if(!dest)return null;

    if(typeof dest==="string")
        return await pdf.getDestination(dest);

    return dest;
}

async function getDestinationPage(dest){
    dest=await getDestination(dest);

    if(!dest?.length)return null;

    const pageRef=dest[0];

    if(Number.isInteger(pageRef))
        return pageRef+1;

    try{
        return(await pdf.getPageIndex(pageRef))+1;
    }catch{
        return null;
    }
}

/* Instant jump */
async function goToDestination(dest){
    const pageNum=await getDestinationPage(dest);
    if(!pageNum)return;

    const pageEl=pageElements.get(pageNum);
    if(!pageEl)return;

    viewer.scrollTop=pageEl.offsetTop-20;

    closeSidebar();
}

/* ---------------- Outline ---------------- */

async function renderOutline(){
    const outline=await pdf.getOutline();

    if(!outline?.length){
        outlineEl.innerHTML=
            '<div class="empty-outline">No navigation headings found.</div>';

        return;
    }

    outlineEl.appendChild(createOutlineList(outline));
    if(readingEnhancements){
      const flatten=items=>items.flatMap(item=>[item,...flatten(item.items||[])]);
      const locations=await Promise.all(flatten(outline).filter(item=>item.dest).map(async item=>({page:await getDestinationPage(item.dest),title:item.title||'Section'})));
      chapterLocations=locations.filter(item=>Number.isInteger(item.page)&&item.page>0&&item.page<=pdf.numPages).sort((a,b)=>a.page-b.page).filter((item,i,list)=>i===0||item.page!==list[i-1].page);
    }
}

function createOutlineList(items){
    const ul=document.createElement("ul");
    ul.className="outline-list";

    for(const item of items){
        const li=document.createElement("li");
        li.className="outline-item";

        const button=document.createElement("button");
        button.className="outline-link";
        button.textContent=item.title||"Untitled";

        button.onclick=async()=>{
            if(item.dest){
                await goToDestination(item.dest);
            }else if(item.url){
                window.open(
                    item.url,
                    "_blank",
                    "noopener,noreferrer"
                );
            }
        };

        li.appendChild(button);

        if(item.items?.length)
            li.appendChild(createOutlineList(item.items));

        ul.appendChild(li);
    }

    return ul;
}

/* ---------------- PDF Links ---------------- */

async function renderAnnotations(page,viewport,layer){
    const annotations=await page.getAnnotations({
        intent:"display"
    });

    for(const annotation of annotations){
        if(
            annotation.subtype!=="Link"||
            !annotation.rect
        )continue;

        const rect=
            viewport.convertToViewportRectangle(annotation.rect);

        const left=Math.min(rect[0],rect[2]);
        const top=Math.min(rect[1],rect[3]);
        const width=Math.abs(rect[0]-rect[2]);
        const height=Math.abs(rect[1]-rect[3]);

        const link=document.createElement("a");

        link.className="annotation-link";

        link.style.left=`${left}px`;
        link.style.top=`${top}px`;
        link.style.width=`${width}px`;
        link.style.height=`${height}px`;

        /* External web link */
        if(annotation.url){
            link.href=annotation.url;
            link.target="_blank";
            link.rel="noopener noreferrer";
        }

        /* Internal PDF link */
        else if(annotation.dest){
            link.href="#";

            link.onclick=async e=>{
                e.preventDefault();
                e.stopPropagation();

                await goToDestination(annotation.dest);
            };
        }

        /* Unsupported PDF action */
        else if(annotation.action){
            link.href="#";

            link.onclick=e=>{
                e.preventDefault();
            };
        }

        layer.appendChild(link);
    }
}

/* ---------------- Page Rendering ---------------- */

const rendered=new Set();
let renderQueue=Promise.resolve();
async function paintPage(pageNum){
 const wrapper=pageElements.get(pageNum);
 try{
 const page=await pdf.getPage(pageNum);
 const viewport=page.getViewport({scale});
 const canvas=document.createElement('canvas');
 canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Book page ${pageNum}`);
 const layer=document.createElement('div');layer.className='annotation-layer';
 wrapper.replaceChildren(canvas,layer);
 await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
 await renderAnnotations(page,viewport,layer);
 }catch{
 rendered.delete(pageNum);
 const retry=document.createElement('button');retry.textContent=`Retry page ${pageNum}`;retry.onclick=()=>schedulePage(pageNum);wrapper.replaceChildren(retry);
 }
}
function schedulePage(pageNum){
 if(rendered.has(pageNum))return;
 rendered.add(pageNum);renderQueue=renderQueue.then(()=>paintPage(pageNum));
}
async function renderBook(){
 // Place lightweight page frames first; only nearby pages allocate canvases.
 for(let pageNum=1;pageNum<=pdf.numPages;pageNum++){
 const page=await pdf.getPage(pageNum),viewport=page.getViewport({scale});
 const wrapper=document.createElement('div');wrapper.className='pdf-page';wrapper.dataset.page=pageNum;
 wrapper.style.width=`${viewport.width}px`;wrapper.style.height=`${viewport.height}px`;
 wrapper.setAttribute('aria-label',`Page ${pageNum}`);viewer.append(wrapper);pageElements.set(pageNum,wrapper);
 }
 if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)schedulePage(Number(entry.target.dataset.page));},{root:viewer,rootMargin:'1000px 0px'});
 for(const wrapper of pageElements.values())observer.observe(wrapper);
 }else{for(const pageNum of pageElements.keys())schedulePage(pageNum);}
 document.getElementById('readingProgress').textContent=`Page 1 of ${pdf.numPages}`;
}

/* ---------------- Reading continuity ---------------- */
function updateChapterControls(){
 if(!chapterControls)return;
 const index=chapterLocations.findLastIndex(chapter=>chapter.page<=currentPage);
 chapterControls.previous.disabled=index<=0;chapterControls.next.disabled=index>=chapterLocations.length-1;
 chapterControls.label.textContent=chapterLocations[index]?.title||'Book sections';
 chapterControls.previous.onclick=()=>{if(index>0)jump(chapterLocations[index-1].page);};
 chapterControls.next.onclick=()=>{if(chapterLocations[index+1])jump(chapterLocations[index+1].page);};
}
function setupReadingContinuity(){
 if(!readingEnhancements)return;
 if(chapterLocations.length>1){const nav=document.createElement('nav');nav.className='ml-chapter-nav';nav.setAttribute('aria-label','Chapter navigation');const previous=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');previous.type=next.type='button';previous.textContent='← Previous';next.textContent='Next →';previous.setAttribute('aria-label','Previous chapter or section');next.setAttribute('aria-label','Next chapter or section');label.className='ml-chapter-label';nav.append(previous,label,next);document.getElementById('toolbar').append(nav);chapterControls={previous,next,label};updateChapterControls();}
 const restore=()=>{if(!validPage(Number(resumePage)))return;jump(resumePage);const target=pageElements.get(Number(resumePage));if(target&&Number.isFinite(saved.offset))viewer.scrollTop=target.offsetTop+Math.max(0,Math.min(1,saved.offset))*target.offsetHeight;};
 resume.onclick=()=>{restore();closeSidebar();};
 if(params.get('resume')==='1')restore();
}

/* ---------------- Start ---------------- */

await Promise.all([
    renderBook(),
    renderOutline()
]);
setupReadingContinuity();