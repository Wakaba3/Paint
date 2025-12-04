const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");
const worker = new Worker("worker.js");

const activities = [];
const pointers = [];

let isDrawing = false;
let drawingKey = 0;

main();

function main() {
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }
}

class Activity {
    constructor(event) {
        this.event = event;
    }

    execute() {
        this.event();
    }
}

function addActivity(event) {
    activities.push(new Activity(event));

    if (activities.length > 256) {
        activities.shift();
    }
}

function startDrawing(event) {
    isDrawing = true;
    resetPointers();
    addPointer(event.clientX, event.clientY);
}

function updateDrawing(event) {
    if (isDrawing) {
        addPointer(event.clientX, event.clientY);
    }
}

function finishDrawing(event) {
    isDrawing = false;
    addPointer(event.clientX, event.clientY);
    resetPointers();
}

function resetPointers() {
    let copiedPointers = pointers.slice();

    addActivity(() => {
        copiedPointers.forEach(pointer => {
            addPointer(pointer.x, pointer.y);
        });
    });

    pointers.length = 0;
}

function addPointer(x, y) {
    pointers.push({x: x, y: y});
}

onmessage = event => {
};

addEventListener("toutchmove", event => {
    event.preventDefault();
}, { passive: false });

canvas.addEventListener("pointerdown", startDrawing);

canvas.addEventListener("pointermove", updateDrawing);

canvas.addEventListener("pointerup", finishDrawing);