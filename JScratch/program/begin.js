// Start of Code Blocks.
// Main Menu
// These three listeners share a name and run concurrently.
whenBroadcast(
    "Main Menu",
    setVar("Menu Ready", false),
    canvasColor("hsl(0, 0%, 0%)"),
    canvasCostume("", 1),
    createSprite("BG"),
    spriteCostume("BG", "images/menu/BG1-1.svg", 4),
    createSprite("Heroes"),
    spriteCostume("Heroes", "images/menu/BG1-3.svg", 2.2),
    goFront("Heroes"),
    createSprite("Logo"),
    spriteCostume("Logo", "/images/mlg-assets/mlg-logo.png", 2.2),
    goFront("Logo"),
    createSprite("Overlay"),
    spriteCostume("Overlay", "images/menu/BG1-2.svg", 4),
    goFront("Overlay"),
    createSprite("Start Button"),
    spriteCostume("Start Button", "images/menu/BG1-5.png", 2.5),
    goFront("Start Button"),
    moveTo("Heroes", 75, 0),
    coordinatePlane("Start Button", "left", "bottom"),
    moveTo("Start Button", 250, 160),
    coordinatePlane("Logo", "left", "top"),
    moveTo("Logo", 250, 180),
    ifBlock(
        isMobile(),
        spriteCoordinateMode("Logo", "world"),
        spriteCoordinateMode("Start Button", "world"),
        moveTo("Logo", 0, 80),
        moveTo("Start Button", 0, -110),
        moveTo("Heroes", 0, -15),
        spriteSetSize("Heroes", 0.9),
    ),
    phaseIn(0.3),
    setVar("Menu Ready", true),
    makeSound("mlt", "/images/mlg-assets/Music/ML-Theme.mp3"),
    setPitch("mlt", 5),
    playSound("mlt"),
    repeatUntil(
        not(equal(getVar("Scene"), "Main Menu")),
        ifBlock(
            isMobile(),
            glideTo("Heroes", 5, -20, 0.4),
            glideTo("Heroes", 0, -15, 0.4),
            "else",
            glideTo("Heroes", 80, 5, 0.4),
            glideTo("Heroes", 70, -5, 0.4),
        ),
    ),
);

whenBroadcast(
    "Main Menu",
    waitUntil(getVar("Menu Ready")),
    wait(0.7),
    repeatUntil(
        not(equal(getVar("Scene"), "Main Menu")),
        ifBlock(
            equal(touchingMouse("Start Button"), true),
            spriteEffect("Start Button", "brightness", 60),
            spriteSetSize("Start Button", 2.6),
            ifBlock(
                equal(keyPressed("leftclick"), true),
                setVar("Scene", "World"),
                broadcast("Leave Main Menu"),
            ),
            "else",
            spriteEffect("Start Button", "brightness", 0),
            spriteSetSize("Start Button", 2.5),
        ),
    ),
);

whenBroadcast(
    "Main Menu",
    createSprite("Line"),
    spriteCostume("Line", "images/menu/BG1-4.svg", 1),
    moveTo("Line", -400, -400),
    makeSpriteVar("Line", "Size"),
    setSpriteVar("Line", "Size", 0),
    waitUntil(getVar("Menu Ready")),
    repeatUntil(
        not(equal(getVar("Scene"), "Main Menu")),
        withoutScreenRefresh(
            repeat(
                25,
                changeSpriteVarBy("Line", "Size", 0.02),
                wait(0.08),
                makeClone("Line"),
            ),
        ),
        withoutScreenRefresh(
            repeat(
                25,
                changeSpriteVarBy("Line", "Size", -0.02),
                wait(0.08),
                makeClone("Line"),
            ),
        ),
    ),
);

// Transition from a separate listener so cancelling Main Menu does not cancel
// the fade and cleanup themselves. Stop particles before taking the fade snapshot.
whenBroadcast(
    "Leave Main Menu",
    stopScripts("Main Menu"),
    stopScripts("Line"),
    setVar("Menu Ready", false),
    phaseOut(0.3),
    stopSound("mlt"),
    deleteAllSprites(),
    broadcast("World"),
);

whenClone(
    "Line",
    moveTo("self", -300, mult(round(randomNum(-35, 3)), 10)),
    setSpriteVar("self", "Size", add(getSpriteVar("self", "Size"), randomNum(0, 0.2))),
    spriteSetSize("self", getSpriteVar("self", "Size")),
    ifBlock(
        gEqThan(spriteY("self"), -200),
        spriteEffect("self", "brightness", mult(div(abs(spriteY("self")), 100), 15)),
        "else",
        spriteEffect("self", "brightness", mult(div(abs(spriteY("self")), -100), 15)),
    ),
    direction("self", 335),
    repeatUntil(
        or(gThan(spriteX("self"), 280), not(equal(getVar("Scene"), "Main Menu"))),
        moveBy("self", mult(mult(div(17, 0.02), deltaTime()), cos(20)), mult(mult(div(17, 0.02), deltaTime()), sin(20))),
    ),
    deleteClone(),
);

whenStart(
    loadPlayerData(),
    makeVar("Menu Ready"),
    setVar("Menu Ready", false),
    makeVar("Scene"),
    setVar("Scene", "Main Menu"),
    createSprite("Torch"),
    spriteCostume("Torch", "images/menu/torch_full.png", 0.5),
    spriteEffect("Torch", "ghost", 100),
    phaseIn(0.3),
    wait(1),
    phaseOut(0.3),
    deleteSprite("Torch"),
    broadcast("Main Menu"),
);
