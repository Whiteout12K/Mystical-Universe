import * as pdfjsLib from "./pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc="./pdfjs/pdf.worker.mjs";

/* ---------------- Book ---------------- */

const params=new URLSearchParams(location.search);
const id=params.get("id")||"1";

const books={
    "1":"./pdf/Mystical Legends 1.pdf",
    "2":"./pdf/Mystical Legends 2.pdf",
    "3":"./pdf/Mystical Legends 3.pdf"
};

const url=books[id];

if(!url){
    document.body.innerHTML=
        "<h1 style='color:white;text-align:center'>Invalid Book ID</h1>";
    throw new Error("Invalid book id");
}

/* ---------------- Elements ---------------- */

const viewer=document.getElementById("viewer");
const pages=document.getElementById("pages");
const sidebar=document.getElementById("sidebar");
const outlineEl=document.getElementById("outline");
const overlay=document.getElementById("sidebarOverlay");

const currentPageEl=document.getElementById("currentPage");
const totalPagesEl=document.getElementById("totalPages");

const zoomSlider=document.getElementById("zoomSlider");
const zoomLevel=document.getElementById("zoomLevel");

/* ---------------- Settings ---------------- */

const BASE_SCALE=1.5;
const MIN_ZOOM=.5;
const MAX_ZOOM=4;

let zoom=1;
let fitZoom=1;
let currentPage=1;
let basePagesWidth=0;
let basePagesHeight=0;

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

/* ---------------- PDF Destinations ---------------- */

async function getDestination(dest){
    if(!dest)return null;

    return typeof dest==="string"
        ?await pdf.getDestination(dest)
        :dest;
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

/* Instant teleport */
async function goToDestination(dest){
    const pageNum=await getDestinationPage(dest);
    const page=pageElements.get(pageNum);

    if(!page)return;

    viewer.scrollTop=Math.max(
        0,
        page.offsetTop*zoom-60
    );

    currentPage=pageNum;
    currentPageEl.textContent=pageNum;

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

    outlineEl.appendChild(
        createOutlineList(outline)
    );
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
                window.open(
                    item.url,
                    "_blank",
                    "noopener,noreferrer"
                );
        };

        li.appendChild(button);

        if(item.items?.length)
            li.appendChild(
                createOutlineList(item.items)
            );

        ul.appendChild(li);
    }

    return ul;
}

/* ---------------- Embedded PDF Links ---------------- */

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
            viewport.convertToViewportRectangle(
                annotation.rect
            );

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

        /* External URL */
        if(annotation.url){
            link.href=annotation.url;
            link.target="_blank";
            link.rel="noopener noreferrer";
        }

        /* Internal heading/page */
        else if(annotation.dest){
            link.href="#";

            link.onclick=async e=>{
                e.preventDefault();
                e.stopPropagation();

                await goToDestination(
                    annotation.dest
                );
            };
        }

        else{
            link.href="#";
            link.onclick=e=>e.preventDefault();
        }

        layer.appendChild(link);
    }
}

/* ---------------- Page Rendering ---------------- */

async function renderPage(pageNum){
    const page=await pdf.getPage(pageNum);

    const viewport=page.getViewport({
        scale:BASE_SCALE
    });

    const wrapper=document.createElement("div");

    wrapper.className="pdf-page";
    wrapper.dataset.page=pageNum;

    wrapper.style.width=`${viewport.width}px`;
    wrapper.style.height=`${viewport.height}px`;

    const canvas=document.createElement("canvas");

    const ctx=canvas.getContext(
        "2d",
        {alpha:false}
    );

    const outputScale=
        window.devicePixelRatio||1;

    canvas.width=Math.floor(
        viewport.width*outputScale
    );

    canvas.height=Math.floor(
        viewport.height*outputScale
    );

    canvas.style.width=`${viewport.width}px`;
    canvas.style.height=`${viewport.height}px`;

    const annotationLayer=
        document.createElement("div");

    annotationLayer.className="annotation-layer";

    wrapper.append(
        canvas,
        annotationLayer
    );

    pages.appendChild(wrapper);

    pageElements.set(
        pageNum,
        wrapper
    );

    await page.render({
        canvasContext:ctx,
        viewport,
        transform:outputScale!==1
            ?[outputScale,0,0,outputScale,0,0]
            :null
    }).promise;

    await renderAnnotations(
        page,
        viewport,
        annotationLayer
    );
}

async function renderBook(){
    for(
        let pageNum=1;
        pageNum<=pdf.numPages;
        pageNum++
    ){
        await renderPage(pageNum);
    }

    const firstPage=pageElements.get(1);

    basePagesWidth=firstPage?.offsetWidth||1;
    basePagesHeight=pages.scrollHeight;
}

/* ---------------- Zoom ---------------- */

function clamp(value,min,max){
    return Math.min(
        max,
        Math.max(min,value)
    );
}

function updateZoomUI(){
    zoomSlider.value=
        Math.round(zoom*100);

    zoomLevel.textContent=
        `${Math.round(zoom*100)}%`;
}

/*
 * Only this function changes the PDF zoom.
 * It is called by the slider or fit-width button.
 */
