# Website improvements and individual rollback

These additions are local changes to the existing website. No deployment, account changes, or database migration is required. Existing character lists, skills, artwork, and story content remain the source of truth.

## Disable or re-enable one improvement

Each feature is independently controlled in `data/site-features.json`. For example:

```sh
python3 scripts/feature-control.py list
python3 scripts/feature-control.py disable characterComparison
python3 scripts/feature-control.py enable characterComparison
```

Refresh open pages after a change. Disabling one feature preserves the other features and any saved reading/spoiler preferences. A disabled tool page shows an unavailable message; its menu link disappears. The original wiki search is retained as the fallback when `fastWikiSearch` is disabled.

| Feature switch | Added behavior | Main implementation |
| --- | --- | --- |
| `unifiedSearch` | Header search dialog, Ctrl/Cmd+K, `/webpages/search.html`; filter characters, wiki, skills, effects, books | `js/site-enhancements/search.js` |
| `characterConnections` | Wiki/game/book links and related characters on character pages | `js/site-enhancements/connections.js` |
| `spoilerPreferences` | Browser-local reading progress and default spoiler disclosure | `js/site-enhancements/spoilers.js` |
| `characterComparison` | Two-character base-stat, affinity, role, and skill comparison; shareable query parameters | `webpages/compare.html`, `js/site-enhancements/compare.js` |
| `mobileNavigation` | Sticky horizontal skill selector, keyboard skill controls, character/skills shortcuts | `js/site-enhancements/mobile.js` |
| `effectsGlossary` | Search/filter effect entries and follow effect links from skill descriptions | `webpages/effects.html`, `js/site-enhancements/effects.js`, `ml-game/apps/skill.html` |
| `readingContinuity` | Cross-site Continue Reading, saved position within a page, outline-based previous/next chapters or sections | `js/site-enhancements/reading.js`, `books/viewer.js` |
| `visualConsistency` | Shared gold focus indicators and rounded existing buttons; shared tokens style all new controls | `css/site-enhancements.css` |
| `contentChecks` | Check data, assets, local links, placeholders, damage values, missing skills/effects, stale indexes | `scripts/check-content.py`, GitHub Actions |
| `fastWikiSearch` | Load one compact generated wiki search index instead of fetching every article for search | `wiki/wiki-code/search.js` |

The shared loader is appended to `js/include.js`. Shared helper code lives in `js/site-enhancements/core.js`. The feature pages and optional components use `css/site-enhancements.css`; feature-specific changes to existing controls require the matching feature class.

For a complete code removal, remove the corresponding module/page and its loader branch after disabling it. Changes to existing files were also backed up before this task, with a separate patch for each existing file in the local backup folder recorded below. Those patches are based on the working files at the start of this task, **not** on an older Git commit. Reverse patches should be checked before applying if a file has since been edited; never overwrite newer work with a whole-file restore.

## Regenerate indexes after content edits

```sh
python3 scripts/build-site-index.py
python3 scripts/check-content.py
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/test-*.mjs
```

Generated files:

- `data/search-index.json`: public unified search entries.
- `data/wiki-search-index.json`: wiki titles and safe opening summaries.
- `data/character-connections.json`: available character page links and public connections.
- `data/books.json`: book catalogue and local PDF availability.

Wiki search summaries exclude template contents, including nested spoilers. The index does not contain full hidden story sections. Existing public introductions are retained. Game skill previews use base values and the nickname/gender in character data. Entries whose roster IDs start with `#` stay out of new public game listings. Renaming an enabled Alter entry to `c1b` and regenerating the indexes makes it available to the new tools. Do not rename it just to satisfy a check if it is intentionally disabled.

Only books with a local PDF get a reader/Continue Reading link. Other catalogue books keep their book-listing link. The reader's previous/next controls use actual PDF outline destinations, including front matter; books without an outline retain existing page navigation. Continue Reading is saved on this browser and does not require sign-in.

## Spoiler book levels

Existing `{{Spoiler|text}}` entries are unclassified and remain hidden for finite reading-progress settings. Their contents are never assigned a guessed book number. Authors can explicitly mark the first safe completed book:

```text
{{Spoiler|book=2|This detail becomes safe after finishing Book 2.}}
```

“Finished Book 2” automatically opens entries labeled book 1 or 2. “Hide all spoilers” closes entries; readers can still manually reveal an individual spoiler. “Show all spoilers” opens all entries, including unclassified ones. Settings apply across wiki pages in the same browser, including other open tabs.

## Content audit and checks

`docs/CONTENT-AUDIT.md` records issues already present when the additions were implemented, including unfinished skill definitions and missing assets. `data/content-check-baseline.json` holds the exact same known-issue list. The normal check fails on **new** problems and stale indexes; `--strict` also fails on known issues. Existing unfinished content is not invented or silently removed.

```sh
python3 scripts/check-content.py --strict
```

Only refresh the baseline intentionally after reviewing changes:

```sh
python3 scripts/check-content.py --baseline
```

The GitHub Actions workflow runs these checks on pushes and pull requests. It does not publish or modify the site. Turning `contentChecks` off skips the content audit; the targeted feature tests still run. Enabling/disabling flags does not require regenerating search indexes.

Local baseline backup: `/Users/kennycalhoun/.codex/backups/mystical-universe/website-improvements-20261017-191052` (on the development Mac).

## Explore menu placement

Search, Effects, Compare, and Spoiler settings appear inside Explore on the regular website and wiki. The separate tools strip was removed. Feature switches still control each entry independently. The original Story Characters, Game Characters, and World Timeline shortcuts were removed from Explore.

## Account appearance and wiki theme

Signed-in visitors can open **Account** from their user menu at `/webpages/account.html`. The page previews a profile image and profile background before Save changes. The selected profile image also appears in website and wiki navigation; saved appearance is used on the public ML Game Profile and player search results.

`images/mlg-assets/account-styles.json` is the canonical catalogue. It contains the torch, all existing character-head PNGs, four background choices, and readable labels. IDs 1 and 2 retain the previous torch/default and scenery meanings. The singular `account-style.json` is retained as a populated compatibility copy; current profile/account pages use the plural filename. Existing avatar-frame support is preserved.

Wiki appearance has three account choices: Use browser preference, Light, or Dark. A saved Light/Dark account choice takes priority over `wiki_theme` cookies. Use browser preference falls back to the cookie. Signed-out readers always use the cookie/default; the account override does not overwrite that cookie. The wiki's own mode toggle saves the theme to the signed-in account, or to the cookie for a signed-out visitor.

Account appearance and theme are stored in `user_account_preferences`, separate from `users.save_data`. The idempotent table definition is included in `migrations/schema.sql`, and account/profile handlers initialize it when necessary. No remote database command was run during implementation. `/api/account` uses the existing login session and returns only the current account name, preferences, and resolved appearance URLs. The update endpoint accepts only catalogue IDs and known wiki modes, and rejects cross-origin changes and unknown fields. Partial updates let the wiki toggle change the theme without resetting profile appearance. Public profiles receive avatar/background IDs, not the user's private wiki preference.

Tests:

```sh
node --test tests/test-*.mjs
python3 scripts/check-content.py
```

The account tests cover signed-out access, per-user saves, game-data preservation, invalid style IDs, partial updates, theme/cookie precedence, and catalogue assets. Browser/API testing used a separate local preview database and a disposable test account, without changing existing local or remote accounts.

Account-change baseline backup: `/Users/kennycalhoun/.codex/backups/mystical-universe/account-settings-20261017-193711`.
