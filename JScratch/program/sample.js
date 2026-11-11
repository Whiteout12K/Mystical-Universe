// Code block examples. Copy the blocks you need into your program.
// This is a reference, not a complete game. Do not load alongside begin.js.

// <----- Canvas Blocks ----->

canvasColor("#686565"); // Sets the canvas color if no image. Parameter: color_hex

canvasCostume("images/menu/BG1-5.png", 2); // Sets the canvas costume. Parameter: costume_path. Can be blank for no image.

// Set the background scale with canvasCostume(path, scale).

// There is no separate canvasChangeSize() command.

// Background effects currently have no public command constructor.
//  Effect List: 
//    brightness: changes sprite costume brightness, from 0-100%, where max is bright white.
//    ghost: changes the sprite's opacity, from 0-100%.
//    color: changes the sprite's color, from 0-100. 0 is default, and 100 is also default. In between, the sprite goes through the color spectrum.
//           This basically changes the hue of the colors.

// MLGame.ENGINE.backgroundCostume gives the current background path (developer API).
// MLGame.ENGINE.backgroundScale gives the current background scale (developer API).


// <----- Sprite Blocks ----->

createSprite("Player1"); // Creates a sprite. Parameter: sprite_name

spriteCostume("Player1", "images/menu/torch_full.png", 1); // Sets the sprite's costume. The image scale sets the image width, where 1 = 160 game units.
//   Parameter: sprite_name, costume_path, scale

spriteSetSize("Player1", 1); // Sets scale without modifying costume.

spriteChangeSize("Player1", 0.1); // Changes sprite scale by value, can be both negative or positive to shrink or grow size.

spriteEffect("Player1", "brightness", 0); // Changes a sprite's effect, where 0 is none and 100 is 100% effect.
//  Effect List: 
//    brightness: changes sprite costume brightness, from -100 to 100, where max 100 on either side is bright white or darkness.
//    ghost: changes the sprite's opacity, from 0-100%.
//    color: changes the sprite's color, from 0-100. 0 is default, and 100 is also default. In between, the sprite goes through the color spectrum.
//           This basically changes the hue of the colors.

spriteChangeEffect("Player1", "brightness", 10); // Changes a sprite's effect by value, can be both negative or positive to shrink or grow effect.

spriteShow("Player1"); // Shows the sprite

spriteHide("Player1"); // Hides the sprite

spriteLayer("Player1", 1); // Moves the sprite to layer. Parameter: sprite_name, layer_num
goFront("Player1"); // Moves to front layer
goBack("Player1"); // Moves to back layer

costumeOfSprite("Player1"); // Returns the current costume path of sprite.
sizeOfSprite("Player1"); // Returns the current sprite size.

spriteCostume("Player1"); // One-argument reporter alias for costumeOfSprite().

spriteSetSize("Player1"); // One-argument reporter alias for sizeOfSprite().

deleteSprite("Player1"); // Completely removes sprite.

deleteAllSprites(); // Completely removes all current sprites and clones from canvas.

phaseIn(0.3); // Fades all current sprites in over time. Parameter: time (in seconds)
phaseOut(0.3); // Fades all current sprites out over time. Parameter: time (in seconds)
//                Good practice is to delete unused sprites between scenes.


// <----- Motion Blocks ----->

spriteX("Player1"); // Gives x of sprite
spriteY("Player1"); // Gives y of sprite
spriteDirection("Player1"); // Gives degree direction of sprite

coordinatePlane("Button", "right", "bottom"); // Logical stage axes: choose left/right and top/bottom.
moveTo("Button", 30, 40); // Sprite center stays 30 stage units from right, 40 from bottom; resizing/rotation keeps this center fixed.
//   Parameter: sprite_name, horizontal_side, distance_x, vertical_side, distance_y

moveTo("Player1", 0, 0); // Moves a sprite to coordinate. Parameter: sprite_name, x, y

