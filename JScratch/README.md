# JScratch: JavaScript Scratch-style blocks

This document is the starting reference for AI assistants and developers working on JScratch. It describes the current implementation, including limitations, rather than promising complete Scratch compatibility.

## Purpose and project boundaries

JScratch is a browser canvas game engine with JavaScript functions that compose Scratch-style command blocks and reporters. The user's game is authored in event scripts under `program/`, with startup/menu flow in `program/begin.js`. The Start button fades out the menu and broadcasts `World`; `program/world.js` defines an empty world with c1's default GIF costume and WASD/arrow movement. The player can move fully off stage; its position is not clamped to the visible canvas.

The entry page is `/JScratch/canvas.html` (capitalization matters). The engine previously lived at `/ml-game/`; root `_redirects` preserves old URLs. Website tools such as the team builder, map, and profile viewer are separate and live in `/webpages/apps/`. Their shared skill stylesheet is `/assets/css/mlg-skill.css`.

## Files and loading

| File | Responsibility |
| --- | --- |
| `canvas.html` | Canvas, ordered classic script tags, variable monitor |
| `js/back-process.js` | ENGINE state, block registration, execution, scheduling, rendering, Sprite class, assets, broadcasts, lifecycle |
| `js/media.js` | Pixel rendering settings, shared GIF timelines, source alpha masks, media blocks |
| `js/camera.js` | Camera movement/follow/zoom blocks, viewport transforms, off-screen culling |
| `camera.json` | Default camera position, zoom, follow target, and culling |
| `js/vendor/gifuct.js` | Bundled GIF parser/decoder; MIT license and pinned versions in `gifuct.LICENSE.txt` |
| `js/control.js` | Control and broadcast block constructors |
| `js/lists.js` | Named, mutable, one-based lists and live list reporters |
| `js/solid.js` | Opt-in directional solid response, target selection, swept movement and sliding |
| `js/operator.js` | Variables, arithmetic, conditions, strings |
| `js/sprite.js`, `js/motion.js`, `js/clone.js` | Sprites, movement, clone creation and clone events |
| `js/sensing.js`, `js/sound.js` | Pointer/keyboard, collision reporters, Web Audio |
| `js/canvas.js` | Background color and costume blocks |
| `js/json.js`, `js/data.js` | Named JSON documents and website player-data integration |
| `js/ui.js` | Procedural Sprite subclass: text, bars, shapes, live bindings, and image UI |
| `js/block-api.js`, `js/extensions.js` | Declarative runtime block definitions and extension constructors |
| `js/program-loader.js`, `program/project.json` | Recursive program discovery and startup registration barrier |
| `BLOCKS.md` | AI/developer guidance for adding blocks safely |
| `program/begin.js` | Startup, main menu, and transition into World |
| `program/world.js` | World listener, player costume, and keyboard movement |
| `program/sample.js` | Flat, commented examples for every public block; not loaded by the entry page |
| `images/` | Assets local to the engine/game |

Keep script order in `canvas.html`: the bundled GIF decoder first, back-process next, media and camera next, other block libraries next, and extensions plus the program loader last. These are classic scripts sharing global lexical bindings, not ES modules. `js/block-api.js` supplies extension metadata validation before the engine loads; `js/extensions.js` installs custom blocks before `js/program-loader.js` loads the recursive program manifest. Relative asset URLs such as `images/menu/BG1-1.svg` resolve against the page URL, not the JavaScript file URL. Root-relative website assets remain under `/images/`.

Serve the repository root over HTTP for local use, for example `python3 -m http.server 8000`, then visit `/JScratch/canvas.html`. Static serving does not provide the website's `/api/me` or player-save endpoints.

## Running and exporting the game

Keep `canvas.html`, `camera.json`, `js/` (including its vendor files), `program/` (including `project.json`), and all assets referenced by your scripts. Serve these files over HTTP/static hosting and open `canvas.html`; fetching program files and configuration requires HTTP rather than opening the page with `file://`. The runtime executes raw JavaScript directly without a build step.

