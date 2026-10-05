# Simple wiki text pages

Copy `char/avery_obtainia.html` to `your_page.html`, then replace Avery’s text with your own. Edit the text inside `script type="text/x-wiki"`; keep the small HTML wrapper. Update the HTML title, description, and canonical address at the top too. No article JSON or build step is used. Shared JavaScript builds the layout. `navigation.json` still controls the header.

Cloudflare serves `your_page.html` at `/wiki/your_page`. A basic HTTP preview uses the `.html` address. The text wrapper must not contain a literal closing script tag.

## Optional page blocks

```
{{Page
|title=Page Name
|notice=Optional notice
|source=https://example.com/original
|image base=/images/character_art/
}}

{{Tabs
|Overview=#wiki-title
|Related page=another_page
|Game=/webpages/game-c.html?char=c1
}}

{{Infobox
|title=Book, character, magic, affiliation, or any subject
|image=local_image.png :: Main
|image=/images/other/art.png :: Another appearance
|section=General Information
|Any field name=Any value
|Users=[[char/avery_obtainia|Avery Obtainia]]
|Members=First member
Second member
|Hidden information={{Spoiler|Secret details}}
|section=Another group
|Another field=Another value
}}

An introductory paragraph.

== Overview ==
Write your text here.

=== Subsection ===
* First detail
* Second detail

{{Gallery|
/images/character_art/art.png :: Caption
/images/other/image.png :: Another caption
}}

{{References
|Source label=https://example.com/source
}}

{{Credits|Credit text with [https://example.com Source link].}}
[[Category:Characters]]
```

Every block is optional. Omit the Infobox block for a full-width page. Empty fields and empty groups are skipped. Empty galleries, references, and tabs are skipped. Contents only appear when there are headings. The article footer contains optional categories and credits, plus a back-to-top link.

Infobox fields are completely custom and render in your order. `title`, `image`, and `section` are reserved controls. Repeat `image` for portrait selectors and `section` for field groups. Newlines within a field create separate lines; you do not need `<br>`. Use `::` between image paths and captions. Use full image paths when assets are outside the configured image base. The same format supports character, book, affiliation, and magic infoboxes.

## Links, text, and images

- `[[Page Name]]` links locally to `/wiki/page_name`.
- `[[page_name|Display label]]` customizes the text.
- `[[/books_main.html|Books]]` points to another part of this website.
- `[[fandom:Page Name|Label]]` resolves to the matching local wiki page when it exists; otherwise it remains inactive.
- External links remain visible but inactive. Links to existing website pages and image/media files remain clickable.
- `[[File:/images/art.png|Caption]]` inserts an image in the body.
- Blank lines separate paragraphs. `== Heading ==` through `===== Heading =====` create sections and automatic contents links. `*` and `#` create bullet and numbered lists. Repeat markers for nesting: `**` is indented under the preceding `*` item, `***` adds another level, and `##` nests numbered items.
- Three apostrophes mark bold; two mark italic. `<br>` remains supported.
- `{{Spoiler|Hidden text with [[links]]}}` works within a field or the body and becomes Show Spoiler / Hide Spoiler text.

The renderer escapes arbitrary HTML and restricts links to web addresses. This is a focused wiki dialect; advanced MediaWiki extensions and arbitrary Fandom templates are not supported. Use the generic Infobox format instead of importing an unmodified Fandom Character template. All display structure and styling are shared in `wiki-code/wikitext.js`, `wiki-code/wiki.js`, and `wiki-code/wiki.css`; startup is in `wiki-code/boot.js`. Account behavior uses the existing website code.

## Nested wiki pages

Create `wiki/magic/light.html` for `/wiki/magic/light`. Copy Avery's small HTML wrapper, retaining the absolute loader path `/wiki/wiki-code/boot.js?v=1`, and replace its title, description, canonical URL, and wiki text. Assets and navigation use absolute paths, so any folder depth works. Link to nested articles using `[[magic/light|Light]]` or `[[/wiki/magic/light|Light]]`. Set the canonical URL to `https://mysticallegends.org/wiki/magic/light`. No registry or build step is required.

## Home page features

