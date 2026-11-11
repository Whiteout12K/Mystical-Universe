# JScratch visual editor: implementation guide

Read this document before changing anything under `editor/` or modifying how runtime blocks appear in the visual workspace. Also read [../AGENTS.md](../AGENTS.md), the [runtime README](../README.md), and [../BLOCKS.md](../BLOCKS.md) when changing public block APIs. This guide covers the optional development tools; runtime behavior is documented separately.

Paths in prose are relative to `JScratch/` unless a link is provided. Preserve the folder name's exact capitalization.

## Optional-tool boundary

Every editor-only page, dependency, inspector module and metadata file belongs inside `editor/`. `canvas.html` and runtime `js/` must never import or fetch this folder. Raw `program/*.js`, their runtime manifest, and all custom methods must run with the entire editor folder physically absent. Shared `js/block-api.js` and `js/extensions.js` are runtime components and stay outside it.

The editor uses the existing Wrangler/static host. Do not add an editor server, build requirement, or CDN dependency. `program/project.json` is runtime configuration and remains in `program/`; `editor-data.json` and `editor-layouts.json` remain here. Do not add these metadata files or sample/reference scripts to the executable manifest.

## Files and responsibilities

| File in this folder | Responsibility |
| --- | --- |
| [index.html](index.html), [editor.css](editor.css), [app.mjs](app.mjs) | Entry page, visual shell, documents, autosave and event coordination |
| [paths.mjs](paths.mjs) | Project-relative URLs and migration of browser-storage namespaces |
| [model.mjs](model.mjs) | Syntax-only JavaScript import, expression validation and source generation |
| [blocks.mjs](blocks.mjs) | Generic Blockly definitions, workspace/model conversion and toolbox generation |
| [definitions.mjs](definitions.mjs), [catalog.json](catalog.json), [build-catalog.mjs](build-catalog.mjs) | Declarative extension parsing and generated legacy signatures |
| [field-values.mjs](field-values.mjs) | Text/value defaults, blank-field normalization and empty-string display |
| [types.mjs](types.mjs) | Boolean/value connection roles, output classification and saved-layout migration |
| [renderer.mjs](renderer.mjs), [theme.mjs](theme.mjs), [labels.mjs](labels.mjs) | Wrapping/alignment, block colors and presentation-only wording |
| [palette.mjs](palette.mjs) | Floating palette, fixed preview scale and native drag conversion |
| [symbols.mjs](symbols.mjs), [smart-fields.mjs](smart-fields.mjs), [color.mjs](color.mjs) | Scoped names, searchable fields and HSV/opacity controls |
| [references.mjs](references.mjs) | Cross-file references, exact-offset rename plans and method signatures |
| [parameters.mjs](parameters.mjs) | Definition-header parameter sources, compact reporter copies and ownership |
| [explorer.mjs](explorer.mjs), [project.mjs](project.mjs), [storage.mjs](storage.mjs) | File tree, safe paths/manifests, directory grants and conflict-aware writes |
| [layout.mjs](layout.mjs), [editor-layouts.json](editor-layouts.json) | Stable root positions, canvas view and folder backup |
| [editor-data.json](editor-data.json) | Saved name collections; contains no executable game source |
| [player.html](player.html), [player.mjs](player.mjs), [preview.mjs](preview.mjs) | Full-window game host, popup geometry and random inspection sessions |
| [inspector.html](inspector.html), [inspector.mjs](inspector.mjs), [inspector.css](inspector.css) | Separate read-only sprite inspector |
| [live-inspector.mjs](live-inspector.mjs), [inspector-model.mjs](inspector-model.mjs) | Request-driven channel bridge and bounded safe snapshots |
| [vendor/README.md](vendor/README.md) | Pinned Blockly/Acorn versions, licenses and bundled media |

## Opening and using the editor