`program/project.json` explicitly lists executable files. For example:

```json
{
  "version": 1,
  "files": ["begin.js", "world.js", "scenes/battle.js"],
  "references": ["sample.js"],
  "folders": ["scenes"]
}
```

When adding scripts by hand, update `files`; a folder is not automatically scanned by the browser. Keep paths relative to `program/`. All executable files finish event/function registration before startup. Put game work inside event bodies and use explicit synchronization for dependencies. `sample.js` and `reference/` examples are excluded from execution.

Keep `js/block-api.js` and `js/extensions.js`: both supply runtime behavior, including custom functions. Preserve script-tag loading order in `canvas.html`. Asset paths resolve against the game page, so root-relative images/audio and website player-save APIs must remain available on the host when your game uses them.

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

## Startup scripts

Use `whenStart(...blocks)` to define a startup script instead of leaving game commands at the top level:

```js
whenStart(
    loadPlayerData(),
    setVar("Scene", "Main Menu"),
    broadcast("Main Menu"),
);
```

Children are absorbed from the top-level program during construction and execute on every start/restart. Multiple startup hats run independently and concurrently, just like matching broadcast listeners. They obey the same waits, cancellation, frame budgets, and nesting rules. Legacy top-level commands remain supported for existing programs. Keep event declarations at the top level, with commands inside their bodies.

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

World-coordinate sprite x/y are their center, with positive y upward. Scale 1 gives a sprite width of 160 game units, preserving image aspect ratio. The default logical canvas is 540 by 360 stage units. Its declared box stays fixed while its height fills the container and its centered visible horizontal span responds to the screen aspect ratio; the backing buffer accounts for device pixel ratio. Motion rotation is in degrees; `sin()` and `cos()` take degrees too. `glideTo()` and `glideToSprite()` use seconds and the runtime clock. The latter captures the target position at glide start.

Costume loading is asynchronous. Assigning a costume does not await image readiness. `MLGame.preloadAssets(paths)` can preload images through the developer API. Sound requires browser audio activation through user interaction.

Sensing reporters include `keyPressed`, `touchingMouse`, `touchingSprite`, `distanceMouse`, `distanceSprite`, mouse coordinates, and date/time values. Pointer and sprite collision tests use the current costume frame's source alpha, not the full image rectangle. Fully transparent pixels (alpha 0) never collide; every nonzero alpha, including partially transparent pixels, counts. Sprite masks are cached per decoded frame, merged into opaque row rectangles, transformed with sprite size/rotation/flips, and tested for positive-area overlap. Transparent margins and interior holes remain non-colliding. Sensing reporters alone do not block movement. Opt-in solid response, described below, uses the same costume masks to constrain motion.

Ghost effects and visual opacity do not change collision masks: a 100% ghosted costume collides exactly as the same non-ghosted costume would. Explicitly hidden, deleted, unloaded, or untouchable sprites remain excluded. Pixel masks require same-origin or CORS-enabled readable images.

`touchingColor(sprite, color)` retains its existing own-costume meaning; `spriteHasColor(sprite, color)` is the clearer equivalent. Image color scans are cached per decoded costume frame. `touchingStageColor(sprite, color)` checks other sprites and the backdrop through the target's source-alpha mask, using a reusable offscreen buffer at game-unit resolution. Ghost/opacity effects are ignored for these sprite color contacts as well. Stage-color sensing is more expensive than bounds tests and requires readable same-origin or CORS-enabled images. Procedural UI uses the same source masks and participates as ordinary sprites, including in stage-color sensing.

`deltaTime()` reports seconds elapsed in the latest simulation frame. Use `moveBy("Player", mult(120, deltaTime()), 0)` inside a normal `forever()` to move at approximately 120 game units per second, rather than tying movement speed to the display refresh rate.

