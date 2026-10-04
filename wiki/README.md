# Simple wiki text pages

Copy `avery_obtainia.html` to `your_page.html`, then replace Avery’s text with your own. Edit the text inside `script type="text/x-wiki"`; keep the small HTML wrapper. Update the HTML title, description, and canonical address at the top too. No article JSON or build step is used. Shared JavaScript builds the layout. `navigation.json` still controls the header.

Cloudflare serves `your_page.html` at `/wiki/your_page`. A basic HTTP preview uses the `.html` address. The text wrapper must not contain a literal closing script tag.

## Optional page blocks

```
{{Page
|title=Page Name
|description=Search description
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
|Users=[[avery_obtainia|Avery Obtainia]]
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
- `[[fandom:Page Name|Label]]` explicitly links to Fandom.
- `[https://example.com Display label]` links externally.
- `[[File:/images/art.png|Caption]]` inserts an image in the body.
- Blank lines separate paragraphs. `== Heading ==` through `===== Heading =====` create sections and automatic contents links. `*` and `#` create bullet and numbered lists.
- Three apostrophes mark bold; two mark italic. `<br>` remains supported.
- `{{Spoiler|Hidden text with [[links]]}}` works within a field or the body and becomes Show Spoiler / Hide Spoiler text.

The renderer escapes arbitrary HTML and restricts links to web addresses. This is a focused wiki dialect; advanced MediaWiki extensions and arbitrary Fandom templates are not supported. Use the generic Infobox format instead of importing an unmodified Fandom Character template. All display structure and styling are shared in `wiki-code/wikitext.js`, `wiki-code/wiki.js`, and `wiki-code/wiki.css`; startup is in `wiki-code/boot.js`. Account behavior uses the existing website code.

## Nested wiki pages

Create `wiki/magic/light.html` for `/wiki/magic/light`. Copy Avery's small HTML wrapper, retaining the absolute loader path `/wiki/wiki-code/boot.js?v=1`, and replace its title, description, canonical URL, and wiki text. Assets and navigation use absolute paths, so any folder depth works. Link to nested articles using `[[magic/light|Light]]` or `[[/wiki/magic/light|Light]]`. Set the canonical URL to `https://mysticallegends.org/wiki/magic/light`. No registry or build step is required.

## Home page features

`home.html` uses the same text renderer without an infobox. `{{RandomArticle|title=From the Wiki Archive}}` shows an existing article drawn from wiki URLs in `sitemap.xml`; it checks that the page has wiki text before displaying it. Re-run `python3 sitemap_gen.py` after creating new wiki HTML pages so they join the selection. The home page itself is excluded.

`{{Characters|Character Name=/images/avatar.png :: wiki_page}}` creates avatar cards; add one named parameter per character. Destinations can be nested local page names or explicit `fandom:` links. The home currently shows Avery, Kaden, River, Lucy, Teddric, Amos, and Kiara.

## Virtual article views

Add `|views=powers-abilities` in the Page block to show that top-level section as a separate view in the same HTML. Point a Tabs item to `#powers-abilities`. Other sections and the infobox are hidden while viewing it; Overview (`#wiki-title`) restores them. Multiple view heading IDs can be separated with commas. Section links, refresh, and browser back/forward preserve the selected view.
