const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");
const worker = new Worker("worker.js");

main();

onmessage = event => {
};

function main() {
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }
}