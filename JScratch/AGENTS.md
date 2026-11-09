# JScratch guidance

Read [README.md](README.md) before changing this engine or writing game programs.

JScratch is a JavaScript API inspired by Scratch blocks. `program/begin.js` defines startup/menu flow and `program/world.js` defines the playable World scene; `js/` implements the reusable engine. Preserve this separation. Do not rewrite the user's game or add scenes unless requested.

Keep the folder name and URL capitalization exactly `JScratch`. Shared website tools live in `../webpages/apps/`; the shared skill stylesheet lives in `../assets/css/mlg-skill.css`.

Camera defaults live in `camera.json`; executable camera blocks live in `js/camera.js`. Camera following is opt-in; preserve the default `(0, 0)` view unless the game or config explicitly requests otherwise.

UI objects in `js/ui.js` are procedural Sprite subclasses and default to world coordinates. `spriteCoordinateMode(name, "canvas")` is opt-in for any sprite: CSS pixels from canvas top-left, y downward, independent of camera/zoom. Keep `program/sample.js` in the user's flat section-and-inline-comment style; do not wrap the reference in a catalog object or category functions.

`coordinatePlane(name, horizontal, vertical)` selects canvas mode with left/right and top/bottom inward CSS-pixel distances. Preserve those offsets on resize; x/y remain distances in the selected plane. `moveToEdge` was removed; use coordinatePlane then moveTo.

Startup commands belong inside `whenStart(...)`; startup hats run concurrently on each restart. `editor.html` and `editor/` provide the visual editor through the existing Wrangler server. Do not add a separate editor server. Browser folder access handles direct program-file autosave. New public blocks must follow [BLOCKS.md](BLOCKS.md) and use `defineJScratchBlock` in `js/extensions.js`. Metadata drives both runtime constructors and the editor; do not duplicate signatures or edit vendor code. Run `node JScratch/editor/build-catalog.mjs` after legacy block or externally created program-file changes. Keep import syntax-only; never execute imported game code in the editor.

Programs load recursively from `program/project.json`. All files register before startup; use event hats and explicit synchronization rather than relying on file/folder order. The editor automatically includes newly saved files and subfolders and excludes sample.js/reference examples from execution. Preserve bold filled blocks with white labels, white fields with black text, subtle darker outlines in each block’s own color, and renderer-based body label alignment. The editor is canvas-first: no full-width header/footer bars, collapsible file and palette/search panels, and compact floating controls. Save exclusively to the adjacent program folder using remembered browser permission; do not add a persistent folder-change button or claim browsers can silently write without permission.

Keep block arguments inline, including UI and glide blocks, with automatic continuation rows at the 800-unit target in editor/renderer.mjs. Restore older saved blocks to inline inputs when loading; let the renderer wrap whole arguments without changing their names, order, or source code. Statement bodies still nest on their own rows.

Palette preview scale is independent of canvas zoom. Preserve the getFlyoutScale override in editor/palette.mjs and Blockly’s native drag conversion; do not resize palette blocks when fitting or zooming the workspace.

Compact editor wording belongs in editor/labels.mjs (var, val/val2, width/height/radius, etc.). Change display labels only; never rename public JavaScript functions, parameter keys, or user-authored strings to match visual abbreviations.

Keep the workspace full-window when the palette opens; palette.mjs positions its flyout below floating controls without creating an empty strip above the canvas.

Run opens the game and inspector.html in separate windows linked by a random inspection session. Preserve the read-only snapshot boundary: never evaluate reporters/getters while inspecting, expose variable previews rather than engine/image objects, and include original sprites, UI and clones. Inspector selection IDs include runId. Keep list rendering virtualized and snapshots request-driven; ordinary game visits must not collect them. Do not add inspector mutation controls without a user request.

Smart field roles live in editor/symbols.mjs and are rendered by editor/smart-fields.mjs; preserve raw JS VALUE serialization and reporter connections. Names are indexed across executable files and saved in program/editor-data.json plus browser drafts. Never permit deletion of referenced names; keep costume paths and sprite vars scoped to their owner/clone family. Color pickers must support opacity; numbers stay directly editable, and Expression… preserves computed arguments. Disable the yellow selection overlay rather than hiding drag-insertion feedback.