JSON APIs include `getJson(name, path)`, `jsonLoaded(name)`, `jsonValue(name, path)`, `jsonExists`, `jsonKeys`, `jsonLength`, `jsonType`, and `removeJson`. Objects/arrays returned through JSON value reporters are serialized strings; `jsonKeys()` returns a comma-separated string. Player-data blocks depend on website authentication and server endpoints; read `data.js` before changing save behavior.

## Procedural UI sprites and canvas coordinates

UI elements are `UISprite` objects extending `Sprite`, stored in the same named sprite registry and rendered in the same layer order. Text, boxes/panels, circles, lines, buttons, and bars generate their own image pixels. They do not need a user-created costume for every value or progress state. Existing `uiText`, `uiProgressBar`, `uiBox`, and other constructors retain their argument signatures. `uiImage` remains available when an actual image is wanted.

World space is the default, including for UI. Positions are sprite centers. The usual movement, glides, scale, rotation, facing/flips, visibility, opacity, effects, variables, layering, cloning, alpha sensing, and opt-in solid response work with UI names. For UI, scale `1` is the generated element's configured dimensions (not the image-sprite 160-unit width). `uiSetSize()` changes those base dimensions; `spriteSetSize()` / `uiSetScale()` multiply them. Text measures its content automatically unless width/height are explicitly supplied. Lines are centered sprites; their `toX`/`toY` arguments describe the local line vector, with `width` as stroke thickness.

```js
uiText("Scoreboard", join("Score: ", getVar("Score")), 0, 120, 24, "#fff");
uiProgressBar("Health", 0, 100, 200, 20,
    getSpriteVar("Player", "Health"), getSpriteVar("Player", "Max Health"),
    "#333", "#2b5");
moveBy("Health", 10, 0);
spriteEffect("Scoreboard", "brightness", 20);
setSpriteVar("Health", "Owner", "Player");
```

Visual reporters such as text, bar value/max, color, and generated dimensions stay live; no `forever(uiSetText(...))` refresh loop is required. Changed visual values regenerate the cached bitmap and alpha mask; unchanged values reuse the same image. Transforms do not regenerate the bitmap. Off-screen UI defers rasterization until drawing or sensing actually needs the pixels.

| UI updater | Usage |
| --- | --- |
| `uiSetValue(id, value)` / `uiSetMax(id, max)` | Set or bind a bar's value / maximum |
| `uiSet(id, property, value)` | Set a shared transform property or generated visual style field |
| `uiBind(id, property, reporter)` | Explicitly bind a transform or visual property to a live value |
| `uiUnbind(id, property)` | Keep the current resolved value and remove its binding |
| `uiGet(id, property)` / `uiExists(id)` | Read a current property / check the UI object exists |

For example, `uiBind("Health", "x", spriteX("Player"))` follows the player's x coordinate. A bound transform owns that property; unbind it before moving it independently. Clone-scoped values retain their context, and cloned UI rebinds `"self"`/family-name reporters to that UI clone's own variables. UI and ordinary sprites share unique names. Generic `deleteSprite()` and `deleteAllSprites()` also remove UI; `uiClear()` removes only UI originals and clones. `goFront()` / `goBack()` and `uiSetLayer()` use the common sprite layer order, so fixed HUDs can be brought above world objects explicitly.

### Canvas-fixed coordinate mode

`spriteCoordinateMode(name, "canvas")` works for **any** sprite, including procedural UI. Canvas mode uses declared logical stage units from the canvas's top-left corner, x rightward and y downward. Positions measure the distance from the chosen canvas sides to the sprite's center. `(0, 0)` puts that center on the selected corner; the default sides are left/top. Width/height use the same logical stage units as edge gaps. Browser/container resizing scales the complete canvas, including sprite sizes and edge gaps, proportionally. Camera pan/zoom affects only world sprites; it does not resize canvas-mode sprites relative to the stage. Device-pixel-ratio scaling is applied internally.

