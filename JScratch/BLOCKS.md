# Adding JScratch blocks

Read README.md and AGENTS.md first. For visual integration, also read [editor/README.md](editor/README.md). Preserve existing game behavior and the user's flat, commented sample.js style.

## One definition for runtime and editor

Add new public blocks to `js/extensions.js` with `defineJScratchBlock(metadata, handler)`. This file already loads before programs. The editor reads its metadata directly on refresh, without executing its handlers. Do not separately edit the palette, generate a second constructor, or modify vendored Blockly code.

Metadata must be a literal object. Required fields are `name` (unique JavaScript function name) and `kind` (`command`, `reporter`, or `container`). Optional fields are `label`, `category` (default `custom`), and `params` (ordered `{name, label?, default?}` objects). Defaults are literal JSON values. Use existing categories such as `motion`, `sprite`, `ui`, `camera`, `operator`, `sensing`, `lists`, or `control`; new categories automatically use the custom color style.

The helper creates the public constructor and registers its runtime handler. Commands only record blocks during construction; reporters only create descriptions. Defaults and parameter order are shared by runtime and editor. Containers take child commands after their fixed parameters and automatically absorb those children from the outer program.

```js
// Command: raise a global score when this block actually executes.
defineJScratchBlock({
    name: "awardPoints",
    kind: "command",
    label: "award points",
    category: "operator",
    params: [{name: "amount", label: "by", default: 1}],
}, (block, context) => {
    const amount = Number(resolveValue(block.amount, context));
    if (Number.isFinite(amount)) {
        ENGINE.variables.Score = (Number(ENGINE.variables.Score) || 0) + amount;
    }
});

// Reporter: evaluated live, synchronously, in the caller's context.
defineJScratchBlock({
    name: "scoreAtLeast",
    kind: "reporter",
    label: "score at least",
    category: "operator",
    params: [{name: "minimum", default: 10}],
}, (block, context) =>
    (Number(ENGINE.variables.Score) || 0) >= Number(resolveValue(block.minimum, context))
);

// Container: reuse the engine executor, including its scheduling and cancellation.
defineJScratchBlock({
    name: "runWhen",
    kind: "container",
    label: "run when",
    category: "control",
    params: [{name: "condition", default: true}],
}, (block, context) => {
    if (resolveValue(block.condition, context)) return executeBlocks(block.blocks, context);
});
```

These examples are documentation, not installed blocks. Add only APIs requested by the user. Add a small commented usage example to `program/sample.js` for each block you actually install.

## Runtime rules that prevent common mistakes

- Resolve every reporter-valued argument with `resolveValue(value, context)` in the execution handler. Native `if (getVar(...))`, `+` on reporters, and resolving once while declaring a block are incorrect.
- Reporters must be synchronous and quick; never fetch, wait, or return a Promise from a reporter.
- Use `getContextSprite(block.name, context)` for sprite targets. It handles clone scope, `self`, exact clone IDs, and procedural UI. Do not assume UI is separate or every sprite has a costume.
- Route sprite motion through `moveSpriteWithSolids`. Use coordinate conversion helpers for mixed world/canvas targets. Right/bottom coordinate planes store inward distances, not absolute display positions.
- Reuse media alpha masks, shared layers, shared deletion, and the runtime clock. Ghost opacity does not remove collision. Crisp pixels and GIF autoplay remain always enabled.
- Use `runtimeWait(milliseconds, context)` and check `contextActive(context)` after awaited work. Do not add native blocking loops, timeouts for game timing, hidden script/clone limits, or a new scheduler.
- Use `executeBlocks(children, context)` for a new ordinary container. A custom loop needing break/continue propagation must integrate with the engine's explicit execution stack; do not simulate it with recursive JavaScript calls. Existing custom-container executor frames define the break/continue boundary.
- Parameter names cannot be engine-owned `type`, `operator`, `blocks`, `_id`, `__proto__`, `constructor`, or `prototype`. Names and defaults must match the metadata; no hand-maintained duplicate palette signatures.

## Programs, folders and initialization

`program/project.json` lists executable `files`, non-executable `references`, and folders. The editor writes it when creating files/folders or reconnecting the local program directory. `sample.js` and files under `reference/` are examples and never run. Do not load the sample as part of the game.

The runtime fetches all executable files and finishes event registration before running any `whenStart`. A broadcast can target a listener in any folder regardless of manifest order. Keep game commands inside `whenStart`, `whenBroadcast`, and `whenClone`. Multiple startup hats run concurrently. If one script depends on another's initialization, explicitly coordinate with broadcasts, broadcastAndWait, or waitUntil; changing file order is not synchronization. Arbitrary top-level JavaScript side effects and cross-file `const` evaluation still follow JavaScript rules. Keep shared helper names unique and invoke helpers during runtime rather than relying on a file having executed first.

Do not add program script tags or a second server. The existing Wrangler server serves the editor/game; browser folder permission grants local writes. For files created outside the editor, run `node JScratch/editor/build-catalog.mjs` to refresh the recursive manifest and legacy catalog. Ordinary definitions added to `extensions.js` appear in the editor on refresh without rebuilding.