moveBy("Player1", 3, 3); // Moves a sprite by the x and y value.

isMobile(); // Returns if view is mobile, then true, else false.

moveToSprite("Player1", "Enemy1"); // Moves first sprite to second sprite immediatly.

facing("Player1", "left"); // Changes and flips sprite facing direction. Left, right, up, and down.

direction("Player1", 30); // Changes sprite direction. Clockwise rotation, 0-360 degrees.

turn("Player1", 15); // Turns sprite by a certain degree amount.

glideTo("Player1", 100, 100, 5); // Makes sprite take some time to glide to coorinate. Parameter: sprite_name, x, y, time (in seconds)

glideToSprite("Player1", "Enemy", 5); // Makes first sprite glide to second sprite. Parameter: sprite_name, target_sprite_name, time


spriteCoordinateMode("Player1", "world"); // Default: centered world coordinates, y upward; moves/zooms with camera.

spriteCoordinateMode("Button", "canvas"); // Fixed logical stage units from canvas top-left, y downward; ignores camera and zoom.
// true means canvas, false means world; "screen" anchors to the visible viewport instead of the full box.
// Positions measure to the sprite CENTER; (0,0) centers it on the chosen corner.
// Changing modes keeps numeric x/y and size; moveTo() then sets its position in the chosen mode.

coordinateModeOfSprite("Button"); // Reports "world", "canvas", or "screen".


// <----- Camera Blocks ----->

cameraTo(0, 0); // Center the view here; stops following. Default is (0,0).

cameraTo(spriteX("Player1"), spriteY("Player1")); // Uses the live sprite coordinates.

cameraBy(30, -10); // Pan by world units; also stops following.

cameraToSprite("Player1"); // Capture a sprite position once; "self" works for clones.

cameraFollow("Player1", 0, 20); // Track the sprite continuously, with optional x/y offsets.

cameraStopFollowing(); // Keep current camera position without tracking.

cameraZoom(2); // 2 = twice as close; .5 = twice as much world. Sprite sizes do not change.

cameraX(); // World x at the view center.

cameraY(); // World y at the view center.

cameraZoom(); // No argument reports the current zoom multiplier.

cameraReset(); // Restore defaults from /JScratch/camera.json, including optional follow.
// UI defaults to world space like sprites. Use spriteCoordinateMode(id, "canvas") for fixed HUDs.
// Off-screen culling skips drawing only; scripts, collisions and animation timelines stay active.


// <----- Solid Collision Blocks ----->

makeList("World Solids", ["Wall", "Rock"]); // Names of obstacles; originals and their clone families match.

spriteCollisionTargets("Player1", getList("World Solids")); // Retain a LIVE list reporter.

spriteSolid("Player1", true); // Enable collision response for Player's own movement.

moveBy("Player1", 1000, 0); // Swept costume-alpha collision prevents jumping through thin walls.

solidBlocked("Player1"); // Was its last movement obstructed?

solidContacts("Player1"); // Array of names/clone IDs hit by that movement.

solidEnabled("Player1"); // Is this sprite's own response enabled?

solidTargets("Player1"); // Current resolved target-name array.

addToList("World Solids", "Door"); // Future moves now include Door, without reassigning targets.

deleteFromList("World Solids", 1); // Remove the first obstacle name from future interactions.

spriteCollisionTargets("Enemy1", ["Fence"]); // Literal arrays or an array-valued getVar/getSpriteVar also work.

spriteSolid("Enemy1", true); // Enemy checks Fence, not Player or every other enabled sprite.

