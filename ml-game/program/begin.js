// <----- Canvas Blocks ----->

canvasColor("#686565");
canvasCostume("images/sample_canvas.png", 2); // Sets the canvas costume. Parameter: costume_path

// <----- Sprite Blocks ----->

createSprite("Knight");

spriteCostume("Knight","images/sample_sprite.png",1);


// <----- Motion Blocks ----->

moveTo("Knight",0,0);


// <----- Variable Blocks ----->

let danceStep=0;


// <----- Control Blocks ----->

ENGINE.scripts.push(

    repeat(100,

        // Move right
        moveBy("Knight",3,0),
        wait(0.08),

        moveBy("Knight",3,0),
        wait(0.08),

        moveBy("Knight",3,0),
        wait(0.08),

        // Dance upward
        moveBy("Knight",0,-8),
        wait(0.08),

        moveBy("Knight",0,8),
        wait(0.08),

        moveBy("Knight",0,-8),
        wait(0.08),

        moveBy("Knight",0,8),
        wait(0.08),

        // Move left
        moveBy("Knight",-3,0),
        wait(0.08),

        moveBy("Knight",-3,0),
        wait(0.08),

        moveBy("Knight",-3,0),
        wait(0.08),

        // Dance again
        moveBy("Knight",0,-8),
        wait(0.08),

        moveBy("Knight",0,8),
        wait(0.08),

        moveBy("Knight",0,-8),
        wait(0.08),

        moveBy("Knight",0,8),
        wait(0.08)

    )

);