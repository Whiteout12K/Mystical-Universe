// Start of Code Blocks.


// Main Menu

whenBroadcast("Main Menu",
    canvasColor("hsl(0, 0%, 0%)"), canvasCostume("", 1),
    createSprite("BG"), spriteCostume("BG", "images/menu/BG1-1.svg", 4),
    createSprite("Heroes"), spriteCostume("Heroes", "images/menu/BG1-3.svg", 2.2), goFront("Heroes"),
    createSprite("Logo"), spriteCostume("Logo", "/images/mlg-assets/mlg-logo.png", 0.8), goFront("Logo"),
    createSprite("Overlay"), spriteCostume("Overlay", "images/menu/BG1-2.svg", 4), goFront("Overlay"),
    createSprite("Start Button"), spriteCostume("Start Button", "images/menu/BG1-5.png", 0.8), goFront("Start Button"),

    moveTo("Heroes", 75, 0),
    moveToEdge("Start Button", "left", 120, "bottom", 80),
    moveToEdge("Logo", "left", 120, "top", 90),

    ifBlock(isMobile(),
        moveTo("Logo", 0, 80),
        moveTo("Start Button", 0, -110),
        moveTo("Heroes", 0, -15),
        spriteSetSize("Heroes", 0.9),
    ),

    phaseIn(0.3),

    makeSound("mlt", "/images/mlg-assets/Music/ML-Theme.mp3"),
    setPitch("mlt", 5),
    playSound("mlt"),
    
    repeatUntil( not( equal(getVar("Scene"), "Main Menu") ),
        ifBlock( isMobile(),
            glideTo("Heroes", 5, -20, 0.4),
            glideTo("Heroes", 0, -15, 0.4),
            "else",
            glideTo("Heroes", 80, 5, 0.4),
            glideTo("Heroes", 70, -5, 0.4),
        ),
    ),
);

whenBroadcast("Main Menu",
    wait(1),
    repeatUntil( not( equal(getVar("Scene"), "Main Menu") ),
        ifBlock( equal(touchingMouse("Start Button"), true),
            spriteEffect("Start Button", "brightness", 60),
            spriteSetSize("Start Button", 0.9),
            ifBlock( equal(keyPressed("leftclick"), true), 
                setVar("Scene", "Gacha"),
                phaseOut(0.3),
                stopSound("mlt"),
                deleteAllSprites(),
            ),
            "else",
            spriteEffect("Start Button", "brightness", 0),
            spriteSetSize("Start Button", 0.8),
        ),
    ),
);

whenBroadcast("Main Menu",
    createSprite("Line"),
    spriteCostume("Line", "images/menu/BG1-4.svg", 1),
    moveTo("Line", -400, -400),
    makeSpriteVar("Line", "Size"),
    setSpriteVar("Line", "Size", 0),
    repeatUntil( not( equal(getVar("Scene"), "Main Menu") ),
        repeat(25, 
            changeSpriteVarBy("Line", "Size", 0.02),
            wait(0.08),
            makeClone("Line"),
        ),
        repeat(25, 
            changeSpriteVarBy("Line", "Size", -0.02),
            wait(0.08),
            makeClone("Line"),
        ),
    ),
);

whenClone("Line",
    moveTo("Line", -300, mult(round(randomNum(-35, 3)), 10)),
    setSpriteVar("Line", "Size", add(getSpriteVar("Line", "Size"), randomNum(0, 0.2))),
    spriteSetSize("Line", getSpriteVar("Line", "Size")),
    ifBlock( gEqThan(spriteY("Line"), -200),
        spriteEffect("Line", "brightness", mult( div( abs(spriteY("Line")), 100), 15) ),
        "else",
        ifBlock( lEqThan(spriteY("Line"), -200 ),
            spriteEffect("Line", "brightness", mult( div( abs(spriteY("Line")), -100), 15) ),
        ),
    ),
    direction("Line", 335),
    repeat(80,
        moveBy("Line", mult(17, cos(20)), mult(17, sin(20))),
        ifBlock( or( gThan(spriteX("Line"), 280), not(equal(getVar("Scene"), "Main Menu")) ),
            deleteClone("Line"),
        ),
        wait(0.02),
    ),
    deleteClone("Line"),
);


loadPlayerData();

makeVar("Scene");
setVar("Scene", "Main Menu");
createSprite("Torch"); spriteCostume("Torch", "images/menu/torch_full.png", 0.5);
spriteEffect("Torch", "ghost", 100);
phaseIn(0.3);
wait(1);     
phaseOut(0.3); deleteSprite("Torch");
broadcast("Main Menu");