```js
spriteCoordinateMode("Scoreboard", "canvas");
moveTo("Scoreboard", 100, 30); // Sprite center sits 100 stage units from left, 30 from top.
goFront("Scoreboard");
spriteCoordinateMode("Start Button", true); // true = canvas; false = world.
coordinatePlane("Start Button", "right", "bottom");
moveTo("Start Button", 80, 30); // Sprite center sits 80 stage units from right, 30 from bottom.
```

`"world"` restores normal world coordinates. `"canvas"` anchors to the full declared box; `"screen"` anchors to the visible screen edges, bounded by the declared canvas box on wider screens. Screen mode is distinct from canvas mode, not an alias. `coordinateModeOfSprite(name)` reports the normalized mode. Switching modes retains the numeric position/size and reinterprets them in the selected space; it does not automatically convert the previous on-screen position. `coordinatePlane(name, horizontal = "left", vertical = "top")` chooses left/right and top/bottom axes. It selects canvas mode for world sprites and preserves screen mode for sprites already in screen mode. Positions and x/y reporters become inward distances from those sides to the sprite center; positive movement increases that distance. Offsets survive resizing, cloning, and movement. Negative distances allow off-screen placement. Switching planes keeps the numeric distances. `moveToEdge` has been removed. Mouse hits, mixed-mode sprite contacts, and directional solid response use the same projected positions the renderer displays. `moveToSprite()` / `glideToSprite()` convert target centers between spaces; x/y reporters report the sprite's native mode, and distance reporters use the first sprite's units. Camera following is for world sprites; switching a followed sprite to canvas or screen mode stops following it.

## Lists and directional solid collision

Solid response is off by default. It is designed for top-down movement: there is no gravity, automatic velocity, jumping, bouncing, or pushing other sprites. Each moving sprite independently chooses whether to use response and which names to interact with. Other enabled sprites do not become global obstacles automatically.

```js
// After creating/positioning Player, Wall, Rock and Door:
makeList("World Solids", ["Wall", "Rock"]);
spriteCollisionTargets("Player", getList("World Solids"));
spriteSolid("Player", true);
moveBy("Player", 100, 0); // Stops short if one of those costume shapes blocks the path.
addToList("World Solids", "Door"); // Player now also interacts with Door.
spriteSolid("Player", false); // Its movement is unrestricted again; the target list is retained.
```

The selection is directional: if Player selects Wall, Player is blocked by Wall even if Wall has no response enabled. Wall's own movement checks only Wall's enabled flag and target list. To block both sprites, enable both and select each other. Disabling a sprite's own response does not remove it from another sprite's list of obstacles; remove its name from that other list when that is desired.

`spriteCollisionTargets(name, targets)` accepts a single sprite name, an array of names, or a reporter returning an array. `getList()` and array-valued `getVar()` / `getSpriteVar()` arguments are retained as live reporters and resolved at each movement, so selections can change without reassigning the sprite. A source name matches the original and all its clones; a clone ID name such as `"Wall#42"` selects only that clone. The moving sprite never blocks itself. Missing/deleted/unloaded/hidden/untouchable targets are skipped, and they do not need their own solid response enabled. Ghost=100 and opacity=0 do not remove source-alpha collision.

| Solid command / reporter | Usage |
| --- | --- |
| `spriteSolid(name, enabled = true)` | Enable/disable that sprite's own movement response |
| `spriteCollisionTargets(name, targets)` | Select literal names or a live list/array reporter |
| `solidEnabled(name)` | Report whether its response is enabled |
| `solidTargets(name)` | Report its currently resolved name array |
| `solidBlocked(name)` | Report whether the last movement was obstructed |
| `solidContacts(name)` | Report the last movement's hit names / clone ID names as an array |

