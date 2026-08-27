// <----- Canvas Blocks ----->

canvasColor("#686565");
canvasCostume("images/sample_canvas.png", 2);

createSprite(join("Kni", "ght"));
spriteCostume("Knight","images/sample_sprite.png", 1);

moveTo("Knight", 0, 0);

let danceStep=0;

whenBroadcast("MovePosition",
    forever(
        moveTo("Knight", mouseX(), mouseY()),
    )
);

whenBroadcast("MovePosition",
    forever(
        moveTo("Knight", mouseX(), mouseY()),

        ifBlock( and( lThan(abs(spriteX("Knight")), 30), lThan(abs(spriteY("Knight")), 30) ),
            spriteEffect("Knight", "color", 25),
        )
    )
);

whenBroadcast("End",
    deleteSprite("Knight"),
);

broadcast("MovePosition");

facing("Knight", "up");