## Verification

Run `node --test tests/*.mjs` and `git diff --check`. Add behavior tests for the block: live reporters, defaults, invalid values, nesting and cancellation where applicable; include clone/UI context for sprite operations. The engine harness loads extensions and checks sample coverage. Editor tests should round-trip calls with the new definition without executing handlers. Do not test only that an object has the same fields as the implementation.

In the browser, refresh the editor on Wrangler. Check its category, readable label, argument inputs, reporter connections or nested body, JavaScript output, and folder autosave. Run the saved game and inspect `ENGINE.errors` / `MLGame.inspect()`. Keep all scripts expanded. `renderer.mjs` aligns body labels to their first child's title row; preserve a named `TITLE` input and do not use CSS transforms to shift field text independently from its renderer. Check alignment after replacing or resizing nested blocks. Bold block fills use white labels and white fields with black text; each block has a subtle darker border in its own hue, with a stronger outline for selection. Panels and floating controls must not turn back into full-width bars. Comment content is plain text; source export must turn it into JavaScript comments, never executable statements.

Block inputs use inline layout; the renderer wraps whole arguments at an 800 workspace-unit target rather than creating a vertical field list. Do not add row breaks or reorder parameters in constructors to force wrapping. A single oversized reporter/value stays intact.

Use editor/labels.mjs for shared display abbreviations such as var, val/val2, width/height/radius, bg/fg and prop. Metadata/API parameter keys remain descriptive and unchanged. Labels and search may use abbreviations, but generated code and authored values must round-trip unchanged.

## Picker metadata

New definitions can opt into smart fields directly in parameter metadata:

```js
params: [
    {name: "actor", label: "sprite", default: "Player", picker: "sprite"},
    {name: "costume", default: "idle.gif", picker: "costume", owner: "actor"},
    {name: "tint", default: "#ffffff", picker: "color"},
    {name: "mode", default: "world", options: ["world", "canvas"]},
]
```

Picker kinds are `sprite`, `broadcast`, `variable` (global), `spriteVar`, `costume`, `color`, `boolean`, `list`, `sound`, and `json`. For `spriteVar`/`costume`, set `owner` to the sprite parameter name when it is not the first parameter. `options` supplies fixed string choices; use `picker: "boolean"` for actual true/false values. Metadata remains literal JSON and the handler receives the same normal JS values. Keep numeric parameters unmarked.

The editor infers existing API roles centrally in symbols.mjs. Do not add a new custom Blockly field type per command or rename argument keys. SmartValueField extends the regular expression field: saved blocks still store raw JS under VALUE. Name and color selection must emit quoted string literals; booleans must remain booleans. Keep the Expression option and ordinary reporter connections available. The registry must use current workspace contents plus every executable file, preserve unused saved names, and refuse deletion if references or unresolved dynamic uses remain. Do not populate project choices from sample/reference examples. Changes to picker metadata should be tested through both runtime/schema validation and syntax-only editor import.

## Custom methods and variadic commands

User-authored custom methods belong in program files as top-level `defineFunction` hats, not in engine metadata. Their implementations and optional returns use the existing scheduler's explicit call frames. Do not implement asynchronous method reporters or recursive `executeBlocks` calls to simulate method invocation. See README for parameter/local/result semantics.

A metadata command can specify `variadic: true`. Fixed parameters retain their normal fields and trailing argument descriptions are stored in `block._args`; resolve them in the execution context. `_args` is an engine-reserved parameter key. Containers already use rest arguments for their body and cannot also be variadic commands. The editor retains argument-count serialization and the extra-argument context menu. Function-call palette labels derive from syntax-only project definitions, not separately maintained signatures.

## Optional editor boundary

All editor-only files live under editor/, including index.html, the preview host, inspector, name/layout metadata and vendored parsing/visual libraries. canvas.html and runtime js/ cannot depend on that folder. Keep defineJScratchBlock and custom methods implemented in runtime files so raw program/*.js works without the editor. program/project.json is runtime configuration, not editor metadata; keep it in program/. Resolve editor project URLs from the module URL rather than the current page path. Folder autosave writes scripts to program/ and metadata to editor/ under a JScratch parent grant. The preview host owns inspection; do not add inspector imports back into canvas.html.

## Boolean connection metadata

Use `output: "boolean"` on reporter definitions that return Booleans. A parameter can specify `type: "boolean"` for a hexagonal Boolean socket or `type: "value"` for an ordinary value socket; `picker: "boolean"` also selects a Boolean input. Only Boolean/value hints are supported. These optional metadata attributes affect visual connections and field defaults, not execution or argument ordering. Example: `{name: "condition", type: "boolean", default: false}`. Existing predicates/condition/flag inputs are inferred centrally in `editor/types.mjs`; new predicates should declare their output explicitly.

Keep visible infix notation in editor/labels.mjs rather than renaming functions such as add, div or equal. For saved-workspace migration and legacy truthiness handling, read editor/README.md before changing Boolean checks.