spriteSolid("Player1", false); // Turn off Player's response without deleting its target selection.
// Directional rules: Player listing Wall blocks Player even if Wall does not list Player.
// Wall's own movement checks ONLY Wall's enabled flag + Wall's own target list.
// For mutual blocking, enable both sprites and put each in the other's target list.
// Disabling Wall's response does not remove Wall from Player's selected obstacles.
// A name matches its original + clones; use "Wall#42" to select only that clone.
// Invisible/untouchable/unloaded targets are excluded; fully ghosted targets still block.
// Solids slide along free surfaces. They do not push bodies, apply gravity, bounce, or depenetrate.
// To teleport through obstacles, disable response, moveTo(...), then enable it again.
// Rotation/size/costume changes do not push sprites apart; existing overlaps can escape but not move deeper.


// <----- Operator Blocks ----->

// Below are the basic operators.
add(1, 2); // Example, to get 3
sub(5, 4); // Example, to get 1
mult(2, 2); // Example, to get 4
div(10, 2); // Example, to get 5
mod(5, 2); // Example, to get 1, remainder
round(0.6); // Example, to get 1, round
abs(-3); // Example, to get 3, absolute value
sin(30); 
cos(30); 
randomNum(1, 10); // To get a random number between 1 and 10

// These are boolean conditions which can compare values. Can support variables as well.
gThan(3, 5); // If 3 > 5
lThan(3, 5); // If 3 < 5
gEqThan(3, 5); // If 3 >= 5, greater than or equal.
lEqThan(3, 5); // If 3 <= 5, less than or equal.
equal(3, 5); // If 3 === 5, equal than

and(true, true); // If both boolean conditions are true, return true.
or(true, true); // If either of the boolean conditons are true, return true.
not(true); // If boolean condition is the opposite, then return true.

join("images/", "sample_sprite.png"); // Joins two variables or fields into one. Parameter: field_1, field_2
createSprite(join("Enemy", "1")); // Example.

letter(2, "images"); // Gets the letter num in string or variable string. In example, 2 is the "m"

length("images"); // Gets the length of string. In example, 6

contain("im", "images"); // If string contains another string. In example, if "im" is in "images"


// <----- Variable Blocks ----->

makeVar("var1"); // Creates a variable. Parameter: variable_name = field_type
setVar("var1", 1);

changeVarBy("var1", 3); // Adds number_value to variable
changeVarBy("var1", -3); // Removes number_value

getVar("var1"); // Gets the value of variable. Parameter: variable_name.

makeSpriteVar("Player1", "health"); // Set private variables to sprites.
setSpriteVar("Player1", "health", 1);
changeSpriteVarBy("Player1", "health", 3); 
getSpriteVar("Player1", "health"); 

deleteVar("var1"); // Deletes a variable.


// <----- List Blocks ----->

makeList("Obstacles", ["Wall", "Rock"]); // Create if missing; starts with the supplied array.

setList("Obstacles", ["Wall", "Fence"]); // Replace the items with a copy of an array/reporter.

addToList("Obstacles", "Door"); // Append an item; creates a missing list.

insertInList("Obstacles", 2, "Crate"); // Insert BEFORE item 2; positions are 1-based.

replaceInList("Obstacles", "last", "Gate"); // Replace an item; last/random/any are supported.

deleteFromList("Obstacles", 1); // Remove one item; "all" removes every item.

getList("Obstacles"); // Live array, not a comma-separated string.

listItem("Obstacles", 1); // Item by 1-based position; invalid positions return "".

listLength("Obstacles"); // Number of items, 0 for missing lists.

listContains("Obstacles", "Wall"); // Strict-equality item membership.

clearList("Obstacles"); // Empty it while preserving the named list.

deleteList("Obstacles"); // Remove the entire list. getList() then reports an empty array.
// Collision getList reporters remain live across setList, clearList, deleteList and recreation.
// Lists reset when the game restarts; they do not automatically save to player data.


// <----- Sensing Blocks ----->

touchingMouse("Player1"); // Checks if sprite is touching the mouse and returns boolean. Parameter: sprite_name

touchingSprite("Player1", "Enemy1"); // Checks if sprite is touching another sprite, namely, if first is touching the second and vice versa.

