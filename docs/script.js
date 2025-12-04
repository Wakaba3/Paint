const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");
const worker = new Worker("worker.js");

const pointers = [];

main();

function main() {
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }
}

function addPointer(event) {
    pointers.push(event);

    console.log(event);
}

onmessage = event => {
};

addEventListener("toutchmove", event => {
    event.preventDefault();
}, { passive: false });

canvas.addEventListener("mousedown", event => {
    addPointer(event);
});

canvas.addEventListener("mousemove", event => {
    addPointer(event);
});

canvas.addEventListener("mouseup", event => {
    addPointer(event);
});

canvas.addEventListener("touchstart", event => {
    addPointer(event);
});

canvas.addEventListener("touchmove", event => {
    addPointer(event);
});

canvas.addEventListener("touchend", event => {
    addPointer(event);
});