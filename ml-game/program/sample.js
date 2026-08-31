
// <----- Canvas Blocks ----->

canvasColor("#686565"); // Sets the canvas color if no image. Parameter: color_hex

canvasCostume("images/sample_canvas.png", 2); // Sets the canvas costume. Parameter: costume_path. Can be blank for no image.

canvasSize(2); // Sets scale without modifying costume of canvas.

canvasChangeSize(0.1); // Cahgnes the canvas' scale by value, can both be negative or positive to shrink or grow size.

canvasEffect("brightness", 0); // Changes the canvas' effect, where 0 is none and 100 is 100% effect.
//  Effect List: 
//    brightness: changes sprite costume brightness, from 0-100%, where max is bright white.
//    ghost: changes the sprite's opacity, from 0-100%.
//    color: changes the sprite's color, from 0-100. 0 is default, and 100 is also default. In between, the sprite goes through the color spectrum.
//           This basically changes the hue of the colors.

costumeOfCanvas(); // Returns the current costume path of canvas.
sizeOfCanvas(); // Returns the current canvas size.


// <----- Sprite Blocks ----->

createSprite("Player1"); // Creates a sprite. Parameter: sprite_name

spriteCostume("Player1", "images/sample_sprite.png", 1); // Sets the sprite's costume. The image scale sets the image width, where 1 = 160 canvas pixels.
//   Parameter: sprite_name, costume_path, scale

spriteSetSize("Player1", 1); // Sets scale without modifying costume.

spriteChangeSize("Player1", 0.1); // Changes sprite scale by value, can be both negative or positive to shrink or grow size.

spriteEffect("Player1", "brightness", 0); // Changes a sprite's effect, where 0 is none and 100 is 100% effect.
//  Effect List: 
//    brightness: changes sprite costume brightness, from 0-100%, where max is bright white.
//    ghost: changes the sprite's opacity, from 0-100%.
//    color: changes the sprite's color, from 0-100. 0 is default, and 100 is also default. In between, the sprite goes through the color spectrum.
//           This basically changes the hue of the colors.

spriteShow("Player1"); // Shows the sprite

spriteHide("Player1"); // Hides the sprite

spriteLayer("Player1", 1); // Moves the sprite to layer. Parameter: sprite_name, layer_num
goFront("Player1"); // Moves to front layer
goBack("Player1"); // Moves to back layer

costumeOfSprite("Player1"); // Returns the current costume path of sprite.
sizeOfSprite("Player1"); // Returns the current sprite size.

deleteSprite("Player1"); // Completely removes sprite.


// <----- Motion Blocks ----->

spriteX("Player1"); // Gives x of sprite
spriteY("Player1"); // Gives y of sprite
spriteDirection("Player1"); // Gives degree direction of sprite

moveToEdge("Player1", "left", 30, "top", 30); // Moves to a flex coordinate, always some distance from edge.
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


// <----- Operator Blocks ----->

// Below are the basic operators.
add(1, 2); // example, to get 3
sub(5, 4); // example, to get 1
mult(2, 2); // example, to get 4
div(10, 2); // example, to get 5
mod(5, 2); // example, to get 1, remainder
round(0.6); // example, to get 1, round
abs(-3); // example, to get 3, absolute value
sin(30); 
cos(30); 
randomNum(1, 10); // to get a random number between 1 and 10

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
createSprite(join("Enemy", "1")); // example.

letter(2, "images"); // Gets the letter num in string or variable string. In example, 2 is the "m"

length("images"); // Gets the length of string. In example, 6

contain("im", "images"); // If string contains another string. In example, if "im" is in "images"


// <----- Variable Blocks ----->

makeVar("var1"); // Creates a variable. Parameter: variable_name = field_type
setVar("var1", 1);

changeVarBy("var1", 3); // Adds number_value to variable
changeVarBy("var1", -3); // Removes number_value

getVar("Var1"); // Gets the value of variable. Parameter: variable_name.

