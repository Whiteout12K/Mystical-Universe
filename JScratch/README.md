# JScratch: JavaScript Scratch-style blocks

This document is the starting reference for AI assistants and developers working on JScratch. It describes the current implementation, including limitations, rather than promising complete Scratch compatibility.

## Purpose and project boundaries

JScratch is a browser canvas game engine with JavaScript functions that compose Scratch-style command blocks and reporters. There is no visual block editor or build step. The user's game is authored in `program/begin.js`. The Start button fades out the menu and broadcasts `World`; `program/world.js` defines an empty world with c1's default GIF costume and WASD/arrow movement.

The entry page is `/JScratch/canvas.html` (capitalization matters). The engine previously lived at `/ml-game/`; root `_redirects` preserves old URLs. Website tools such as the team builder, map, and profile viewer are separate and live in `/webpages/apps/`. Their shared skill stylesheet is `/assets/css/mlg-skill.css`.

## Files and loading

| File | Responsibility |
| --- | --- |
| `canvas.html` | Canvas, ordered classic script tags, variable monitor |
| `js/back-process.js` | ENGINE state, block registration, execution, scheduling, rendering, Sprite class, assets, broadcasts, lifecycle |
| `js/media.js` | Pixel rendering settings, shared GIF timelines, source alpha masks, media blocks |
| `js/vendor/gifuct.js` | Bundled GIF parser/decoder; MIT license and pinned versions in `gifuct.LICENSE.txt` |
| `js/control.js` | Control and broadcast block constructors |
| `js/operator.js` | Variables, arithmetic, conditions, strings |
| `js/sprite.js`, `js/motion.js`, `js/clone.js` | Sprites, movement, clone creation and clone events |
| `js/sensing.js`, `js/sound.js` | Pointer/keyboard, collision reporters, Web Audio |
| `js/canvas.js` | Background color and costume blocks |
| `js/json.js`, `js/data.js` | Named JSON documents and website player-data integration |
| `js/ui.js` | Deferred canvas UI commands and rendering |
| `program/begin.js` | Startup, main menu, and transition into World |
| `program/world.js` | World listener, player costume, and keyboard movement |
| `program/sample.js` | API reference examples; not loaded by the entry page |
| `images/` | Assets local to the engine/game |

Keep script order in `canvas.html`: the bundled GIF decoder first, back-process next, media next, other block libraries next, and game programs last. These are classic scripts sharing global lexical bindings, not ES modules. Relative asset URLs such as `images/menu/BG1-1.svg` resolve against the page URL, not the JavaScript file URL. Root-relative website assets remain under `/images/`.

Serve the repository root over HTTP for local use, for example `python3 -m http.server 8000`, then visit `/JScratch/canvas.html`. Static serving does not provide the website's `/api/me` or player-save endpoints.

## Construction happens before execution

Most command functions create a plain block object and call `ENGINE.recordBlock()`. They do not immediately change the game. For example, `setVar("score", 10)` constructs a command to execute later. Blocks have a `type`, `_id`, and parameters.

JavaScript evaluates child arguments before calling their parent. A container such as `repeat()` absorbs its children from the top-level program so they execute only inside that container. `ENGINE.absorbBlocks()` and `absorbNested()` support this bookkeeping; `compactProgram()` removes absorbed entries before execution. Do not manually push nested blocks into `ENGINE.scripts` or `ENGINE.program`.

Reporters such as `getVar("score")` and `add(...)` construct descriptions of values. `resolveValue(reporter, context)` evaluates them at execution time. Use reporters inside conditions and arithmetic; native JavaScript `if (getVar(...))` tests the reporter object, and native `+` does not perform reporter arithmetic.

```js
makeVar("score");
setVar("score", 0);
repeat(2,
    repeat(3,
        changeVarBy("score", 1),
    ),
);
// score becomes 6 when the program executes.
```

Use rest arguments for child commands: `repeat(3, firstBlock, secondBlock)`. Passing one array as a child is not equivalent; use `repeat(3, ...blocks)` when assembling an array yourself. Do not put arbitrary values, functions, or strings in command lists. The special string `"else"` is supported only as the separator in `ifBlock()`.

## Control flow and nesting

