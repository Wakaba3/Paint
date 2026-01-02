// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("touchmove", event => event.preventDefault(), { passive: false });

let canvas = new Canvas(1920, 1080);

canvas.addImage("Image", true);
canvas.save();
canvas.undo();

console.log(canvas);