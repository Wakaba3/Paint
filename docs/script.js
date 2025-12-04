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

// Execute
main();

function main() {
}

function initWebGL(canvas) {
    const gl = canvas.getContext("webgl");

    if (!gl) {
        console.error("Failed to initialize WebGL. Your browser or machine may not support it.");
    }

    return gl;
}

function loadShaderProgram(gl, vsUrl, fsUrl) {
    if (!gl)
        return null;

    const shaderProgram = gl.createProgram();

    loadShader(gl, gl.VERTEX_SHADER, vsUrl).then(vertexShader => gl.attachShader(shaderProgram, vertexShader));
    loadShader(gl, gl.FRAGMENT_SHADER, fsUrl).then(fragmentShader => gl.attachShader(shaderProgram, fragmentShader));
    
    gl.linkProgram(shaderProgram);
    if (gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
        return shaderProgram; // Successful
    
    // Error
    console.error("Failed to initialize the shader program");
    gl.deleteProgram(shaderProgram);

    console.error("Vertex shader: ", vertexShader);
    console.error("Fragment shader: ", fragmentShader);

    return null;
}

async function loadShader(gl, type, url) {
    const source = await loadShaderSource(url);

    if (source) {
        const shader = gl.createShader(type);
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Failed to complie the shader: ", gl.getShaderInfoLog(shader));
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
        const source = (await fetch(url)).text();

        if (source)
            return source;
    } catch (error) {}

    console.error("Failed to load the shader source: ", url);
    
    return "";
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