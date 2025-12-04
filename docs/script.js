const canvas = document.getElementById("canvas");
const gl = initWebGL(canvas);
//const worker = new Worker("worker.js");

const shaderProgram = loadShaderProgram(gl, "shaders/shader.vert", "shaders/shader.frag");

const undo = document.getElementById("undo");
const redo = document.getElementById("redo");

const MAX_ACTIVITIES_LENGTH = 256;
const activities = [];
let activityIndex = 0;

const pointers = [];

let isDrawing = false;
let drawingKey = 0;

onmessage = event => {
};

addEventListener("toutchmove", event => {
    event.preventDefault();
}, { passive: false });

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", updateDrawing);
canvas.addEventListener("pointerup", finishDrawing);

//Execute
main();

function main() {
}

function initWebGL(canvas) {
    const gl = canvas.getContext("webgl");

    if (!gl) {
        console.error("Unable to initialize WebGL. Your browser or machine may not support it.");
    }

    return gl;
}

function loadShaderProgram(gl, vsUrl, fsUrl) {
    if (!gl)
        return null;

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsUrl);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsUrl);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Unable to initialize the shader program:", gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

async function loadShader(gl, type, url) {
    const source = await loadShaderSource(url);

    if (source) {
        const shader = gl.createShader(type);
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("An error occurred compiling the shaders:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    } else {
        return null;
    }
}

async function loadShaderSource(url) {
    try {
        const response = await fetch(url);
        return await response.text();
    } catch (error) {
        console.error("Failed to load shader:", url);
        return "";
    }
}

function addActivity(event) {
    if (activities.length > activityIndex) {
        activities.splice(activityIndex);
    }

    activities.push(new Activity(event));
    ++activityIndex;

    if (activities.length > MAX_ACTIVITIES_LENGTH) {
        activities.shift();
        activityIndex = MAX_ACTIVITIES_LENGTH - 1;
    }
}

function undoActivity() {
    if (activityIndex > 0) {
        --activityIndex;
    }
}

function redoActivity() {
    if (activityIndex < activities.length) {
        ++activityIndex;
    }
}

function startDrawing(event) {
    isDrawing = true;
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

class Activity {
    constructor(event) {
        this.event = event;
    }

    execute() {
        this.event();
    }
}

class Position {
    constructor(x, y) {
        this._x = x;
        this._y = y;
    }

    get x() {
        return this._x;
    }

    get y() {
        return this._y;
    }
}