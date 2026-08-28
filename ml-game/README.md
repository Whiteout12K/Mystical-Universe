# JScratch

### A JavaScript-Driven Interpretation of Scratch

JScratch is a **.js-driven game engine inspired by the Scratch programming language**, designed from the ground up for the modern web.

While Scratch focuses on visual block programming, JScratch takes the same approachable programming concepts and translates them into **JavaScript function calls**. This allows projects to retain the simplicity and structure of Scratch while gaining the flexibility, performance, and deployability of a web-based JavaScript environment.

Wtih all Scratch driven visuals encoded into a .js format, one can take a step into easing into the web development sphere. Beside the basic Scratch blocks, several additional blocks centered on manipulating css styles and retrieving internet items are built-in. Even more code blocks will be added in the future, but user-made codes are also supported.

For setup, simply download this entire repo file, place it into your favorite code editor (strongly suggest VS Code), install the Go Live extention, and deploy and run on your local desktop.

> **JScratch is Scratch-inspired programming taken to another level — built for the web first.**



# Introduction

JScratch is a **web-first programming and game engine** based on the ideas behind Scratch.

Instead of dragging blocks together in a visual editor, JScratch represents those blocks as JavaScript functions.

For example, a Scratch-style concept such as:

> Move a character 10 steps

can be represented by:

```js
moveTo("Player1", 10, 0);
```

Likewise, creating a sprite can be as simple as:

```js
createSprite("Player1");
```

This approach makes JScratch useful for people who enjoy Scratch's straightforward programming model but want to work directly with JavaScript, files, assets, websites, and deployable web games.



# Core Philosophy

JScratch is designed around several principles.

### Scratch-inspired

JScratch follows many familiar Scratch concepts:

* Sprites
* Costumes
* Variables
* Operators
* Sensing
* Control flow
* Events
* Broadcasts
* Functions
* Sounds

The goal is to make the programming model easy to understand while still allowing more advanced projects.

### JavaScript-driven

JScratch projects are written using JavaScript.

Instead of a custom visual block file, a project can directly contain code such as:

```js
createSprite("Player1");

spriteCostume(
    "Player1",
    "images/player.png",
    1
);

moveTo("Player1", 0, 0);
```

This makes JScratch naturally compatible with the web ecosystem.

### Web-first

JScratch is designed specifically around browser-based projects.

Projects can use:

* HTML
* CSS
* JavaScript
* Images
* Audio
* Web hosting
* Web APIs
* Server-side services
* Databases
* Other JavaScript libraries

The goal is not simply to recreate Scratch in JavaScript, but to create a programming environment that **fits naturally into the web**.

### Deployable

A JScratch project can ultimately be hosted like a normal website or web game.

This makes the engine suitable for:

* Small games
* Interactive experiences
* Prototypes
* Educational projects
* Browser games
* Larger web applications



# Quick Reference

## Canvas

```js
canvasColor();
canvasCostume();
canvasSize();
canvasChangeSize();
canvasEffect();
costumeOfCanvas();
sizeOfCanvas();
```

## Sprites

```js
createSprite();
spriteCostume();
spriteSetSize();
spriteChangeSize();
spriteEffect();
spriteShow();
spriteHide();
spriteLayer();
goFront();
goBack();
costumeOfSprite();
sizeOfSprite();
deleteSprite();
```

## Motion

```js
spriteX();
spriteY();
spriteDirection();
moveToEdge();
moveTo();
moveToSprite();
facing();
direction();
turn();
glideTo();
glideToSprite();
```

## Operators

```js
add();
sub();
mult();
div();
mod();
round();
randomNum();

gThan();
lThan();
gEqThan();
lEqThan();
equal();

and();
or();
not();

join();
letter();
length();
contain();
```

## Variables

```js
makeVar();
setVar();
changeVarBy();
getVar();

makeSpriteVar();
setSpriteVar();
changeSpriteVarBy();
getSpriteVar();
```

## Sensing

```js
touchingMouse();
touchingSprite();
touchingColor();
distanceMouse();
distanceSprite();
keyPressed();

mouseX();
mouseY();

currentYear();
currentMonth();
currentDay();
currentHour();
currentMin();
```

## Control

```js
wait();
repeat();
ifBlock();
repeatUntil();
whileBlock();
forever();
endScript();
```

## Events

```js
broadcast();
broadcastAndWait();
whenBroadcast();
```

## Functions

```js
function myFunction(){

}
```

## Sound

```js
makeSound();
playSound();
stopAllSound();
stopSound();

setPitch();
changePitch();

setPan();

setVolume();
changeVolume();
volumeOfSound();
```




