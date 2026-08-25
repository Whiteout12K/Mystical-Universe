

createSprite("Player1");
createSprite("Enemy1");
createSprite("Enemy2");

canvasColor("#000000");

setVar("root_path","/images/mlg-assets/Characters/C1/costume");

spriteCostume("Player1", join(getVar("root_path"), "/costume_2.png"), 1);
spriteCostume("Enemy1","/images/mlg-assets/Characters/C1/costume/costume_2.png",0.75);
spriteCostume("Enemy2","/images/mlg-assets/Characters/C1/costume/costume_2.png",0.75);

moveTo("Player1",0,0);
moveTo("Enemy1",150,0);
moveTo("Enemy2",-150,0);

ENGINE.scripts.push(
    repeat(100,
        repeat(30,
            moveBy("Player1",0,5),
            wait(0.05)
        ),
        repeat(30,
            moveBy("Player1",0,-5),
            wait(0.05)
        )
    )
);

ENGINE.scripts.push(
    repeat(100,
        repeat(30,
            moveBy("Enemy1",4,0),
            wait(0.05)
        ),
        repeat(30,
            moveBy("Enemy1",-4,0),
            wait(0.05)
        )
    )
);

ENGINE.scripts.push(
    repeat(100,
        repeat(20,
            moveBy("Enemy2",4,0),
            wait(0.08)
        ),
        repeat(20,
            moveBy("Enemy2",-4,0),
            wait(0.08)
        )
    )
);