| API | Current behavior |
| --- | --- |
| `repeat(times, ...blocks)` | Floors finite counts, clamps below zero, executes sequentially and yields between iterations |
| `forever(...blocks)` | Repeats while its context is active and yields a frame after each body |
| `whileBlock(condition, ...blocks)` | Tests before every body, yields a frame after each body |
| `repeatUntil(condition, ...blocks)` | Runs while the condition is false, yields a frame after each body |
| `ifBlock(condition, ...thenBlocks, "else", ...elseBlocks)` | Executes one branch; else is optional |
| `wait(seconds)` | Waits using the runtime clock; decimal seconds supported |
| `waitUntil(condition)` | Polls until true, using runtime waits |
| `endScript()` | Ends the entire current script context, including enclosing loops |
| `breakLoop()` / `continueLoop()` | Exits / advances the innermost loop without ending the script |
| `withoutScreenRefresh(...blocks)` | Runs computation loops without an iteration-frame delay, still respecting the shared execution budget |
| `stopScripts(message)` | Cancels active listeners in the named broadcast group, including their nested loops and waits |

Every command in a script is awaited before the next command. A top-level infinite loop prevents later top-level commands from running. Start independent behavior using separate broadcast listeners or clone listeners.

Conditions are re-evaluated when a loop reaches its test. An outer scene condition does not interrupt an inner repeat or glide. This is expected sequential behavior; add inner checks or explicitly design cancellation if the game needs immediate scene exit.

```js
whenBroadcast("Play",
    repeatUntil(gEqThan(getVar("score"), 10),
        ifBlock(keyPressed("space"),
            changeVarBy("score", 1),
            "else",
            wait(0.05),
        ),
    ),
);
setVar("score", 0);
broadcast("Play");
```

Use `equal`, `gThan`, `lThan`, `gEqThan`, `lEqThan`, `and`, `or`, and `not` for reporter conditions. `equal()` uses strict JavaScript equality; numeric-looking strings assigned through variable setters are normalized to numbers. Most conditions use JavaScript truthiness. `whileBlock()` additionally converts literal strings `"true"` and `"false"` to booleans. Avoid relying on string truthiness for boolean conditions.

## Broadcasts, clones, and scope

`whenBroadcast(message, ...blocks)` registers a listener during program construction and absorbs its body. It does not run the body on registration. `broadcast(message)` starts each listener independently and continues; `broadcastAndWait(message)` waits for all matching listeners. Waiting for an infinite listener never finishes. Every matching listener starts independently, including multiple listeners with the same name. Broadcasting again starts another independent set; existing listeners are not cancelled or serialized. There is no default script concurrency cap. All scripts share a cooperative per-frame execution budget, including recursive broadcasts. A recursive broadcast can still grow memory indefinitely; inspect active script counts and use explicit cancellation when its work is no longer needed.

Each broadcast listener receives a fresh script context. Broadcasts started from clones do not automatically retain the originating clone context. Global variables are shared across all scripts. Sprite variables belong to the targeted sprite. Script contexts also have `privateVariables`; do not invent a public private-variable API without checking the source.

`makeClone(name)` copies the sprite's current state and starts registered `whenClone(name, ...blocks)` listeners. In clone contexts, the source sprite name or `"self"` targets that clone through context-aware sprite helpers. Use `getCloneName()`, `getCloneId()`, or the equivalent `cloneName()` / `cloneId()` reporters for clone identity.

```js
whenClone("Particle",
    repeat(10,
        moveBy("self", 2, 0),
        wait(0.02),
    ),
    deleteClone(),
);
createSprite("Particle");
spriteCostume("Particle", "images/menu/torch_full.png", 0.2);
makeClone("Particle");
```

`deleteClone()` deletes the current clone and ends its executing context; its constructor accepts no target argument. `deleteClonesOf(name)` deletes matching clones, or all clones for `"all"`. Deletion makes all contexts for those clones inactive. Clone IDs are allocated in constant time and are not reused within a run. There is no default clone cap; an optional `maxClones` setting is available. Device memory, rendering, and script workload still determine practical capacity.

## Coordinates, assets, and reporters

Sprite x/y are their center, with positive y upward. Scale 1 gives a sprite width of 160 game units, preserving image aspect ratio. The nominal canvas is 640 by 360 game units, with responsive view dimensions and a device-pixel-ratio backing canvas. Motion rotation is in degrees; `sin()` and `cos()` take degrees too. `glideTo()` and `glideToSprite()` use seconds and the runtime clock. The latter captures the target position at glide start.

Costume loading is asynchronous. Assigning a costume does not await image readiness. `MLGame.preloadAssets(paths)` can preload images through the developer API. Sound requires browser audio activation through user interaction.