`moveBy`, `moveTo`, `moveToSprite`, `glideTo`, `glideToSprite`, and explicit edge anchoring obey enabled response. Continuous swept checks prevent a single long move from skipping through thin selected obstacles. The remaining motion slides along the first contact surface and is swept again against the selected targets to stop at corners. Zoom and off-screen culling do not affect collision geometry. Glides keep their original duration and may finish short of their destination when blocked.

Collision response constrains movement, not costume, scale, rotation, or raw developer assignments to `.x` / `.y`. Those changes can create an existing overlap; the solver allows escape/tangential movement and blocks movement deeper into the overlap, without automatically pushing bodies apart. Disable response before intentional teleport placement and enable it afterward. Clones copy the source's enabled state and target selection, while live target reporters resolve in the moving clone's context. Last-contact state starts empty on a new clone.

Lists are global within the runtime and reset on restart. Item positions are **1-based**; `"last"`, `"random"` / `"any"` work where an item index is accepted, and deletion additionally accepts `"all"`. Invalid indices do nothing (or report an empty string for `listItem()`). These commands do not write website saves.

| List command / reporter | Usage |
| --- | --- |
| `makeList(name, items = [])` | Create only if missing |
| `setList(name, items)` | Replace with a copy of an array or array reporter |
| `addToList(name, item)` | Append; creates missing lists |
| `insertInList(name, index, item)` | Insert before a one-based index; length+1 appends |
| `replaceInList(name, index, item)` | Replace an existing item |
| `deleteFromList(name, index)` | Remove one item, or `"all"` |
| `clearList(name)` | Empty the list without deleting its name |
| `deleteList(name)` | Delete the named list |
| `getList(name)` | Report the live item array; missing names report `[]` |
| `listItem(name, index)` | Report an item or `""` for invalid positions |
| `listLength(name)` | Report item count |
| `listContains(name, item)` | Strict-equality item membership |

[`program/sample.js`](program/sample.js) uses flat examples grouped under `// <----- ... Blocks ----->` headings, with inline descriptions and bare reporter calls. It covers every registered block and reporter, including camera, media compatibility, lists, solids, UI, JSON, data, and custom blocks. Copy the individual examples into your game. This file constructs independent example commands and contains destructive commands and infinite loops; it is a reference, not a complete program to load alongside `begin.js`. The regular entry page continues to load the user's menu and World.

## Camera and off-screen rendering

[`camera.json`](camera.json) supplies the camera defaults. It is loaded once before the program starts; invalid or unavailable configuration falls back to `(0, 0)`, zoom `1`, and culling enabled. Restart and `cameraReset()` restore the loaded defaults. JSON stores settings; executable blocks are implemented separately in `js/camera.js`.

```json
{
  "x": 0,
  "y": 0,
  "zoom": 1,
  "follow": null,
  "offsetX": 0,
  "offsetY": 0,
  "offscreenCulling": true
}
```

Set `follow` to a sprite name such as `"Player"` to follow it as soon as it exists. Defaults do not enable following automatically. Coordinates are world units, with positive y upward. Zoom is a positive multiplier: `2` is twice as close, `.5` shows twice as much world. Neither zoom nor camera movement changes sprite positions, costume scales, dimensions, or collision shapes. Procedural UI defaults to world space and pans/zooms like sprites. Any sprite can opt into canvas mode to keep its logical stage-relative position and size independent of the camera.

| Block / reporter | Behavior |
| --- | --- |
| `cameraTo(x, y)` | Sets the view center and stops following |
| `cameraBy(x, y)` | Moves the view center by an offset and stops following |
| `cameraToSprite(name)` | Captures the sprite's position once, including clone-context `"self"` |
| `cameraFollow(name, offsetX = 0, offsetY = 0)` | Continuously follows a named sprite or current clone |
| `cameraStopFollowing()` | Keeps the current view center and stops following |
| `cameraZoom(multiplier)` | Sets the camera zoom without resizing sprites |
| `cameraX()`, `cameraY()`, `cameraZoom()` | Report current camera coordinates / zoom |
| `cameraReset()` | Restores the JSON defaults |