makeSpriteVar("Player1", "health"); // Set private variables to sprites.
setSpriteVar("Player1", "health", 1);
changeSpriteVarBy("Player1", "health", 3); 
getSpriteVar("Player1", "health"); 

deleteVar("var1")/ // Deletes a variable.


// <----- Sensing Blocks ----->

touchingMouse("Player1"); // Checks if sprite is touching the mouse and returns boolean. Parameter: sprite_name

touchingSprite("Player1", "Enemy1"); // Checks if sprite is touching another sprite, namely, if first is touching the second and vice versa.

touchingColor("Player1", "#000000"); // Checks if sprite is touching a particular color.

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

currentYear(); // Gets value of current year.
currentMonth(); // Gets value of current month, in value (e.g. Jan = 1).
currentDay(); // Gets current day in month, in value.
currentHour(); // Gets current hour in the day in military time.
currentMin(); // Gets current minute in hour.


// <----- Control Blocks ----->

wait(1); // Wait for a certain amount of time. Parameter: number is in seconds and can support decimals.

// Repeats a certain amount of times. Parameter: repeat_number.
//   Can place additioanl code inside or more repeat. Nested repeat does not need ENGINE.scripts.push()
ENGINE.scripts.push(
    repeat(100,
        //field,
    )
);

// Conditional if block that checks of if a conditonal is true and then executes.
//  Also can use "else" which is optional to run if conditonal is false.
ifBlock( equalThan(getVar("Var1"), 1),
    //field,
    "else",
    //field,
);

// Runs inside code until conditional is true.
repeatUntil( equalThan(getVar("Var1"), 2),
    //field,
);

// Runs the inside code until conditional is not true. Can also hold simply "True" to keep it running.
whileBlock( equalThan(getVar("Var1"), 1),
    //field,
);

// Runs the inside code forever until stopped.
forever(
    //field,
);

endScript(); // Ends whatever looping or repeating code this block is inside.


// <----- Event Blocks ----->

broadcast("Start Menu"); // Starts a broadcast to a seperate code sequence and continues code. Takes a unique broadcast name.

broadcastAndWait("Start Menu"); // Same broadcast but will wait for broadcast code to finish.

// Broadcast reciever of the same unique broadcast name.
whenBroadcast("Start Menu",
    //field;
);


// <----- Clone Blocks ----->

makeClone("Player1"); // Creates 1 one of the sprite and inherits all of the sprite's current attributes.

// Creates a broadcast instance where clones will run code on creation.
whenClone("Player1", 
    //field;
)

deleteClone("Player1"); // When used inside whenClone(), it deletes that clone.

getCloneName(); // When used inside whenClone(), it gets the clone's own name.

getCloneId(); // When used inside whenClone(), it gets the clone's own id.


// <----- Sound Blocks -----> // Must intereact with screen to begin any sound on a project start.

makeSound("Sound", "sound/play.mp3"); // Creates and store sound by name and its path.

playSound("Sound"); // Begins to play sound from its name.

stopAllSound(); // Turns off all active sounds.

stopSound("Sound"); // Turns off a particular sound.

setPitch("Sound", 5); // Sets the pitch of a sound, from -100 to 100.

changePitch("Sound", 1); // Changes the pitch by an amount, either positive or negative.

setPan("Sound", 0); // Sets the pan left/right of sound, from -100 to 100.

setVolume("Sound", 100); // Sets the sound's volume, where 100 is the sound's regular volume and 0 is no sound.

changeVolume("Sound", 1); // Changes sound's volume by an amount, either positive or negative.

volumeOfSound("Sound"); // Returns the volume of a particular sound.





// Others

// <----- Data Blocks ----->



getUsername(); // Returns signed in username.

getLoggedIn(); // Returns whether a user is signed in.

getData("silver_coin"); // Gets value in dictionary.

updateData("silver_coin", 100); // Updates value in dictionary.

