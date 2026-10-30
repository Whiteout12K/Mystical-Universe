# Local reader PDF export

Lazy-loaded, locally served dependency:

- jsPDF 4.2.1 — https://github.com/parallax/jsPDF (MIT)

`reader-print-layout.js` creates an isolated EPUB rendition for A6/bunko portrait
pages (105 × 148 mm), 11-point text, 1.45 line spacing, 12 mm margins and white
paper. The chosen book font is preserved. Print pagination is independent of the
visible reader's window size, text size and page cache. The temporary rendition,
shadow surface and font style are removed on completion, failure or cancellation.

Vertical image-only paragraphs become individual illustration pages. Images fit
within the margins without cropping; a directly preceding chapter heading stays
with its illustration. Landscape artwork and captioned images remain in flow.
Layout-generated empty pages are omitted.

DOM text ranges provide the actual word positions, widths and font baselines.
PDF text uses the book's embedded TrueType fonts, including bold and italic
variants. Only visible words enter each page, so adjacent columns are not
duplicated. Text remains selectable and searchable without page screenshots.

Illustrations are embedded once per source image as JPEGs, initially limited to
1600 pixels on the longest side at quality 0.82. If needed, only illustration
resolution/quality is reduced to meet a strict 5,000,000-byte limit. The checked
PDF Blob is downloaded directly without serializing it a second time. Larger
files are rejected. Text is never converted into images to meet the limit.

Export is enabled only on loopback hosts, matching the wiki editor. Reading
progress is frozen during export. Cancelling and resizing abort export. No book
content is uploaded. System fonts not embedded in the EPUB use a PDF serif/sans
fallback, fitted to the measured text widths.

Verified Beginning with both 1280×720 and 390×844 reader viewports:
447 pages, 3,068,963 bytes (3.07 MB), all 10 illustrations. Extracted text matches
all 61,092 source word tokens, with no missing or additional tokens. The active
reading position is unchanged by exporting.