```js
// Place these inside a scene listener after creating Player.
cameraTo(0, 0);
cameraTo(spriteX("Player"), spriteY("Player")); // One-time position.
cameraFollow("Player");                        // Or continuously follow.
cameraZoom(2);
```

Sprite and background drawing, mouse-to-world coordinates, and edge anchoring use the zoomed viewport. Background costumes occupy world space centered at `(0, 0)` and pan/zoom with the camera; the background color still fills the entire view. Responsive resizing preserves camera position and zoom.

Off-screen culling rejects sprites using their rotated/scaled bounds before effects, GIF compositing for drawing, or canvas draw calls. Partly visible sprites remain visible. It also skips fully off-screen background images. This is a drawing optimization only: off-screen sprites and clones retain their scripts, positions, animation timelines, and collisions. Returning sprites use the current GIF timeline rather than restarting animation. `MLGame.inspect()` exposes `camera` and per-render `render.drawn` / `render.culled` counts. Culling can be disabled through the JSON config for debugging.

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

Read [BLOCKS.md](BLOCKS.md) before adding public blocks. Declare them in `js/extensions.js` with `defineJScratchBlock(metadata, handler)`. The runtime helper creates the JavaScript constructor, records commands for later execution, and registers handlers. Reporters construct live value descriptions. Containers absorb their trailing child commands.

```js
defineJScratchBlock({
    name: "awardPoints",
    kind: "command",
    category: "operator",
    params: [{name: "amount", default: 1}],
}, (block, context) => {
    const amount = Number(resolveValue(block.amount, context));
    if (Number.isFinite(amount)) {
        ENGINE.variables.Score = (Number(ENGINE.variables.Score) || 0) + amount;
    }
});
// In a game event: awardPoints(10)
```

Resolve reporter arguments with the current context. Async handlers must check `contextActive(context)` after external work before applying results. Use `runtimeWait(milliseconds, context)` for pause-aware timing. New ordinary containers execute their absorbed children with `executeBlocks(children, context)` so cancellation and clone context propagate. Custom containers have their own executor frame; break/continue target loops in that invocation. New loops and custom-method calls must integrate with the explicit execution stack rather than recursively calling JavaScript. Add examples to the flat `program/sample.js` reference.

## UI, cancellation, loading, and debugging

UI convenience functions construct recorded commands, just like sprite and variable commands. They run only when reached, so conditions, repeats, broadcasts, and clone contexts work consistently. Visual reporter values remain live, while transform arguments are resolved when the command executes unless explicitly bound. UI objects are drawn once in the shared sprite layer order; they do not use a second automatic overlay pass. The lower-level `MLGame.UI.create/get/delete/clear` developer methods remain immediate; `MLGame.UI.render()` is only a manual compatibility helper and normally should not be called.

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

## Custom functions

Use `defineFunction(name, parameters, ...body)` at the top level to define a reusable method. `callFunction(name, ...values)` waits for its body, resolves argument reporters in the caller's context, and retains the caller's clone context. Each call has private parameter/local values; recursive and simultaneous calls use independent scheduler frames.

```js
defineFunction("Damage", ["target", "amount"],
    setSpriteVar(functionValue("target"), "HP",
        sub(getSpriteVar(functionValue("target"), "HP"), functionValue("amount"))),
    returnFunction(getSpriteVar(functionValue("target"), "HP")),
);
whenBroadcast("Hit",
    callFunction("Damage", "Enemy", 10),
    setVar("Remaining HP", functionResult()),
);
```

`functionValue(name)` reads a parameter/local; `setFunctionValue(name, value)` writes one. `returnFunction(value)` exits the nearest custom call, including nested loops. A call that reaches the end returns an empty string. `functionResult()` reads this script's last completed call result; copy it before another call replaces it. Custom blocks are commands with optional return values, rather than asynchronous reporter expressions. Parameters are passed in declaration order and counts must match. Definitions register before startup regardless of file order; duplicate definitions produce a runtime error. Break/continue cannot escape a call into its caller's loop. Stop, restart, waits and debugger stepping retain the existing scheduler behavior.