Open `/JScratch/editor/` through the existing Wrangler development server (for example `http://localhost:8788/JScratch/editor/`). No separate editor server or build step is needed. Dependencies are bundled locally and are not loaded by the game.

The file explorer shows the program folder and all its subfolders. Empty `scenes/` and `shared/` folders are included for additional scene scripts and shared event code. Use its **New file** and **New folder** buttons to organize scripts, then click a file to edit it. New files join the game automatically when saved; there are no per-file script tags to maintain. `program/project.json` stores the executable file list, reference list, and folder structure. `sample.js` and `reference/` are editable examples excluded from execution.

Use the small save-status chip (or Ctrl/Cmd S) to enable autosave and select local `JScratch` once in Chrome/Edge on localhost or HTTPS. There is no persistent folder-change menu. Wrangler serves files; the browser's folder permission grants disk writes. Scripts save in `program/`; names and layouts save in `editor/`. The editor remembers the directory and reconnects when permission remains granted. Without access, source/layout changes and newly created files/folders stay in browser drafts. A differing draft is offered for explicit recovery. Folder saves stop if another editor changed the same file.

The workspace fills the window. Files and the block palette/search open from a compact floating dock on the left and can be closed independently; Ctrl/Cmd K opens block search. Code/Run and undo/redo, zoom and Fit live in separate floating control groups. The default theme uses a dark gray workspace, bold colored blocks with white labels, and white fields with black text, with subtle darker outlines in each block’s own color. Comment bubbles have dark frames and black text on a neutral writing surface. Light/Dark remembers the chosen palette. Scripts, branches, loops and reporters open expanded, including older saved layouts. First-time script placement uses separate columns; saved layouts remain unchanged. **Expand all** expands scripts without moving them. Body labels align with the first child block's row. Arguments run horizontally and wrap between complete values at an 800-unit target (about 640 display pixels at default zoom); individual values and reporters stay intact. Palette blocks keep a fixed preview size regardless of canvas zoom or Fit; dragged copies use the destination workspace scale. Search the palette and drag commands into stacks/body inputs, or reporters into value inputs. Values use JavaScript syntax such as `"Player"`, `25`, `true`, and `["Wall"]`. Undo/redo, zoom and Fit are available; right-click offers duplication, deletion, disabling and argument controls.

Valid edits autosave after a short debounce. Incomplete/disconnected value blocks and invalid expressions pause JavaScript saving while retaining the draft. **Code** shows the source; use **Apply to blocks** after editing it. Import parses syntax without running the code. Comments survive, and unsupported JavaScript remains in a JavaScript block. Pure layout changes preserve the original source formatting. **Run** saves pending files and opens the game plus a separate live inspector, requesting adjacent window positions. If the browser blocks the second popup, use **Open inspector** in the editor notice.

The runtime waits for every executable file to finish registering its event hats before startup. Folder/manifest order does not decide whether a broadcast listener is available. Startup hats remain concurrent; use explicit broadcasts/waits to coordinate initialization that depends on another script. Ordinary JavaScript top-level dependencies still obey JavaScript evaluation rules; keep game work inside event hats.

For new public blocks, read [../BLOCKS.md](../BLOCKS.md). A `defineJScratchBlock(metadata, handler)` call in `js/extensions.js` supplies the runtime constructor, parameter defaults, editor inputs and category. The editor reads this metadata automatically without executing handlers. To refresh legacy definitions or discover program files created outside the editor, run `node JScratch/editor/build-catalog.mjs`. Blockly 13.4.0 and Acorn 8.19.0 licenses/version notes are in `editor/vendor/`.


## Smart block fields

Click a broadcast, sprite, variable, list, sound, or JSON name field to choose a saved name. The popup supports search, plain-text **Add new**, and deletion of unused items. Existing names are discovered from executable project files, including closed files. Example/reference files do not seed the project name library. Sprite-local vars and costume paths are scoped to their sprite; `self` inside a named clone event uses that clone family's list. Stage costumes have a separate list. Computed sprite targets retain the text/expression editor because their private collection cannot be inferred before running. Choosing a name writes a properly quoted JavaScript string automatically.

