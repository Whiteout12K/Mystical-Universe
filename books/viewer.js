import * as pdfjsLib from "./pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc="./pdfjs/pdf.worker.mjs";

const params=new URLSearchParams(location.search);
const id=params.get("id")||"1";

const books={
    "1":"./pdf/Mystical Legends 1.pdf",
    "2":"./pdf/Mystical Legends 2.pdf",
    "3":"./pdf/Mystical Legends 3.pdf"
};

const url=books[id];

if(!url){
    document.body.innerHTML="<h1 style='color:white;text-align:center'>Invalid Book ID</h1>";
    throw new Error("Invalid book id");
}

const viewer=document.getElementById("viewer");
const pages=document.getElementById("pages");
const sidebar=document.getElementById("sidebar");
const outlineEl=document.getElementById("outline");
const overlay=document.getElementById("sidebarOverlay");
const currentPageEl=document.getElementById("currentPage");
const totalPagesEl=document.getElementById("totalPages");
const zoomLevelEl=document.getElementById("zoomLevel");

const BASE_SCALE=1.5;
const MIN_ZOOM=.5;
const MAX_ZOOM=4;
const ZOOM_STEP=.15;

let zoom=1;
let fitZoom=1;
let pinchStartDistance=0;
let pinchStartZoom=1;
let currentPage=1;

const pageElements=new Map();
const pdf=await pdfjsLib.getDocument(url).promise;

totalPagesEl.textContent=pdf.numPages;

/* ---------------- Sidebar ---------------- */

function openSidebar(){
    sidebar.classList.add("open");
    overlay.classList.add("show");
}

function closeSidebar(){
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
}

document.getElementById("openSidebar").onclick=openSidebar;
document.getElementById("closeSidebar").onclick=closeSidebar;
overlay.onclick=closeSidebar;

document.addEventListener("keydown",e=>{
    if(e.key==="Escape")closeSidebar();
});

/* ---------------- Destinations ---------------- */

async function getDestination(dest){
    if(!dest)return null;
    return typeof dest==="string"?await pdf.getDestination(dest):dest;
}

async function getDestinationPage(dest){
    dest=await getDestination(dest);
    if(!dest?.length)return null;

    const ref=dest[0];

    if(Number.isInteger(ref))
        return ref+1;

    try{
        return(await pdf.getPageIndex(ref))+1;
    }catch{
        return null;
    }
}

/* Teleport instantly */
async function goToDestination(dest){
    const pageNum=await getDestinationPage(dest);
    const pageEl=pageElements.get(pageNum);

    if(!pageEl)return;

    const top=pageEl.offsetTop*zoom;

    viewer.scrollTop=Math.max(0,top-60);

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
            if(item.dest)
                await goToDestination(item.dest);
            else if(item.url)
                window.open(item.url,"_blank","noopener,noreferrer");
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
    const annotations=await page.getAnnotations({intent:"display"});

    for(const annotation of annotations){
        if(annotation.subtype!=="Link"||!annotation.rect)
            continue;

        const rect=viewport.convertToViewportRectangle(annotation.rect);
        const left=Math.min(rect[0],rect[2]);
        const top=Math.min(rect[1],rect[3]);
        const width=Math.abs(rect[0]-rect[2]);
        const height=Math.abs(rect[1]-rect[3]);

        const link=document.createElement("a");
        link.className="annotation-link";

        Object.assign(link.style,{
            left:`${left}px`,
            top:`${top}px`,
            width:`${width}px`,
            height:`${height}px`
        });

        if(annotation.url){
            link.href=annotation.url;
            link.target="_blank";
            link.rel="noopener noreferrer";
        }else if(annotation.dest){
            link.href="#";

            link.onclick=async e=>{
                e.preventDefault();
                e.stopPropagation();
                await goToDestination(annotation.dest);
            };
        }else{
            link.href="#";
            link.onclick=e=>e.preventDefault();
        }

        layer.appendChild(link);
    }
}

/* ---------------- Render ---------------- */

async function renderPage(pageNum){
    const page=await pdf.getPage(pageNum);
    const viewport=page.getViewport({scale:BASE_SCALE});

    const wrapper=document.createElement("div");
    wrapper.className="pdf-page";
    wrapper.dataset.page=pageNum;
    wrapper.style.width=`${viewport.width}px`;
    wrapper.style.height=`${viewport.height}px`;

    const canvas=document.createElement("canvas");
    const ctx=canvas.getContext("2d",{alpha:false});

    const outputScale=window.devicePixelRatio||1;

    canvas.width=Math.floor(viewport.width*outputScale);
    canvas.height=Math.floor(viewport.height*outputScale);

    canvas.style.width=`${viewport.width}px`;
    canvas.style.height=`${viewport.height}px`;

    const annotationLayer=document.createElement("div");
    annotationLayer.className="annotation-layer";

    wrapper.append(canvas,annotationLayer);
    pages.appendChild(wrapper);
    pageElements.set(pageNum,wrapper);

    await page.render({
        canvasContext:ctx,
        viewport,
        transform:outputScale!==1?
            [outputScale,0,0,outputScale,0,0]:
            null
    }).promise;

    await renderAnnotations(page,viewport,annotationLayer);
}

async function renderBook(){
    for(let i=1;i<=pdf.numPages;i++)
        await renderPage(i);
}

/* ---------------- Zoom ---------------- */

function clamp(value,min,max){
    return Math.min(max,Math.max(min,value));
}

