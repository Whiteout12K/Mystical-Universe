
// <----- Canvas Blocks ----->

canvasColor("#686565"); // Sets the canvas color if no image. Parameter: color_hex

canvasCostume("images/sample_canvas.png", 2); // Sets the canvas costume. Parameter: costume_path


// <----- Sprite Blocks ----->

createSprite("Player1"); // Creates a sprite. Parameter: sprite_name

spriteCostume("Player1", "images/sample_sprite.png", 1); // Sets the sprite's costume. The image scale sets the image width, where 1 = 160 canvas pixels.
//   Parameter: sprite_name, costume_path, scale


// <----- Motion Blocks ----->

moveToEdge("Player1", "left", 30, "top", 30); // Moves to a flex coordinate, always some distance from edge.
//   Parameter: sprite_name, horizontal_side, distance_x, vertical_side, distance_y

moveTo("Player1", 0, 0); // Moves a sprite to coordinate. Parameter: sprite_name, x, y


// <----- Variable Blocks ----->

let path1 = "images/"; // Creates a variable. Parameter: variable_name = field_type
let var1 = 1;

var1 += 1; // Adds number_value to variable
var1 -= 1; // Removes number_value


// <----- Control Blocks ----->

wait(1) // Wait for a certain amount of time. Parameter: number is in seconds and can support decimals.

// Repeats a certain amount of times. Parameter: repeat_number.
//   Can place additioanl code inside or more repeat. Nested repeat does not need ENGINE.scripts.push()
ENGINE.scripts.push(
    repeat(100,
        //field;
    )
);

// Full conditional format. 
if (var1 === 1) {
    //field;
} else if (var1 <= 2) {
    //field;
} else {
    //field;
}; 

// Things to note:
//  greater than: >
//  less than: <
//  equal than: ===
//  not: !
//  not equal: !==
//  greater/equal than: >=
//  less/equal than: <=

// While statement. Can support True for infinite or use specific operators to run conditionally.
while (True) {
    //field;
}; 


// <----- Operator Blocks ----->

join(path1, "sample_sprite.png"); // Joins two variables or fields into one. Parameter: field_1, field_2


// <----- Function Blocks ----->

testFunc(2); // Declare a function

// Function body, takes the value parameter in function and assigns to variables in order.
function testFunc(var1){
    //field;
}; 