## Starting at a broadcast

Open `canvas.html?startBroadcast=World`, call `MLGame.startAtBroadcast("World")`, or use `beginGameAtBroadcast("World")` in a game script to perform a clean reset and enter a chosen broadcast. The runtime completes all startup commands with broadcasts suppressed, then launches all matching listeners concurrently and restores ordinary broadcast behavior. Both broadcast and broadcast-and-wait are skipped during initialization. Setup errors or stopping the runtime prevent entry launch; a missing entry reports an error.

Put shared sprite/variable setup in finite startup blocks. Setup hidden in a skipped scene listener cannot be inferred or replayed automatically. A startup loop or a wait depending on a suppressed listener prevents initialization from finishing; put ongoing behavior in scene listeners. Normal startup retains the game's existing behavior.

`beginGameAtBroadcast("World")` provides the same clean development restart from a block, and `MLGame.startAtBroadcast("World")` is available to JavaScript integrations. During suppressed startup the restart block is skipped so replaying it cannot create a restart loop. This controls the first scene only; it does not permanently restrict later broadcasts.

## Verification

From the repository root, run `node --test tests/test-jscratch-engine.mjs` for focused runtime coverage or `node --test tests/*.mjs` for the complete repository suite. The engine harness covers concurrent broadcasts, deep nesting, clone scope, live reporters/lists, custom functions, GIFs, UI, camera/coordinate modes, collisions, cancellation, loading and debugger stepping.

For runtime changes, check nested loops/branches, waits, pause/resume, stop/restart, same-name broadcast concurrency and clone deletion through `/JScratch/canvas.html` or the DOM-stubbed engine harness. Inspect `MLGame.inspect().errors` and the console. Verify relative asset URLs with the exact `JScratch` capitalization, and run `git diff --check` before finishing.

### Declared canvas box and height-filled view

Put `canvasSize(width, height)` first in `whenStart(...)`. The default declared box is **540 × 360**. `canvasWidth()` and `canvasHeight()` report that fixed logical box, not browser dimensions. Positive finite sizes are required. Clean restarts restore the default then replay startup declarations. Changing the box size does not move the camera or change its zoom.

The declared height always fills the browser/container height. Horizontal visible span is `containerWidth / (containerHeight / declaredHeight)` stage units. The view stays centered on the current camera position (default `(0, 0)`): narrow portrait screens crop the box's sides; wide screens show the full box with black side bars beyond it. Neither case changes the declared 540 × 360 box. Rendering uses a viewport-sized backing buffer rather than stretching the logical box. The height is always filled; only wider-than-box screens have horizontal side bars. There is no horizontal scroll.

For a 540 × 360 box, a 1080 × 720 browser shows 540 stage units across; a 360 × 720 phone shows the middle 180 units; a 1440 × 720 browser spans 720 logical screen units, of which the central 540 belong to the game box and the rest are side bars. The vertical span remains 360 at zoom 1. Camera zoom changes visible world extents, but never the declared box or HUD scale. `screenWidth()` and `screenHeight()` report the browser/container span in logical stage units before camera zoom (including any side bars), while canvasWidth/canvasHeight always report the declared box.

| Sprite mode | Position and size behavior |
| --- | --- |
| `world` | Center coordinates relative to the camera, transformed by camera pan/zoom |
| `canvas` | Edge gaps relative to the full declared box, centered within the view; box-edge HUDs may be cropped on phones |
| `screen` | Edge gaps relative to the intersection of the visible viewport and declared box: follows portrait crops but stops at box edges on wider screens |