Sensing reporters include `keyPressed`, `touchingMouse`, `touchingSprite`, `distanceMouse`, `distanceSprite`, mouse coordinates, and date/time values. Pointer and sprite collision tests use the current costume frame's source alpha, not the full image rectangle. Fully transparent pixels (alpha 0) never collide; every nonzero alpha, including partially transparent pixels, counts. Sprite masks are cached per decoded frame, merged into opaque row rectangles, transformed with sprite size/rotation/flips, and tested for positive-area overlap. Transparent margins and interior holes remain non-colliding. This changes sensing results only; reporters do not automatically block movement or resolve overlaps.

Ghost effects and visual opacity do not change collision masks: a 100% ghosted costume collides exactly as the same non-ghosted costume would. Explicitly hidden, deleted, unloaded, or untouchable sprites remain excluded. Pixel masks require same-origin or CORS-enabled readable images.

`touchingColor(sprite, color)` retains its existing own-costume meaning; `spriteHasColor(sprite, color)` is the clearer equivalent. Image color scans are cached per decoded costume frame. `touchingStageColor(sprite, color)` checks other sprites and the backdrop through the target's source-alpha mask, using a reusable offscreen buffer at game-unit resolution. Ghost/opacity effects are ignored for these sprite color contacts as well. Stage-color sensing is more expensive than bounds tests and requires readable same-origin or CORS-enabled images. Canvas UI is excluded from stage-color sensing.

`deltaTime()` reports seconds elapsed in the latest simulation frame. Use `moveBy("Player", mult(120, deltaTime()), 0)` inside a normal `forever()` to move at approximately 120 game units per second, rather than tying movement speed to the display refresh rate.

JSON APIs include `getJson(name, path)`, `jsonLoaded(name)`, `jsonValue(name, path)`, `jsonExists`, `jsonKeys`, `jsonLength`, `jsonType`, and `removeJson`. Objects/arrays returned through JSON value reporters are serialized strings; `jsonKeys()` returns a comma-separated string. Player-data blocks depend on website authentication and server endpoints; read `data.js` before changing save behavior.

## Media settings and GIF animation

Crisp pixels and GIF autoplay are always enabled. There is no settings button and saved media preferences from older versions are ignored. Canvas resizing and rendering always disable image smoothing and use CSS `pixelated` rendering.

GIF costume URLs ending in `.gif` (including query/fragment suffixes) and GIF data URLs are parsed with the bundled decoder, rather than relying on native `drawImage()` playback. Sprite, background, and UI images share decoded assets and animation clocks. Frame delays, transparency, disposal modes, and GIF loop counts are respected; only a small patch cache is retained, not a canvas copy of every frame. Effects and collision masks refresh when the decoded frame changes. GIF asset readiness includes preparing the decoder. On a load/decode failure the native image remains available and a console warning explains why animation could not start.

GIF playback advances whenever the runtime is running and unpaused. Restart resets GIF timelines. Decode assets are shared across scenes and clones; clones using the same GIF share its animation phase. Legacy `setPixelCrisp()` / `setGifAutoPlay()` commands and matching `MLGame.configure()` options remain accepted for compatibility, but cannot disable these features.

The standalone runtime serves its bundled decoder locally; it requires no CDN or runtime package installation. The decoder is gifuct-js 2.1.2 with js-binary-schema-parser 2.0.3; copyright/license notices are retained under `js/vendor/`.

## Scheduler and developer API

The browser load handler resizes the stage, initializes audio, and starts the program after a 200 ms delay. `executeBlocks()` runs commands sequentially; `executeBlock()` resolves registered handlers and reports unknown block types or thrown handler errors, then ends the affected context.

Control execution uses an explicit stack so deeply nested command containers do not consume the JavaScript call stack. Program trees are validated for malformed commands, unknown reporters, and cycles before execution. Reporter evaluation also detects runtime cycles; custom reporter functions must return promptly.

The scheduler shares a configurable per-frame budget: by default 500 execution turns or 6 ms before yielding. Waking scripts recheck the shared budget instead of all executing in one burst. `runtimeWait()` stores waiters against `ENGINE.clock` and `frameNumber`. The animation loop advances the clock only while running and unpaused, clamps a frame's time advance to 100 ms, resolves eligible waiters, and renders. This is cooperative scheduling, not a Worker or background thread. Custom code must yield rather than blocking the main thread.