touchingColor("Player1", "#000000"); // Checks whether the own costume contains this color (cached).

distanceMouse("Player1"); // Checks mouse pointer distance from sprite in game units and returns value.

distanceSprite("Player1", "Enemy1"); // Checks distance in game units between two sprites.

keyPressed("space"); // Checks event key pressed and returns true if so. 
//  Additional key types it can find are:
//    Letters: "a", "b", "c", etc...
//    Numbers: "1", "2", "3", etc...
//    Arrow Keys: "arrowleft", "arrowright", "arrowup", "arrowdown"
//    Mouse: "leftclick", "rightclick"
//    Other: "shift"

mouseX(); // Gets current mouse coordinate location in game units.
mouseY();

spriteHasColor("Player1", "#ff0000"); // Checks the source costume for a color, same as touchingColor().

touchingStageColor("Player1", "#ff0000"); // Checks contact with a stage/sprite color, excluding HUD elements.

deltaTime(); // Seconds in the latest simulation frame; use with movement for consistent speed.
// Example inside a normal frame-yielding loop: moveBy("Player1", mult(160, deltaTime()), 0).
// Fully transparent costume pixels do not collide. Ghost 100 still collides; hidden sprites do not.

currentYear(); // Gets value of current year.
currentMonth(); // Gets value of current month, in value (e.g. Jan = 1).
currentDay(); // Gets current day in month, in value.
currentHour(); // Gets current hour in the day in military time.
currentMin(); // Gets current minute in hour.


// <----- Control Blocks ----->

wait(1); // Wait for a certain amount of time. Parameter: number is in seconds and can support decimals.

// Repeats a certain amount of times. Parameter: repeat_number.
//   Can place additioanl code inside or more repeat. Nested repeat does not need ENGINE.scripts.push()
repeat(100,
    //field,
)

// Conditional if block that checks of if a conditonal is true and then executes.
//  Also can use "else" which is optional to run if conditonal is false.
ifBlock( equal(getVar("var1"), 1),
    //field,
    "else",
    //field,
);

// Runs inside code until conditional is true.
repeatUntil( equal(getVar("var1"), 2),
    //field,
);

// Runs the inside code until conditional is not true. Can also hold simply "True" to keep it running.
whileBlock( equal(getVar("var1"), 1),
    //field,
);

// Runs the inside code forever until stopped.
forever(
    //field,
);

endScript(); // Ends the entire current script, including all enclosing loops.


waitUntil(equal(getVar("Ready"), true)); // Waits until a live reporter condition becomes true.

withoutScreenRefresh(
    repeat(1000, changeVarBy("Total", 1)),
); // Runs computation loops without the iteration-frame delay; still shares the execution budget.

repeat(10,
    ifBlock(equal(getVar("Skip"), true), continueLoop()), // Skips the rest of the current iteration.
    ifBlock(equal(getVar("Done"), true), breakLoop()), // Exits only the innermost loop.
    changeVarBy("Processed", 1),
);
// EndScript() ends the entire current script, including every enclosing loop.


// <----- Event Blocks ----->

broadcast("Start Menu"); // Starts every listener with this name independently and continues.

broadcastAndWait("Start Menu"); // Same broadcast but will wait for broadcast code to finish.

// Register a listener; more than one listener can use the same name.
whenBroadcast("Start Menu",
    //field;
);


stopScripts("Start Menu"); // Cancels active scripts registered under this broadcast name, including nested waits.
// Two whenBroadcast() listeners with the same name run concurrently on each broadcast.
// Cancelling your own broadcast group also ends the script doing the cancellation.


// <----- Clone Blocks ----->

makeClone("Player1"); // Creates 1 one of the sprite and inherits all of the sprite's current attributes.

// Creates a broadcast instance where clones will run code on creation.
whenClone("Player1", 
    //field;
)

deleteClone(); // When used inside whenClone(), it deletes that clone.

