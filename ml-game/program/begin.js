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

whenBroadcast("ColorChange",
    forever(
        ifBlock( and( lThan(abs(spriteX("Knight")), 30), lThan(abs(spriteY("Knight")), 30) ),
            spriteEffect("Knight", "color", 25),
            spriteCostume("Knight","images/sample_sprite.png", 2),
        )
    )
);

whenBroadcast("End",
    deleteSprite("Knight"),
);

broadcast("MovePosition");
broadcast("ColorChange");

facing("Knight", "up");