function updateZoomDisplay(){
    zoomLevelEl.textContent=`${Math.round(zoom*100)}%`;
}

function applyZoom(newZoom,centerX=null,centerY=null){
    newZoom=clamp(newZoom,MIN_ZOOM,MAX_ZOOM);

    if(newZoom===zoom)return;

    const oldZoom=zoom;

    centerX??=viewer.clientWidth/2;
    centerY??=viewer.clientHeight/2;

    const contentX=(viewer.scrollLeft+centerX)/oldZoom;
    const contentY=(viewer.scrollTop+centerY)/oldZoom;

    zoom=newZoom;

    pages.style.transform=`scale(${zoom})`;

    /*
     * Transform does not change layout dimensions,
     * so give the viewer the scaled dimensions.
     */
    const firstPage=pageElements.get(1);

    if(firstPage){
        pages.style.width=
            `${Math.max(viewer.clientWidth,firstPage.offsetWidth*zoom)}px`;

        pages.style.height=
            `${pages.scrollHeight*zoom}px`;
    }

    requestAnimationFrame(()=>{
        viewer.scrollLeft=contentX*zoom-centerX;
        viewer.scrollTop=contentY*zoom-centerY;

        updateZoomDisplay();
        updateCurrentPage();
    });
}

function fitToWidth(){
    const firstPage=pageElements.get(1);
    if(!firstPage)return;

    const available=Math.max(100,viewer.clientWidth-20);

    fitZoom=clamp(
        available/firstPage.offsetWidth,
        MIN_ZOOM,
        MAX_ZOOM
    );

    zoom=fitZoom;

    pages.style.transform=`scale(${zoom})`;
    pages.style.width=
        `${Math.max(viewer.clientWidth,firstPage.offsetWidth*zoom)}px`;
    pages.style.height=`${pages.scrollHeight*zoom}px`;

    viewer.scrollLeft=0;

    updateZoomDisplay();
}

/* Buttons */
document.getElementById("zoomIn").onclick=()=>{
    applyZoom(zoom+ZOOM_STEP);
};

document.getElementById("zoomOut").onclick=()=>{
    applyZoom(zoom-ZOOM_STEP);
};

document.getElementById("fitWidth").onclick=fitToWidth;

/* Desktop Ctrl/Cmd + wheel zoom */
viewer.addEventListener("wheel",e=>{
    if(!e.ctrlKey&&!e.metaKey)return;

    e.preventDefault();

    const rect=viewer.getBoundingClientRect();

    const x=e.clientX-rect.left;
    const y=e.clientY-rect.top;

    const amount=e.deltaY<0?ZOOM_STEP:-ZOOM_STEP;

    applyZoom(
        zoom+amount,
        x,
        y
    );
},{passive:false});

/* ---------------- Mobile Pinch Zoom ---------------- */

function touchDistance(touches){
    const a=touches[0];
    const b=touches[1];

    return Math.hypot(
        b.clientX-a.clientX,
        b.clientY-a.clientY
    );
}

function touchCenter(touches){
    return{
        x:(touches[0].clientX+touches[1].clientX)/2,
        y:(touches[0].clientY+touches[1].clientY)/2
    };
}

viewer.addEventListener("touchstart",e=>{
    if(e.touches.length!==2)return;

    pinchStartDistance=touchDistance(e.touches);
    pinchStartZoom=zoom;
},{passive:false});

viewer.addEventListener("touchmove",e=>{
    if(e.touches.length!==2||!pinchStartDistance)return;

    e.preventDefault();

    const distance=touchDistance(e.touches);
    const center=touchCenter(e.touches);
    const rect=viewer.getBoundingClientRect();

    const ratio=distance/pinchStartDistance;

    applyZoom(
        pinchStartZoom*ratio,
        center.x-rect.left,
        center.y-rect.top
    );
},{passive:false});

viewer.addEventListener("touchend",e=>{
    if(e.touches.length<2)
        pinchStartDistance=0;
});

/* ---------------- Page Progress ---------------- */

function updateCurrentPage(){
    if(!pageElements.size)return;

    /*
     * Point used to determine which page the
     * reader is currently looking at.
     */
    const target=
        viewer.scrollTop+
        viewer.clientHeight*.42;

    let closest=1;
    let closestDistance=Infinity;

    for(const [num,page] of pageElements){
        const top=page.offsetTop*zoom;
        const height=page.offsetHeight*zoom;
        const center=top+height/2;

        const distance=Math.abs(center-target);

        if(distance<closestDistance){
            closestDistance=distance;
            closest=num;
        }
    }

    if(closest!==currentPage){
        currentPage=closest;
        currentPageEl.textContent=currentPage;
    }
}

viewer.addEventListener("scroll",()=>{
    requestAnimationFrame(updateCurrentPage);
},{passive:true});

/* ---------------- Resize ---------------- */

let resizeTimer;

window.addEventListener("resize",()=>{
    clearTimeout(resizeTimer);

    resizeTimer=setTimeout(()=>{
        /*
         * Preserve fit-width behavior when the
         * phone rotates or browser changes size.
         */
        if(Math.abs(zoom-fitZoom)<.03)
            fitToWidth();

        updateCurrentPage();
    },100);
});

/* ---------------- Start ---------------- */

await Promise.all([
    renderBook(),
    renderOutline()
]);

/* Default = document width matches screen */
fitToWidth();
updateCurrentPage();