const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");
const worker = new Worker("worker.js");

main();

function main() {
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }
}

onmessage = event => {
};

addEventListener("toutchmove", event => {
    event.preventDefault();
}, { passive: false }); 