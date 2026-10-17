# Directory organization

The root contains the public entry pages, website folders, hosting configuration, and this project’s main README. Public page URLs and asset paths were preserved.

- General guides and content audit: `docs/`.
- Build and maintenance tools: `scripts/`.
- Python/JavaScript test suites: `tests/`.
- Baseline database schema and incremental SQL: `migrations/`.
- `sitemap_gen.py` in the root is a compatibility launcher for existing Cloudflare build commands. The implementation is `scripts/sitemap_gen.py`.
- Generated Finder metadata and Python caches are ignored. Previously tracked metadata was archived outside the checkout.

The tests, CI commands, schema references, wiki editing guide, content checker output path, and generator root detection were updated for these moves. No remote deployment or database change was made as part of this cleanup.

## Rollback

The task-specific backup contains `before.zip`, `after.zip`, `manifest.json`, and `generated-metadata/`. The manifest records exact moves and archived files. Restore individual moves and associated references if a specific part needs reverting; compare newer edits before restoring a whole file.

Backup on this Mac: `/Users/kennycalhoun/.codex/backups/mystical-universe/directory-cleanup-20261017-195019`.
