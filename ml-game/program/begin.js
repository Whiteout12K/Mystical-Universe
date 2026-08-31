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
    forever(
        createSprite("Line"),
        spriteCostume("Line", "images/menu/BG1-4.svg", 1),
        moveTo("Line", -400, -400),
        makeClone("Line"),
        wait(0.12),
    ),
);

whenClone("Line",
    moveTo("Line", -300, mult(round(randomNum(-35, 3)), 10)),
    goBack("Line"),
    spriteSetSize("Line", randomNum(0.3, 0.5)),
    ifBlock( gEqThan(spriteY("Line"), -200),
        spriteEffect("Line", "brightness", mult(div(abs(spriteY("Line")), 100), 15)),
        "else",
        ifBlock( lEqThan(spriteY("Line"), -200 ),
            spriteEffect("Line", "brightness", mult(div(abs(spriteY("Line")), -100), 15)),
        ),
    ),
    direction("Line", 335),
    repeat(80,
        moveBy("Line", mult(17, cos(20)), mult(17, sin(20))),
        ifBlock( gThan(spriteX("Line"), 280),
            deleteClone("Line"),
        ),
        wait(0.02),
    ),
    deleteClone("Line"),
)




loadPlayerData();

broadcast("Main Menu");