Delete stays disabled while a name is used, including references in other files and sprite targets stored in collision lists. Dynamic names, incomplete code, and recognized raw-code references are treated conservatively rather than removing an item that may still be referenced. Removing a library item never rewrites code. Unused names remain available until explicitly deleted. Choices persist in browser storage and, after folder permission, `editor/editor-data.json`.

Color fields open an HSV picker with a saturation/brightness plane, hue, saturation, brightness, and opacity sliders, and a live preview. It generates hex or rgba CSS automatically. Common fixed values (coordinate modes/sides, facing, effects, keys, UI properties, booleans) also have quick choices. Numeric fields remain directly editable. **Expression…** opens the original JavaScript field editor when a computed value is needed; reporter blocks can still be connected normally. Selection uses a subtle focus outline instead of a yellow glow. These controls change field presentation, not API names or parameter ordering.


## Live sprite inspector

The inspector opened by **Run** lists all currently existing sprites, procedural UI, and clones, including hidden objects. Click an item to inspect its position, scale, costume, effects, coordinate mode, collision settings, sprite-local variables, and private variables. A clone shows its source family and its own variable values. Sprite variables (`variables`, used by getSpriteVar) and internal private variables (`privateVariables`) have separate sections; global variables and unrelated broadcast-context variables are not falsely attributed to a sprite.

Values refresh four times per second while the inspector is visible. The list renders only visible rows so a large clone population does not require thousands of DOM nodes. Search filters sprite/clone names and clone sources. Deleted objects disappear and a selected deleted object is marked unavailable. Restart identities include the run ID, so a newly created sprite does not inherit an old selection. Paused/stopped/closed game status is shown, and the inspector remains available if the game window closes.

Inspection is read-only. It never runs reporters, getters, or variable functions and does not change costumes, position, scripts or variables. Large/deep values show explicit preview-limit markers; cyclic values and functions are safely represented. The game and inspector communicate through a random per-run BroadcastChannel, with no network service, disk writes, or editor server. Normal game visits without an inspection session do not collect snapshots. Closing the inspector stops polling. Browser window placement is requested rather than enforced by the web page.


## References and rename

**Refs** opens project-wide reference search. Choose a type, enter a name, and for private fields enter its owner sprite or custom block. Results link to the exact source location and highlight the visual field when it has a unique match. **Preview rename** lists affected files and counts; **Apply rename** changes exact references, preserves other strings/comments, and autosaves through the existing folder permission. Existing names in the same scope cannot be merged accidentally. Invalid project source blocks renaming; computed names and raw JavaScript receive manual-review warnings. A preview is invalidated if its files change. Disk baselines are checked before applying; browser drafts retain a rename if saving fails. Reference/sample files are excluded. Renaming a sprite or custom block also migrates its saved private name collections.

## Custom block authoring

Drag the purple **define block** from **Blocks → My blocks**, click its empty name field to add a name, and use **＋ argument** to add parameters. No separate creation button or dialog is needed. Its definition is a top-level hat; place commands in its body. Named calls appear in the Custom palette and search with the parameter labels. Signature changes preserve extra existing arguments for review rather than discarding connected code. The call's context menu can remove an obsolete last argument. Each call waits for its body, accepts reporter arguments, retains the caller's clone context, and has private parameter/local values. Recursive and simultaneous calls use independent call frames on the cooperative scheduler.