getCloneName(); // When used inside whenClone(), it gets the clone's own name.

getCloneId(); // When used inside whenClone(), it gets the clone's own id.


deleteClonesOf("Player1"); // Deletes every clone of this source, preserving the original sprite.

deleteClonesOf("all"); // Deletes all clones, preserving all original sprites.

cloneName(); // Alias for getCloneName(), evaluated in the current clone context.

cloneId(); // Alias for getCloneId().

isClone(); // Returns true only in a clone context.


// <----- Sound Blocks -----> // Must intereact with screen to begin any sound on a project start.

makeSound("Sound", "sound/play.mp3"); // Creates and store sound by name and its path.

playSound("Sound"); // Begins to play sound from its name.

stopAllSound(); // Turns off all active sounds.

stopSound("Sound"); // Turns off a particular sound.

setPitch("Sound", 5); // Sets the pitch of a sound, from -100 to 100.

changePitch("Sound", 1); // Changes the pitch by an amount, either positive or negative.

setPan("Sound", 0); // Sets the pan left/right of sound, from -100 to 100.

changePan("Sound", 10); // Changes pan by an amount; clamped to -100..100.

setVolume("Sound", 100); // Sets the sound's volume, where 100 is the sound's regular volume and 0 is no sound.

changeVolume("Sound", 1); // Changes sound's volume by an amount, either positive or negative.

volumeOfSound("Sound"); // Returns the volume of a particular sound.




// <----- UI Blocks ----->
// UI creates procedural sprites with no costume required. World space is the default.
// Use ordinary sprite blocks with these IDs; canvas mode keeps an element browser-fixed.

uiText("Title", "World", 0, 120, 24, "#fff"); // Id, text, x, y, font size, color.

uiPanel("Panel", 0, 0, 220, 100, "rgba(0,0,0,.6)", 10); // Id, x, y, width, height, fill, radius.

uiBox("Box", 0, 0, 40, 40, "#a33", 4); // Rectangular panel with the same parameter order.

uiLine("Line", -30, 0, 30, 0, 2, "#fff"); // Id, center x/y, local line vector x/y, stroke width, color.

uiCircle("Circle", 0, 0, 20, "#fff"); // Id, center x/y, radius, color.

uiProgressBar("HP", 0, -100, 200, 20, 75, 100, "#333", "#2b5"); // Id, x/y, width/height, value/max, background/foreground.

uiBar("Mana", 0, -125, 200, 20, 40, 100, "#333", "#58f"); // Equivalent progress-bar constructor.

uiButton("Start", 0, -50, 140, 45, "Start", "#444", "#fff"); // Id, x/y, width/height, label, fill, text color.
// Use touchingMouse("Start") and keyPressed("leftclick") for input, just like a sprite.
uiImage("Portrait", "/images/character_art/pixel_art/c1_costume/costume1_idle1.gif", 0, 0, 48, 96); // Id, path, x/y, width/height.

uiSetText("Title", join("Score: ", getVar("Score"))); // Set text using current reporter values.

uiSetPosition("Title", 0, 100); // Position in this object's coordinate mode.

uiMove("Title", 5, 0); // Add x/y offsets.

uiSetSize("Panel", 240, 110); // Width, height.

uiSetColor("Box", "#35a"); // Fill/color (advanced foreground/background fields use uiRun()).

uiSetOpacity("Panel", .8); // Visual opacity 0..1.

uiSetVisible("Panel", true); // Boolean visibility.

uiShow("Title"); // Visible=true.

uiHide("Title"); // Visible=false.

uiSetLayer("Title", 5); // Shared sprite layer; UI and ordinary sprites use the same ordering.

uiSetRotation("Title", 10); // Degrees.

uiSetScale("Title", 1.2); // Generated sprite scale; world-mode UI also follows camera zoom.

uiBringToFront("Title"); // Above other sprites and UI elements.