The public API is currently named `window.MLGame`, despite the folder being named JScratch. Preserve this compatibility unless an API migration is explicitly requested. It exposes `start`, `restart`, `stop`, `pause`, `resume`, `step`, `inspect`, block/reporter registration, execution helpers, context helpers, broadcasts, and asset preloading. Runtime events are `mlgame-state` and `mlgame-error`; their names also remain unchanged.

Stopping invalidates existing contexts using a run ID and releases waiters. Restart resets sprites, clones, variables, sounds, background, input, and UI before replaying the constructed program. It does not re-run the JavaScript source files or clear every external cache/store; broadcast registrations and JSON/player stores have separate lifetimes.

## Extending the engine

Follow the existing constructor/handler/reporter pattern and preserve execution context when resolving values:

```js
function addScore(amount) {
    return ENGINE.recordBlock(createBlock("addScore", {amount}));
}
registerBlock("addScore", (b, c) => {
    const amount = Number(resolveValue(b.amount, c));
    if (Number.isFinite(amount)) {
        ENGINE.variables.score = (Number(ENGINE.variables.score) || 0) + amount;
    }
});
registerReporter("scoreValue", () => ENGINE.variables.score ?? 0);
function scoreValue() {
    return createReporter("scoreValue");
}
```

Async custom handlers should check `contextActive(c)` after awaiting external work and before applying results. Use `runtimeWait(..., c)` for pause-aware game timing. New containers must absorb their children and execute them with the existing context so nested `endScript()` and clone deletion propagate correctly. Custom containers that invoke `executeBlocks()` have their own call frame; `breakLoop()` / `continueLoop()` target loops in that invocation.

## UI, cancellation, loading, and debugging

UI convenience functions construct recorded commands, just like sprite and variable commands. They run only when reached, so conditions, repeats, broadcasts, and clone contexts work consistently. UI arguments are resolved at execution time. `ENGINE.renderUI` is invoked exactly once after sprites by the main renderer. The lower-level `MLGame.UI.create/get/delete/clear` developer methods remain immediate.

`stopScripts("Scene name")` or `MLGame.cancelScripts("Scene name")` ends all active broadcast contexts in that group. This is optional; changing a variable named `Scene` does not implicitly cancel anything. Clone listeners are grouped by their source sprite name. Stop/restart invalidates all script contexts and aborts pending JSON/player requests. JSON/player loads have a configurable 30-second deadline covering the response body; obsolete results cannot update the next run. Player-save writes are ordered within each run to preserve concurrent increments, while other scripts continue. Aborting a save cannot undo a change the server already accepted.

Pause freezes the game clock. A debugger step selects one executable command across concurrent scripts. Stepped timed waits, glides, and fades complete immediately without advancing other scripts' clocks; the next command parks until another step or resume. A stepped `waitUntil()` polls once and stays blocked if false. An empty loop can be advanced with further steps. `broadcastAndWait()` still depends on its receiver scripts completing; step those receivers or resume to finish it.

Fades use elapsed runtime time, including the zero-duration case. Sprite effect pixels are cached at natural image size, independent of display size and ghost opacity. Stop Sound invalidates pending playback as well as existing instances.

Runtime errors include script/listener name, clone ID when present, and enclosing block IDs. `MLGame.inspect()` includes active-script and waiter counts. There is no promise of unlimited performance: commands and reporters run on the main browser thread, and a custom blocking handler cannot be preempted by this scheduler.

```js
// Developer configuration; omitted limits retain these defaults.
MLGame.configure({
    maxClones: Infinity,
    budgetLimit: 500,
    budgetMs: 6,
    requestTimeout: 30000,
});

// Bulk computation can run quickly while still letting other scripts/rendering run.
withoutScreenRefresh(
    repeat(10000, changeVarBy("total", 1)),
);
```

This API remains Scratch-inspired rather than fully Scratch-compatible. Existing strict equality, arithmetic/random-number behavior, and global broadcast scope remain explicit differences.

## Verification

Run `node --test tests/*.mjs` from the repository root for the existing website tests. `tests/test-jscratch-engine.mjs` adds focused execution coverage, including simultaneous same-name listeners, nested control flow, frame budgets, clones beyond the former ceiling, UI, alpha-mask collision, GIF frame timing/caches, media settings, cancellation, loading, and debugger stepping. For engine changes, additionally verify nested repeats and branches, live reporter conditions, broadcast concurrency, clone scope/deletion, waits, pause/resume, and stop/restart in the browser or a focused DOM-stubbed execution harness. Check the console and `MLGame.inspect()` for runtime errors. Verify relative images and scripts through `/JScratch/canvas.html` with the exact case.
