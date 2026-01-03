const worker = new Worker("worker.js");

// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("touchmove", event => event.preventDefault(), { passive: false });

worker.postMessage([1920, 1080]);