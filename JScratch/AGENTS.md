# JScratch guidance

Read [README.md](README.md) before changing this engine or writing game programs.

JScratch is a JavaScript API inspired by Scratch blocks. `program/begin.js` defines startup/menu flow and `program/world.js` defines the playable World scene; `js/` implements the reusable engine. Preserve this separation. Do not rewrite the user's game or add scenes unless requested.

Keep the folder name and URL capitalization exactly `JScratch`. Shared website tools live in `../webpages/apps/`; the shared skill stylesheet lives in `../assets/css/mlg-skill.css`.

Camera defaults live in `camera.json`; executable camera blocks live in `js/camera.js`. Camera following is opt-in; preserve the default `(0, 0)` view unless the game or config explicitly requests otherwise.

UI objects in `js/ui.js` are procedural Sprite subclasses and default to world coordinates. `spriteCoordinateMode(name, "canvas")` is opt-in for any sprite: CSS pixels from canvas top-left, y downward, independent of camera/zoom. Keep `program/sample.js` in the user's flat section-and-inline-comment style; do not wrap the reference in a catalog object or category functions.

`coordinatePlane(name, horizontal, vertical)` selects canvas mode with left/right and top/bottom inward CSS-pixel distances. Preserve those offsets on resize; x/y remain distances in the selected plane. `moveToEdge` was removed; use coordinatePlane then moveTo.

Startup commands belong inside `whenStart(...)`; startup hats run concurrently on each restart. `editor.html` and `editor/` provide the visual editor through the existing Wrangler server. Do not add a separate editor server. Browser folder access handles direct program-file autosave. Run `node JScratch/editor/build-catalog.mjs` after changing public blocks or the sample/program file list. Keep import syntax-only; never execute imported game code in the editor.
