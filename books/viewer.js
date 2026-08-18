import * as pdfjsLib from "./pdfjs/pdf.mjs";

// Tell PDF.js where the worker is
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdfjs/pdf.worker.mjs";

// Get ID from URL (?id=1, ?id=2, etc.)
const params = new URLSearchParams(window.location.search);
const id = params.get("id") || "1"; // default to 1

// Map IDs to PDF files
const books = {
    "1": "./pdf/Mystical Legends 1.pdf",
    "2": "./pdf/Mystical Legends 2.pdf",
    "3": "./pdf/Mystical Legends 3.pdf"
    // Add more books here as needed
};

// Pick PDF based on ID
const url = books[id];

if (!url) {
    document.body.innerHTML = "<h1 style='color:white; text-align:center'>Invalid Book ID</h1>";
    throw new Error("Invalid book id");
}

// Get viewer container
const container = document.getElementById("viewer");

// Load PDF
const pdf = await pdfjsLib.getDocument(url).promise;

// Render each page
for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    container.appendChild(canvas);

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
}