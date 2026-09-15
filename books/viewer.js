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
    document.body.innerHTML=
        "<h1 style='color:white;text-align:center'>Invalid Book ID</h1>";
    throw new Error("Invalid book id");
}

const viewer=document.getElementById("viewer");
const pages=document.getElementById("pages");
const sidebar=document.getElementById("sidebar");
const outlineEl=document.getElementById("outline");
const overlay=document.getElementById("sidebarOverlay");
const currentPageEl=document.getElementById("currentPage");
const totalPagesEl=document.getElementById("totalPages");
const zoomSlider=document.getElementById("zoomSlider");
const zoomLevel=document.getElementById("zoomLevel");

const BASE_SCALE=1.5;
const pageElements=new Map();

let zoom=1;
let fitZoom=1;
let currentPage=1;

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
        page.offsetTop*zoom-58
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

        /* External link */
        if(annotation.url){
            link.href=annotation.url;
            link.target="_blank";
            link.rel="noopener noreferrer";
        }

        /* Internal PDF destination */
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

/* ---------------- Render Pages ---------------- */

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

    const context=canvas.getContext(
        "2d",
        {alpha:false}
    );

    const outputScale=
        window.devicePixelRatio||1;

    canvas.width=
        Math.floor(viewport.width*outputScale);

    canvas.height=
        Math.floor(viewport.height*outputScale);

    canvas.style.width=`${viewport.width}px`;
    canvas.style.height=`${viewport.height}px`;

    const annotationLayer=
        document.createElement("div");

    annotationLayer.className=
        "annotation-layer";

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
        canvasContext:context,
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
}

/* ---------------- Zoom ---------------- */

/*
100% = fit document to screen width.

Slider:
 50% = half fit-width size
100% = fit width
200% = twice fit-width size
300% = three times fit-width size
*/

function calculateFitZoom(){
    const firstPage=pageElements.get(1);

    if(!firstPage)return 1;

    const availableWidth=
        Math.max(100,viewer.clientWidth-20);

    return availableWidth/
        firstPage.offsetWidth;
}

function setZoom(percent,preservePosition=true){
    const oldZoom=zoom;

    fitZoom=calculateFitZoom();

    const newZoom=
        fitZoom*(percent/100);

    /*
    Keep the location currently in the middle
    of the screen when changing zoom.
    */
    const centerX=
        viewer.scrollLeft+
        viewer.clientWidth/2;

    const centerY=
        viewer.scrollTop+
        viewer.clientHeight/2;

    const contentX=
        centerX/oldZoom;

    const contentY=
        centerY/oldZoom;

    zoom=newZoom;

    pages.style.transform=
        `scale(${zoom})`;

    updateScaledArea();

    zoomLevel.textContent=
        `${percent}%`;

    if(preservePosition){
        requestAnimationFrame(()=>{
            viewer.scrollLeft=
                contentX*zoom-
                viewer.clientWidth/2;

            viewer.scrollTop=
                contentY*zoom-
                viewer.clientHeight/2;

            updateCurrentPage();
        });
    }
}

function updateScaledArea(){
    const firstPage=pageElements.get(1);

    if(!firstPage)return;

    /*
    CSS transform doesn't normally increase
    scrollable layout size, so compensate.
    */
    const naturalWidth=
        firstPage.offsetWidth;

    const naturalHeight=
        Array.from(pageElements.values())
        .reduce((total,page)=>{
            const style=
                getComputedStyle(page);

            return total+
                page.offsetHeight+
                parseFloat(style.marginTop)+
                parseFloat(style.marginBottom);
        },0);

    pages.style.width=
        `${Math.max(
            viewer.clientWidth,
            naturalWidth*zoom
        )}px`;

    pages.style.height=
        `${naturalHeight*zoom}px`;
}

/* Only permitted document zoom control */
zoomSlider.addEventListener("input",()=>{
    setZoom(
        Number(zoomSlider.value)
    );
});

/* ---------------- Disable Other Zoom ---------------- */

/* Ctrl/Cmd + mouse wheel */
viewer.addEventListener("wheel",e=>{
    if(e.ctrlKey||e.metaKey)
        e.preventDefault();
},{passive:false});

/* Pinch touch zoom */
let lastTouchDistance=0;

viewer.addEventListener("touchstart",e=>{
    if(e.touches.length>1){
        e.preventDefault();
        lastTouchDistance=0;
    }
},{passive:false});

viewer.addEventListener("touchmove",e=>{
    if(e.touches.length>1){
        e.preventDefault();
        lastTouchDistance=0;
    }
},{passive:false});

/* Safari gestures */
viewer.addEventListener(
    "gesturestart",
    e=>e.preventDefault()
);

viewer.addEventListener(
    "gesturechange",
    e=>e.preventDefault()
);

viewer.addEventListener(
    "gestureend",
    e=>e.preventDefault()
);

/* Keyboard browser zoom */
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

    const target=
        viewer.scrollTop+
        viewer.clientHeight*.42;

    let closest=1;
    let closestDistance=Infinity;

    for(const [num,page] of pageElements){
        const top=
            page.offsetTop*zoom;

        const height=
            page.offsetHeight*zoom;

        const center=
            top+height/2;

        const distance=
            Math.abs(center-target);

        if(distance<closestDistance){
            closestDistance=distance;
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
        Slider percentage remains unchanged,
        but fit-width is recalculated for the
        new screen size.
        */
        setZoom(
            Number(zoomSlider.value),
            false
        );

        updateCurrentPage();
    },100);
});

/* ---------------- Start ---------------- */

await Promise.all([
    renderBook(),
    renderOutline()
]);

/*
100% is the default.

This calculates the necessary scale so the
PDF page width matches the available screen.
*/
zoomSlider.value=100;

setZoom(
    100,
    false
);

updateCurrentPage();