Both fixed modes use logical stage units and scale with the height. An 80-unit-wide button is 160 display pixels wide when a 360-unit stage fills a 720-pixel-high browser. A 10-unit gap is then 20 display pixels. Browser width changes the edge reference for screen mode, not the button's native size. Camera pan/zoom affects neither fixed mode.

```js
whenStart(
    canvasSize(540, 360),
    uiBox("HUD", 0, 0, 80, 30, "#2d5"),
    coordinatePlane("HUD", "right", "bottom"),
    spriteCoordinateMode("HUD", "screen"),
    moveTo("HUD", 10, 12),
);
```

Use `"canvas"` instead of `"screen"` to keep those gaps relative to the full desktop-designed box. Chosen sides survive mode changes and cloning; selecting sides after screen mode preserves screen mode. All coordinates, go-to targets and distance reporters use sprite centers. Size and rotation changes do not move that center; the costume expands/contracts equally in all directions. World coordinates remain centered at `(0, 0)` when the camera is at its default; the fixed box and visible screen share that center.

A ResizeObserver watches the container. Pointer mapping, hit tests, solids and culling use the visible viewport, including its page offset and DPI. Hidden containers keep valid metrics until shown. Source-alpha collision rules, intentional negative/excessive offsets, and off-stage world movement remain supported. Camera configuration remains page-relative.

### Sprite detail and rendering resolution

Declared canvas units control layout and camera behavior, not image resolution. The backing buffer matches the displayed canvas width/height multiplied by the actual device pixel ratio. World and fixed-mode sprites draw directly from their original-resolution image/GIF frame into that buffer; no low-resolution stage-sized image is enlarged afterward. Small logical canvas dimensions therefore do not impose a coarse pixel grid or discard source detail before display.

Rendering remains nearest-neighbor/crisp, as requested for pixel art. Actual displayed size and source-asset resolution still determine how much detail can be visible; changing raster resolution does not change sprite dimensions, edge gaps, camera zoom, collisions or movement units.

Screen-mode anchor width is `min(screenWidth(), canvasWidth())`, centered in the view. Thus a right-edge gap follows the phone's right edge while cropped, but follows the declared canvas right edge once the full box is visible. Left-edge gaps behave symmetrically. Top/bottom are shared because the declared height fills the view. The stored offsets, sprite sizes, rotation, camera behavior and rendering resolution are unchanged. `screenWidth()` still reports the full visible span, not this bounded anchoring width.

### Center origin and resizing

Every sprite's own `(0, 0)` is the center of its costume/UI rectangle, in every coordinate mode. Canvas/screen side offsets also measure to this center, not to the outer bounds. A sprite 40 units from the right edge stays centered 40 units from that edge when its width or rotation changes. Its outer-edge gap consequently changes as it grows or shrinks; an object whose center is very near a boundary may extend across that boundary.

Screen mode still chooses the intersection of the visible screen and the declared canvas box for its reference edges. Canvas mode always uses the full box. At an exact-fit browser aspect ratio, their edges and center distances coincide. Portrait screen mode follows the cropped visible sides; widescreen screen mode stops at the declared box's sides. Go-to-sprite aligns centers even for different costume sizes or coordinate modes, and distance-to-sprite/mouse measures from the same center.

### Exact screen offsets and visible box edges

Screen-mode rendering and center-offset calculations share `stageVisibleArea()`: the intersection of the centered declared box and the logical browser viewport. All game drawing is clipped to that region, so oversized background sprites cannot move the apparent boundary where black bars begin. At `(50, 50)` on left/top axes, the sprite center is exactly 50 logical units inward from that same region's left/top edges. On narrow screens that region starts at the browser edge; on wide screens it starts at the canvas-box edge. Scale to display pixels by multiplying by `displayScale`; stored offsets and all width reporters remain logical units.

The camera's drawable width/culling extent is capped by the declared box as well as the screen. Off-box sprites still run their scripts and collisions, but do not paint or receive pointer hits in black side bars.
