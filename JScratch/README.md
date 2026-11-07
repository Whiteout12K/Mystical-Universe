# JScratch: JavaScript Scratch-style blocks

This document is the starting reference for AI assistants and developers working on JScratch. It describes the current implementation, including limitations, rather than promising complete Scratch compatibility.

## Purpose and project boundaries

JScratch is a browser canvas game engine with JavaScript functions that compose Scratch-style command blocks and reporters. There is no visual block editor or build step. The user's game is authored in `program/begin.js`. Its unfinished Gacha scene is intentional; do not classify missing game content as an engine bug or implement it without a request.

The entry page is `/JScratch/canvas.html` (capitalization matters). The engine previously lived at `/ml-game/`; root `_redirects` preserves old URLs. Website tools such as the team builder, map, and profile viewer are separate and live in `/webpages/apps/`. Their shared skill stylesheet is `/assets/css/mlg-skill.css`.

## Files and loading

| File | Responsibility |
| --- | --- |
| `canvas.html` | Canvas, ordered classic script tags, variable monitor |
| `js/back-process.js` | ENGINE state, block registration, execution, scheduling, rendering, Sprite class, assets, broadcasts, lifecycle |
| `js/control.js` | Control and broadcast block constructors |
| `js/operator.js` | Variables, arithmetic, conditions, strings |
| `js/sprite.js`, `js/motion.js`, `js/clone.js` | Sprites, movement, clone creation and clone events |
| `js/sensing.js`, `js/sound.js` | Pointer/keyboard, collision reporters, Web Audio |
| `js/canvas.js` | Background color and costume blocks |
| `js/json.js`, `js/data.js` | Named JSON documents and website player-data integration |
| `js/ui.js` | Canvas UI elements and convenience functions; see special execution caveat below |
| `program/begin.js` | Active game program, loaded after the engine scripts |
| `program/sample.js` | Older API examples; not loaded by the entry page and not authoritative |
| `images/` | Assets local to the engine/game |

Keep script order in `canvas.html`: back-process first, block libraries next, game program last. These are classic scripts sharing global lexical bindings, not ES modules. Relative asset URLs such as `images/menu/BG1-1.svg` resolve against the page URL, not the JavaScript file URL. Root-relative website assets remain under `/images/`.

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
| `repeat(times, ...blocks)` | Floors the count, clamps below zero, executes the body sequentially; yields when the execution budget is exhausted |
| `forever(...blocks)` | Repeats while its context is active and yields a frame after each body |
| `whileBlock(condition, ...blocks)` | Tests before every body, yields a frame after each body |
| `repeatUntil(condition, ...blocks)` | Runs while the condition is false, yields a frame after each body |
| `ifBlock(condition, ...thenBlocks, "else", ...elseBlocks)` | Executes one branch; else is optional |
| `wait(seconds)` | Waits using the runtime clock; decimal seconds supported |
| `waitUntil(condition)` | Polls until true, using runtime waits |
| `endScript()` | Ends the entire current script context, including enclosing loops; it is not a single-loop break |

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

`whenBroadcast(message, ...blocks)` registers a listener during program construction and absorbs its body. It does not run the body on registration. `broadcast(message)` starts each listener independently and continues; `broadcastAndWait(message)` waits for all matching listeners. Waiting for an infinite listener never finishes. Recursive broadcasts can create unbounded work; there is no general broadcast concurrency cap.

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
spriteCostume("Particle", "images/sample_sprite.png", 0.2);
makeClone("Particle");
```

`deleteClone()` deletes the current clone and ends its executing context; its constructor accepts no target argument. `deleteClonesOf(name)` deletes matching clones, or all clones for `"all"`. Deletion makes all contexts for those clones inactive. The current clone limit is 10,000, a safety ceiling rather than a performance target.

## Coordinates, assets, and reporters

Sprite x/y are their center, with positive y upward. Scale 1 gives a sprite width of 160 game units, preserving image aspect ratio. The nominal canvas is 640 by 360 game units, with responsive view dimensions and a device-pixel-ratio backing canvas. Motion rotation is in degrees; `sin()` and `cos()` take degrees too. `glideTo()` and `glideToSprite()` use seconds and the runtime clock. The latter captures the target position at glide start.

Costume loading is asynchronous. Assigning a costume does not await image readiness. `MLGame.preloadAssets(paths)` can preload images through the developer API. Sound requires browser audio activation through user interaction.

Sensing reporters include `keyPressed`, `touchingMouse`, `touchingSprite`, `distanceMouse`, `distanceSprite`, mouse coordinates, and date/time values. Current sprite collision tests use axis-aligned bounds. `touchingColor()` scans the sprite's own image pixels, not the rendered stage behind it, and can be expensive inside loops.

JSON APIs include `getJson(name, path)`, `jsonLoaded(name)`, `jsonValue(name, path)`, `jsonExists`, `jsonKeys`, `jsonLength`, `jsonType`, and `removeJson`. Objects/arrays returned through JSON value reporters are serialized strings; `jsonKeys()` returns a comma-separated string. Player-data blocks depend on website authentication and server endpoints; read `data.js` before changing save behavior.

## Scheduler and developer API

The browser load handler resizes the stage, initializes audio, and starts the program after a 200 ms delay. `executeBlocks()` runs commands sequentially; `executeBlock()` resolves registered handlers and reports unknown block types or thrown handler errors, then ends the affected context.

The scheduler shares a per-frame budget: approximately 500 execution turns or 6 ms before yielding. `runtimeWait()` stores waiters against `ENGINE.clock` and `frameNumber`. The animation loop advances the clock only while running and unpaused, clamps a frame's time advance to 100 ms, resolves eligible waiters, and renders. This is cooperative scheduling, not a Worker or background thread. Custom code must yield rather than blocking the main thread.

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

Async custom handlers should check `contextActive(c)` after awaiting external work and before applying results. Use `runtimeWait(..., c)` for pause-aware game timing. New containers must absorb their children and execute them with the existing context so nested `endScript()` and clone deletion propagate correctly.

## Current caveats for future changes

- `program/sample.js` contains stale/nonexistent names (`equalThan`, `jsonLoeaded`, background size/effect APIs), a malformed `deleteVar` example, and comments that do not always match behavior. Treat current constructors and registered handlers as authoritative.
- UI convenience functions call handlers immediately via `uiRun()` rather than recording commands. Do not assume they behave like ordinary deferred blocks inside repeats or conditionals.
- Several JSON, player-data, and sound handlers omit the context when resolving reporters. Clone-dependent values may fail in those APIs. Some variable reporter constructors also resolve names during construction rather than deferring them.
- Single-stepping can stall on timed/frame waits while paused. Do not assume step behavior is complete.
- Async JSON/player loads are not fully protected against obsolete results after stop/restart.
- Effect canvas sizing and repeated cache invalidation can cause unnecessary pixel processing; benchmark before optimizing.
- Fade timing uses 25 waits rather than elapsed-time interpolation. `phaseOut(0)` currently sets ghost to 0 instead of 100.

These are implementation caveats, not requests to alter the user's game. Keep documentation synchronized with fixes.

## Verification

Run `node --test tests/*.mjs` from the repository root for the existing website tests. Those tests do not comprehensively cover JScratch execution. For engine changes, additionally verify nested repeats and branches, live reporter conditions, broadcast concurrency, clone scope/deletion, waits, pause/resume, and stop/restart in the browser or a focused DOM-stubbed execution harness. Check the console and `MLGame.inspect()` for runtime errors. Verify relative images and scripts through `/JScratch/canvas.html` with the exact case.