uiSendToBack("Panel"); // Below other sprites and UI elements in the shared layer order.

uiExists("Title"); // Does this UI id exist?

uiGet("Title", "text"); // Get one current UI property.

uiRun("uiSetColor", {id:"HP", foreground:"#f44", background:"#222"}); // Advanced constructor: registered UI type + fields.

// UI objects are real Sprite subclasses and need no image costume.
// Visual reporter inputs stay live: score/health changes update the generated pixels automatically.
uiText("Scoreboard", join("Score: ", getVar("Score")), 0, 120, 24, "#fff");

uiProgressBar("Health", 0, 100, 200, 20, getVar("Health"), getVar("Max Health"), "#333", "#2b5");

uiSetValue("Health", getVar("Health")); // Sets or rebinds a bar's live numeric value.

uiSetMax("Health", getVar("Max Health")); // Sets or rebinds its live maximum.

uiSet("Scoreboard", "weight", "bold"); // Generic UI style/property setter.

uiBind("Scoreboard", "x", spriteX("Player1")); // Binds a shared sprite property to a live reporter.

uiUnbind("Scoreboard", "x"); // Keeps the current value and removes the live binding.
// Use uiUnbind(id,"text"/"value") to freeze a constructor's live visual value too.

moveBy("Health", 10, 0); // Standard sprite movement also targets UI names.

spriteEffect("Scoreboard", "ghost", 50); // UI gets ordinary sprite effects, rotation, flips and scale.

setSpriteVar("Health", "Owner", "Player1"); // UI objects have their own sprite variables.

spriteCoordinateMode("Scoreboard", "canvas"); // Opt into a browser-fixed scoreboard.

moveTo("Scoreboard", 100, 30); // Sprite center at 100 logical stage units from left, 30 from top, independent of camera.

uiDelete("Title"); // Remove one UI element.

uiClear(); // Remove all UI elements.
// UI is generated sprite scenery; the same sprite motion, effects, variables, clones and opt-in solids work.


// Others

// <----- JSON Blocks ----->

getJson("data1", ""); // Loads a JSON file and stores it in memory. Parameter: json_name, json_path

removeJson("data1"); // Removes a JSON file from memory. Parameter: json_name

jsonLoaded("data1"); // Returns true if JSON file is loaded in memory, else false. Parameter: json_name

jsonValue("data1", "c1.name"); // Returns the value of a key in a JSON file. Parameter: json_name, key_name

jsonExists("data1", "c1.name"); // Returns true if a key exists in a JSON file, else false. Parameter: json_name, key_name

jsonKeys("data1", "c1.base_stats"); // Returns comma-separated keys in a JSON file. Parameter: json_name

jsonLength("data1", "c1.base_stats"); // Returns the length of a JSON file or key. Parameter: json_name, key_name

jsonType("data1", "c1.name"); // Returns the type of a JSON file or key. Parameter: json_name, key_name


// <----- Data Blocks ----->

loadPlayerData();

getUsername(); // Returns signed in username.

getLoggedIn(); // Returns whether a user is signed in.

getData("silver_coin"); // Gets value in dictionary.

updateData("silver_coin", 100); // Updates value in dictionary.

changeDataBy("silver_coin", 5); // Adds a number to a saved value; concurrent writes are ordered.

refreshPlayerData(); // Loads signed-in player data again.
// UpdateData() and changeDataBy() write authenticated website save data; use only when intended.


// <----- Media Blocks ----->

setPixelCrisp(true); // Legacy block accepted for compatibility; crisp pixels are always enabled.

setGifAutoPlay(true); // Legacy block; GIF autoplay is always enabled (game pause still freezes playback).
// Passing false does not turn these features off. There is no settings button.


// <----- Custom Blocks ----->

