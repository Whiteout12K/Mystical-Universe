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
const sidebar=document.getElementById("sidebar");
const outlineEl=document.getElementById("outline");
const overlay=document.getElementById("sidebarOverlay");

const scale=1.5;
const pageElements=new Map();

const pdf=await pdfjsLib.getDocument(url).promise;

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

async function renderPage(pageNum){
    const page=await pdf.getPage(pageNum);

    const viewport=page.getViewport({
        scale
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

    canvas.width=Math.ceil(viewport.width);
    canvas.height=Math.ceil(viewport.height);

    canvas.style.width=`${viewport.width}px`;
    canvas.style.height=`${viewport.height}px`;

    const annotationLayer=document.createElement("div");
    annotationLayer.className="annotation-layer";

    wrapper.append(
        canvas,
        annotationLayer
    );

    viewer.appendChild(wrapper);

    pageElements.set(
        pageNum,
        wrapper
    );

    await page.render({
        canvasContext:context,
        viewport
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

/* ---------------- Start ---------------- */

await Promise.all([
    renderBook(),
    renderOutline()
]);