`home.html` uses the same text renderer without an infobox. `{{RandomArticle|title=From the Wiki Archive}}` shows an existing article drawn from wiki URLs in `sitemap.xml`; it checks that the page has wiki text before displaying it. Re-run `python3 sitemap_gen.py` after creating new wiki HTML pages so they join the selection. The home page itself is excluded.

`{{Characters|Character Name=/images/avatar.png :: wiki_page}}` creates avatar cards; add one named parameter per character. Destinations can be nested local page names or legacy `fandom:` page names. The home currently shows Avery, Kaden, River, Lucy, Teddric, Amos, and Kiara.

## Virtual article views

Place `|tab=Overview` on its own line before the first tab’s body. Use `|tab=Powers & Abilities` (or any custom name) where the next tab starts. Each marker ends the previous tab; the final tab ends at the end of the body. All heading levels work within each tab. The first tab shows the infobox; other tabs hide it.

In `{{Tabs}}`, a bare entry such as `|Overview` or `|Powers & Abilities` links to the matching marker. An explicit entry such as `|MLG=/webpages/game-c.html?char=c1` still links to a separate page. Without a Tabs block, multiple markers generate navigation automatically. Names without a matching marker remain inactive. Infobox, Gallery, References, Credits, and home widgets remain shared optional directives; Gallery/References appear with the first tab and Credits stay below every tab. Existing pages without markers still work.

Wiki links use `sitemap.xml` to recognize available website pages. Regenerate it with `sitemap_gen.py` after adding pages. Missing destinations stay visible without navigating.

Full HTTP/HTTPS links in References and Credits remain clickable external source links. Other unavailable wiki destinations stay inactive.

The wiki header search discovers existing wiki pages from `sitemap.xml`, including nested folders. Regenerate the sitemap after adding articles. It loads page names when first opened and filters them as you type; arrow keys, Enter, and Escape control the dropdown.

Preview descriptions come automatically from the first article paragraph outside templates and infoboxes. This supplies the home archive preview, search results, and the rendered page’s metadata. Wiki links and bold/italic text become plain text; hidden spoilers are excluded. No `|description=` field is needed.

## Local wiki editor

Use your existing VS Code local server and open `/wiki/wiki-editor/`. The editor automatically finds served wiki pages from `sitemap.xml`. In Chrome or Edge, the first save asks for the website’s `wiki` folder, or you can click Open Wiki Folder. Allow folder access when prompted. The folder is remembered in this browser for this localhost address; later visits scan it automatically while permission remains granted. If permission expires, Save asks to reconnect it. No Python server or backend is needed. Browsers without directory access can view pages but cannot save directly. Regenerate the sitemap after adding pages if you have not connected the folder; a connected folder discovers new pages directly.

The selected folder is scanned recursively, including nested folders, without depending on the sitemap. The sidebar preserves their hierarchy. Visual editor shows formatted, editable headings, paragraphs, nested lists, links, spoilers, and infobox entries. Its compact menu places Undo/Redo on the left and Discard/Save on the right, with formatting and an Insert wiki content dropdown below. Insert blocks, rename tabs, add or remove infobox fields/sections/images, edit field names and values, manage gallery images and captions, and remove blocks using their × controls. Double-click a link to edit its destination. Undo/Redo also restores structural changes. Click a field in a wiki block, then choose Insert wiki content → Paragraph to add a paragraph after that block. Its placeholder text is selected so you can type immediately. The ↵ control does the same. Enter creates a separate paragraph in article text with the same spacing as existing paragraphs. Shift+Enter creates a single line break. Infobox values and compact template fields keep single-line breaks with Enter; lists keep their normal item behavior. Images and inline spoilers have their own continue-writing controls. Source code is a separate tab for changing template structure, images, galleries, tabs, or other advanced markup. Switching views preserves unsaved changes. The editor condenses repeated blank rows to one blank line between article elements when switching views or saving; spacing inside template values is preserved. Save writes directly to the matching HTML file through the connected folder; it never downloads a copy. Save Change writes only the existing wiki text block, preserving the surrounding HTML. Changes stay local until your normal GitHub push. Reopening a page loads changes made in VS Code; concurrent changes are rejected rather than overwritten. Discard Changes restores the last loaded or saved text.

The editor is disabled on hosted domains and excluded from search indexing.