registerBlock("sampleAwardPoints", (block, context)=>{ // Registration: executes when this block is reached.
    const amount=Number(resolveValue(block.amount, context))||0;
    ENGINE.variables.Score=(Number(ENGINE.variables.Score)||0)+amount;
});
ENGINE.recordBlock(createBlock("sampleAwardPoints", {amount:5})); // Construct + record the custom command.

registerReporter("sampleScoreValue", ()=>ENGINE.variables.Score??0); // Register a live value reporter.

createReporter("sampleScoreValue"); // Construct that reporter.

operator("sampleDouble", context=>Number(resolveValue(getVar("Score"), context))*2);
// Operator(type, evaluate) makes a reporter backed by a JS function; keep evaluation short.


/* Developer API (immediate calls; use from tools/console, not as nested commands):
 * MLGame.start() / restart() — reset the runtime and execute the constructed program.
 * MLGame.stop(), pause(), resume(), step() — lifecycle/debugger controls.
 * MLGame.broadcast(name), broadcastAndWait(name), cancelScripts(name) — immediate event APIs.
 * MLGame.inspect() — variables, scripts, errors, camera, draw/culling counts.
 * MLGame.configure({budgetLimit:500,budgetMs:6,maxClones:Infinity,requestTimeout:30000}).
 * MLGame.preloadAssets([url, ...]) — Promise for shared image/GIF decoding readiness.
 * MLGame.getSprites() / global getSprites() — visible original names and clone ID names.
 * MLGame.getAllSprites() / getAllSprites() — actual sprite objects, including hidden sprites.
 * MLGame.resolveValue(reporter, context) — explicitly evaluate a reporter outside a block.
 * MLGame.createScriptContext(), executeBlock(), executeBlocks() — custom execution helpers.
 * MLGame.validateBlocks(array), registerBlock(), registerReporter(), createBlock(), createReporter().
 * MLGame.runtimeWait(ms, context), contextActive(context), reportError(error, block, context).
 * MLGame.resolveSpriteName(name, context), getContextSprite(name, context) — clone-aware lookups.
 * MLGame.UI.create/get/delete/clear/render — immediate HUD helpers (different from deferred ui* blocks).
 * Advanced UI fields: uiRun("uiText",{id:"label",text:"Hello",font:"Arial",weight:"bold",...}).
 * Custom JavaScript must yield; cooperative scheduling cannot interrupt a blocking native loop.
 */

// <----- Startup Event ----->

whenStart(
    setVar("Score", 0), // Runs on start/restart; separate startup hats run concurrently.
);

// Custom blocks / methods. Define at top level; parameter values are private
// to each call (including recursive and simultaneous calls). Calls wait for
// their body. functionResult() reads this script's most recent call result.
defineFunction("Add amounts", ["first", "second"],
    setFunctionValue("total", add(functionValue("first"), functionValue("second"))),
    returnFunction(functionValue("total")),
);
callFunction("Add amounts", 2, 3); // Pass arguments in parameter order.
setVar("Answer", functionResult()); // 5; copy before another call replaces it.
beginGameAtBroadcast("World"); // Development restart: reset, startup, then World.

// Logical canvas dimensions. Put canvasSize first inside your whenStart script.
canvasSize(540, 360); // Fixed stage units; height fills the screen; narrow screens crop the centered sides.
canvasWidth(); // Declared logical width, independent of browser size and camera.
canvasHeight(); // Declared logical height. Canvas-mode sizes and edge gaps scale with this stage.

// Canvas anchors follow the full declared box; screen anchors follow visible edges.
coordinatePlane("HUD", "right", "bottom"); // Select sides; starts in canvas mode.
spriteCoordinateMode("HUD", "screen"); // Follow cropped screen edges, but never anchor beyond the declared box on widescreens.
moveTo("HUD", 10, 12); // Gaps in stage units, scaled by screen height, independent of camera.
screenWidth(); // Visible horizontal span in logical stage units, independent of camera zoom.
screenHeight(); // Visible vertical span, equal to the declared canvas height.