function applyZoom(newZoom){
    newZoom=clamp(
        newZoom,
        MIN_ZOOM,
        MAX_ZOOM
    );

    const oldZoom=zoom;

    /*
     * Keep current reading position while
     * changing zoom.
     */
    const centerX=
        viewer.scrollLeft+
        viewer.clientWidth/2;

    const centerY=
        viewer.scrollTop+
        viewer.clientHeight/2;

    const contentX=centerX/oldZoom;
    const contentY=centerY/oldZoom;

    zoom=newZoom;

    pages.style.transform=
        `scale(${zoom})`;

    pages.style.width=
        `${Math.max(
            viewer.clientWidth,
            basePagesWidth*zoom
        )}px`;

    pages.style.height=
        `${basePagesHeight*zoom}px`;

    updateZoomUI();

    requestAnimationFrame(()=>{
        viewer.scrollLeft=Math.max(
            0,
            contentX*zoom-
            viewer.clientWidth/2
        );

        viewer.scrollTop=Math.max(
            0,
            contentY*zoom-
            viewer.clientHeight/2
        );

        updateCurrentPage();
    });
}

/* Default document width = screen width */
function fitToWidth(){
    const firstPage=pageElements.get(1);
    if(!firstPage)return;

    const available=
        Math.max(
            100,
            viewer.clientWidth-20
        );

    fitZoom=clamp(
        available/firstPage.offsetWidth,
        MIN_ZOOM,
        MAX_ZOOM
    );

    zoom=fitZoom;

    pages.style.transform=
        `scale(${zoom})`;

    pages.style.width=
        `${Math.max(
            viewer.clientWidth,
            basePagesWidth*zoom
        )}px`;

    pages.style.height=
        `${basePagesHeight*zoom}px`;

    viewer.scrollLeft=0;

    updateZoomUI();
    updateCurrentPage();
}

/* ---------------- Zoom Bar ---------------- */

/*
 * Slider is the main manual zoom control.
 */
zoomSlider.addEventListener("input",()=>{
    applyZoom(
        Number(zoomSlider.value)/100
    );
});

/* Prevent slider touch from scrolling viewer */
zoomSlider.addEventListener(
    "touchmove",
    e=>e.stopPropagation(),
    {passive:true}
);

/* Fit width reset */
document.getElementById("fitWidth").onclick=()=>{
    fitToWidth();
};

/* ---------------- Disable Other Zoom Methods ---------------- */

/* Ctrl/Cmd + wheel */
viewer.addEventListener("wheel",e=>{
    if(e.ctrlKey||e.metaKey)
        e.preventDefault();
},{passive:false});

/* Pinch zoom */
viewer.addEventListener("touchmove",e=>{
    if(e.touches.length>1)
        e.preventDefault();
},{passive:false});

/* Safari gesture zoom */
["gesturestart","gesturechange","gestureend"]
.forEach(type=>{
    viewer.addEventListener(
        type,
        e=>e.preventDefault()
    );
});

/* Ctrl/Cmd +/- */
document.addEventListener("keydown",e=>{
    if(
        (e.ctrlKey||e.metaKey)&&
        ["+","-","=","0"].includes(e.key)
    ){
        e.preventDefault();
    }
});

/* ---------------- Page Progress ---------------- */

function updateCurrentPage(){
    if(!pageElements.size)return;

    /*
     * Point about 40% down the screen.
     * Whichever page contains/is closest to
     * this point becomes the current page.
     */
    const target=
        viewer.scrollTop+
        viewer.clientHeight*.4;

    let closest=1;
    let distance=Infinity;

    for(const [num,page] of pageElements){
        const top=page.offsetTop*zoom;
        const bottom=
            top+
            page.offsetHeight*zoom;

        if(target>=top&&target<=bottom){
            closest=num;
            distance=0;
            break;
        }

        const d=Math.min(
            Math.abs(target-top),
            Math.abs(target-bottom)
        );

        if(d<distance){
            distance=d;
            closest=num;
        }
    }

    if(closest!==currentPage){
        currentPage=closest;
        currentPageEl.textContent=closest;
    }
}

let scrollFrame=null;

viewer.addEventListener("scroll",()=>{
    if(scrollFrame)return;

    scrollFrame=requestAnimationFrame(()=>{
        updateCurrentPage();
        scrollFrame=null;
    });
},{passive:true});

/* ---------------- Resize ---------------- */

let resizeTimer;

window.addEventListener("resize",()=>{
    clearTimeout(resizeTimer);

    resizeTimer=setTimeout(()=>{
        /*
         * Re-fit automatically only if reader
         * was already using fit-width.
         */
        if(Math.abs(zoom-fitZoom)<.03){
            fitToWidth();
        }else{
            pages.style.width=
                `${Math.max(
                    viewer.clientWidth,
                    basePagesWidth*zoom
                )}px`;

            updateCurrentPage();
        }
    },100);
});

/* ---------------- Start ---------------- */

await Promise.all([
    renderBook(),
    renderOutline()
]);

fitToWidth();
updateCurrentPage();