// Start of Code Blocks.


// Main Menu

whenBroadcast("Main Menu",
    canvasColor("#000000"), canvasCostume("images/menu/BG1-1.svg", 1),
    spriteCostume("Line", "images/menu/BG1-4.svg", 4),
    createSprite("Heroes"), spriteCostume("Heroes", "images/menu/BG1-3.svg", 2.2),
    createSprite("Logo"), spriteCostume("Logo", "/images/mlg-assets/mlg-logo.png", 0.8),
    createSprite("Overlay"), spriteCostume("Overlay", "images/menu/BG1-2.svg", 4),

    moveTo("Heroes", 75, 0),
    moveToEdge("Logo", "left", 40, "top", 30),

    ifBlock( equal(isMobile(), true),
        moveToEdge("Logo", "", 0, "top", 30),
        deleteSprite("Heroes"),
    ),

    makeSound("mlt", "/images/mlg-assets/Music/ML-Theme.mp3"),
    playSound("mlt"),
    forever(
        glideTo("Heroes", 80, 5, 0.4),
        glideTo("Heroes", 70, -5, 0.4),
    ),
);

whenBroadcast("Main Menu",
    wait(0.5),
    createSprite("Line"),
    spriteCostume("Line", "images/menu/BG1-4.svg", 1),
    moveTo("Line", 0, 0),
);



whenBroadcast("MM-Line",
    createSprite("Line"),
    goBack("Line"),
    spriteCostume("Line", "images/menu/BG1-4.svg", 4),
    moveTo("Line", 0, 0),
    moveTo("Line", -300, mult(round(randomNum(-36, 3)), 10)),
    spriteSetSize("Line", randomNum(0.3, 0.5)),
    ifBlock( gEqThan(spriteY("Line"), -200),
        spriteEffect("Line", "color", div(add(spriteY("Line"), 170), 12)),
        spriteEffect("Line", "brightness", div(add(spriteY("Line"), 170), 12)),
        "else",
        ifBlock( lEqThan(spriteY("Line"), -200 ),
            spriteEffect("Line", "color", div(add(spriteY("Line"), 170), 17)),
        ),
    ),
    direction("Line", 335),
    repeat(150,
        moveBy("Line", mult(12, cos(20)), mult(12, sin(20))),
        ifBlock( gThan(spriteX("Line"), 280),
            deleteSprite("Line"),
        ),
        wait(0.04),
    ),
    deleteSprite("Line"),
);




loadPlayerData();

broadcast("Main Menu");