For execution semantics and raw JavaScript examples, see [custom functions](../README.md#custom-functions). The visual form must serialize to these same runtime APIs, not to a second implementation.

### Draggable custom-block parameters

A definition header automatically shows a reporter pill for each parameter. Drag a pill into any value input in that definition's body, including nested operators, conditions and loops. Dragging creates a copy; the header remains available for repeated use. Existing `functionValue("parameter")` calls appear as the same compact reporters when imported. Ordinary method-local values keep their regular local/parameter blocks.

Click **＋ argument** on the definition header to name another parameter. Its pill appears immediately and matching call blocks gain a labeled input. Enter or Space on a focused header pill creates a copy for keyboard use. The generated program still uses the existing `defineFunction`, `callFunction` and `functionValue` APIs. Header pills are editor controls, not extra executable blocks or global variables. Connected copies survive saving, reloading, and undo/redo. A copy placed outside its owning definition, or a copy of a parameter removed from its declaration, blocks autosave with an explanatory message until corrected.

Literal number/text defaults in the visual workspace behave as replaceable inputs, so dropping a reporter into one does not leave a loose literal behind. Computed JavaScript expressions remain real blocks and are preserved if displaced.


### Remembered block positions

The editor remembers each file's exact block coordinates, zoom and pan, and reopens the last file. Refreshing, switching files, reconnecting autosave, expanding scripts, applying code changes, creating custom blocks and renaming references preserve existing script positions. New scripts are placed in unused space beside the existing layout. Initial arrangement happens only when a file has no saved layout; reopening an older collapsed layout no longer triggers rearrangement. Home and Fit remain explicit view controls.

Full workspace layouts are stored locally in the browser, including unfinished blocks, separately from JavaScript drafts. Closing or hiding the page flushes the current layout. Existing browser layouts migrate automatically. After folder autosave is enabled, `editor/editor-layouts.json` also stores per-file position anchors and canvas views so saved source can reopen with its layout in another browser. This file contains editor metadata and is never loaded as game code. Clearing browser storage removes local unfinished layouts; the folder backup preserves the saved-script placements.


## Preview and development entry

Run preopens the game host and inspector during the click gesture, then saves pending source before navigating them. Retain popup-blocker recovery and null openers. The host at `editor/player.html` embeds the unchanged `canvas.html` in a full-window iframe; it forwards `startBroadcast` to the runtime and supplies the inspection bridge itself. The ordinary game page has no inspection dependency. Reconnect the bridge when the iframe reloads and close its channel on unload.

The arrow beside Run selects normal startup or a saved broadcast. Persist that choice locally and pass it through the preview URL; never rewrite source to choose a development entry. Runtime setup must finish with broadcasts suppressed before all matching entry listeners run concurrently. Keep setup finite, and do not infer or replay setup hidden in skipped listeners. See [runtime entry behavior](../README.md#starting-at-a-broadcast).

The bridge must use the iframe's Date/Map/Set constructors when previewing game values across realms. Inspector reads are bounded, read-only, request-driven and limited to visible polling. Never evaluate reporters, getters or functions to display values. Distinguish sprite-local variables from internal private variables, retain run IDs in selection identities, and virtualize long sprite/clone lists.

## Rules for future AI implementations

- Parse imported JavaScript with Acorn; never execute it for import, search, name discovery or renaming. Preserve unsupported JavaScript as raw blocks, intentional comments, comma-expression semantics and reporter connections. Incomplete blocks must pause source saving while retaining workspace drafts.
- Add public block APIs through literal `defineJScratchBlock` definitions in `../js/extensions.js`, following [../BLOCKS.md](../BLOCKS.md). The editor reads metadata without executing handlers. Never maintain a duplicate signature or edit vendor code. Refresh legacy discovery with `node JScratch/editor/build-catalog.mjs` from the repository root when needed; this also refreshes the recursive runtime manifest.
- Keep parameter/API names unchanged in generated JavaScript. Compact visible labels belong in `labels.mjs`: var, val/val2, width/height/radius and other existing abbreviations. Author-provided strings are never renamed for presentation.
- Preserve the canvas-first shell: compact floating controls, collapsible file/palette panels, no full-width header/footer bars. Default to the established dark color theme with bold fills, white labels, white editable fields with black text and subtle darker borders. Keep comment writing surfaces legible. Disable the yellow selection overlay without hiding insertion feedback.
- Keep arguments inline with whole-argument wrapping at the renderer's 800-unit target. Preserve `TITLE` inputs and renderer-based do/else alignment to the first nested row. Do not shift text with CSS transforms. Palette previews stay at scale 0.8 regardless of workspace zoom; use Blockly's native destination drag conversion.
- Never rearrange saved scripts or recenter a remembered canvas automatically. Source rebuilds reserve unchanged-script anchors before placing new roots. Preserve negative/fractional coordinates, per-file view, unfinished layouts, active-file selection and older-storage migration. Expand only expands; Home/Fit are explicit view actions.
- Name discovery includes live workspace contents and all executable files, excluding sample/reference files. Preserve owner scopes for costume paths, sprite vars and method locals. Deletion is disabled while references or unresolved dynamic uses remain. Rename plans preview exact edits, check source/disk baselines and migrate private name buckets with owner renames.
- Parameter header pills are reusable sources, not executable inputs. Copies serialize to `functionValue(name)`, retain their owner and work in nested value inputs. Use Blockly's native dragger for zoom/touch/snapping, group creation and insertion for undo, and keep the header intact. Primitive defaults use shadows only in rendered workspaces; computed expressions remain recoverable blocks.
- Resolve project URLs from `import.meta.url` through `projectPaths`, not the current page pathname. Keep canonical storage namespaces and older-URL migration so moving/redirecting pages cannot lose layouts.
- Request the JScratch parent folder through browser File System Access for program-source and editor-metadata writes. Existing program-only grants retain source autosave; metadata stays in browser storage until the parent is selected. Do not claim the browser can silently grant writes or add a persistent folder-change control. Never overwrite a changed disk file without resolving its conflict.

## Verification for changes

Run `node --test tests/*.mjs` and `git diff --check` from the repository root. Relevant suites include editor model/round-trip tests, parameters, symbols, references, layout, inspector and runtime-export separation. Use meaningful behavioral tests for new logic; no tests are required solely for documentation wording.

For UI changes, verify the editor through the existing Wrangler server: import/export without evaluation, nested snapping, readable wrapped fields, palette scale at different zooms, per-file layout/view persistence, undo/redo, and folder autosave using isolated fixtures. Check both ordinary and short viewports for dropdown overflow. Test parameter copy dragging into nested blocks and cross-function ownership errors when changing that path.

For Run/inspector changes, verify popup recovery, a working game iframe, selection of sprites/UI/clones, local/private values, deleted/restarted identities, iframe-realm values and visible-only polling. Confirm an exported copy with editor/ physically absent still runs raw program files and makes zero editor requests. Do not stop the user's Wrangler process or introduce a second server for these checks.

## Boolean inputs and readable operators

Boolean conditions/reporters use hexagons; number/text/value reporters remain rounded. Conditions on if, wait-until, repeat-until and while, Boolean flags such as enabled/visible, and inputs of and/or/not accept `Boolean` outputs. General value sockets can also receive Boolean reporters, allowing their results to be stored or displayed. Rounded value reporters cannot be dropped directly into a Boolean socket; use a comparison or the **test** reporter. Boolean fields offer true/false plus Expression for advanced input. Numbers retain normal text editing.

`types.mjs` centrally classifies existing Boolean reporters and inputs. New declarative blocks may set `output: "boolean"` on reporter metadata and `type: "boolean"` on a parameter (or `picker: "boolean"`); `"value"` explicitly overrides inference. Runtime normalization validates these attributes and the shared metadata parser retains them. These are presentation/connection hints, not runtime value coercion or renamed APIs.

Arithmetic/comparison/logical binary blocks display their operator between the inputs: `val + val2`, `val / val2`, `val = val2`, `val > val2`, `val ≤ val2`, and so on. Labels/search aliases live in `labels.mjs`; preserve JavaScript constructors such as `add`, `div`, `equal`, and `lEqThan` and preserve parameter ordering. Full original signatures remain in tooltips. Do not add a repeated leading operator title or redundant val labels to infix blocks.

Before loading a saved workspace, run `migrateWorkspaceTypes`: old plain fields become Boolean fields where needed, and legacy rounded reporters used as conditions receive an editor-only compatibility wrapper. These preserve existing source and truthiness, including private-parameter scope, without moving script roots. Imported `true`/`false` values use Boolean fields even in ordinary value sockets. A newly authored **test** reporter generates `not(not(value))`; a legacy wrapper in its original Boolean context exports its original value expression to avoid changing existing behavior. Moving a wrapper to an ordinary value socket uses an actual Boolean result.

Retain `VALUE` field serialization, Boolean checks, native Zelos shapes, source round trips, root IDs/anchors and layout/view restoration when modifying this path. Never tighten checks on an old serialized workspace before migration; doing so can disconnect or lose existing arguments. Include Boolean-vs-value connection tests, generated-source checks, legacy migration and rendered browser shape/picker checks.

## Empty field behavior

Unconfigured text, names, paths, keys and similar fields start as empty strings and display blank. Do not show synthetic Sprite/Play/Text placeholders, quotes, or `(none)` in an empty field. Numeric/value fields without a declared default start at `0`. Real explicit defaults (such as costume scale 1, configured colors and coordinate sides) remain intact; existing authored values are never rewritten just to change their display.

`field-values.mjs` centralizes field-role inference and wraps both smart fields and plain text inputs. Clearing text stores the valid JavaScript literal `""` while displaying nothing. Clearing a numeric/value input stores `0`; Boolean fields retain Boolean behavior, and structured array/object inputs retain `[]`/`{}`. Keep this normalization at the field-validation boundary so clearing a field does not pause autosave with a syntax error. Palette defaults and clear behavior must use the same roles, including owner-specific dropdown fields. Keep the underlying VALUE serialization as raw JavaScript and preserve Expression editing.

## Declared stage dimensions

The Stage category exposes canvasSize(width,height), canvasWidth() and canvasHeight() through shared extension metadata. Keep those runtime APIs functional without editor/. Programs normally declare canvasSize first in whenStart; production defaults to 540x360. Canvas-coordinate sprite sizes and chosen-side edge gaps are logical stage units, scaling uniformly with the fitted canvas when the browser resizes. Keep the declared logical box fixed while the visible horizontal span responds to the browser aspect ratio. Canvas mode anchors to the full box; screen mode anchors to visible edges. Both scale with height and ignore camera pan/zoom. Expose all three coordinate modes (world/canvas/screen); screen is distinct, not an alias. The preview iframe hosts the same height-filled, horizontally cropped viewport as the standalone game; inspector x/y values remain native edge offsets, not scaled display pixels.

The Stage palette also exposes screenWidth/screenHeight (visible stage units before camera zoom), separately from canvasWidth/canvasHeight (declared box). Never conflate the declared dimensions with visible viewport width, or reintroduce fit-to-width letterboxing on phones. coordinatePlane changes sides while preserving screen mode when already selected.

Screen-mode edge anchors are capped by the declared box. Their horizontal region is min(visible width, declared width), centered on the view. Keep that shared forward/inverse rule for rendering, pointer/solid sensing and motion; the inspector still shows the user's native offsets. The mode picker tooltip should distinguish this from full-box canvas anchoring on portrait screens.

All coordinate-plane offsets now measure from the chosen reference sides to the sprite center. Size/rotation edits keep the center fixed in world, canvas and screen modes. Keep this convention in movement/distance blocks, inspector values, tooltips and the shared forward/inverse geometry; do not compensate positions using costume half-extents. Screen reference edges remain bounded by the canvas box. Resizing changes the outer-edge gap naturally, not the configured center distance.
