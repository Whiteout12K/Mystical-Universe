# Mystical Universe website

The Mystical Legends website, wiki, book reader, and game tools. Run development commands from this directory.

## Find the right folder

| Folder | Contents |
| --- | --- |
| `books/` | PDF book files and reader |
| `css/`, `js/`, `images/` | Website styles, scripts, and artwork |
| `data/` | Website feature switches and generated indexes |
| `docs/` | Development guide, feature/rollback guide, and existing content audit |
| `functions/` | Cloudflare Pages API and server routes |
| `index/` | Shared headers, footer, and homepage supporting data |
| `migrations/` | Database schema, targeted SQL migrations, and production migration record |
| `ml-game/` | Scratch-like game engine and its standalone apps |
| `news/` | News content |
| `scripts/` | Sitemap/index generators, content checker, and feature controls |
| `tests/` | Python and JavaScript tests |
| `webpages/` | Account, character, and other website pages/tools |
| `wiki/` | Wiki articles, templates, editor, and wiki-specific code |

The root `index.html`, `books_main.html`, and `game-hub.html` are public entry pages. `robots.txt`, `sitemap.xml`, and `wrangler.toml` stay in the root for hosting and discovery. The small `sitemap_gen.py` launcher preserves existing build commands; its implementation is in `scripts/`.

## Common commands

```sh
# Start the local website and API
wrangler pages dev .

# Refresh generated content after editing pages or character data
python3 scripts/sitemap_gen.py
python3 scripts/build-site-index.py

# Validate content and run tests
python3 scripts/check-content.py
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/test-*.mjs

# List reversible website improvements
python3 scripts/feature-control.py list
```

The sitemap generator only needs to run when page URLs or article inventory change. The legacy `python3 sitemap_gen.py` command still works. Both generators locate the project from their own paths and can run from another working directory.

- [Directory organization and cleanup rollback](docs/ORGANIZATION.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Website improvements and rollback](docs/WEBSITE-IMPROVEMENTS.md)
- [Existing content issues](docs/CONTENT-AUDIT.md)
- [Database setup and migration history](migrations/README.md)
- [Wiki editing guide](wiki/README.md)
- [Game engine guide](ml-game/README.md)

Finder metadata and Python bytecode are ignored. The root cleanup's original files, generated metadata, and move manifest were saved in a separate local backup for rollback.

## Asset updates

Use plain asset URLs without manual version query parameters. The root `_headers` file tells Cloudflare Pages to revalidate static pages and assets on each load, allowing unchanged files to use conditional responses while checking for new deployments. Publish your changes through the normal deployment process, then reload the page to load the latest deployed files.
