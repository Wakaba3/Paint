const view = document.getElementById("view");
const vctx = view.getContext("2d");

const undo = document.getElementById("undo");
const redo = document.getElementById("redo");

// Activity
const MAX_ACTIVITIES = 64;
let activities = [];
let buildingActivity = null; // Nullable
let activityIndex = 0; // 0 <= activityIndex <= activities.length;

// Camera
let cameraX = 0;
let cameraY = 0;
let displayScale = 1 // displayScale > 0;

// Canvas
let layers = [];
let bindingLayer = null; // Nullable
let canvasX = 0;
let canvasY = 0;
let canvasWidth = 0;
let canvasHeight = 0;

// Drawing
let pointers = [];
let isDrawing = false;

// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("toutchmove", event => event.preventDefault(), { passive: false });

view.addEventListener("pointerdown", startDrawing);
view.addEventListener("pointermove", continueDrawing);
view.addEventListener("pointerup", finishDrawing);

function updateElements() {
    undo.disabled = activityIndex <= 0;
    redo.disabled = activityIndex >= activities.length;
}

function addSimpleActivity(task) {
    startActivity(task);
    finishActivity();
}

function startActivity(task) {
    if (buildingActivity) {
        finishActivity();
    }

    // Remove activities that can be redone
    if (activityIndex < activities.length) {
        activities = activities.slice(0, activityIndex);
    }

    // Build an activity
    buildingActivity = new Activity();
    activityIndex = activities.length;

    buildingActivity.executeAndRegister(task);

    updateElements();
}

function continueActivity(task) {
    if (buildingActivity) {
        buildingActivity.executeAndRegister(task);
    }
}

function finishActivity(task) {
    if (buildingActivity) {
        buildingActivity.executeAndRegister(task);

        // Add a built activity
        activities.splice(activityIndex, 0, buildingActivity);
        buildingActivity = null;
        ++activityIndex;

        // Shift
        if (activities.length >= MAX_ACTIVITIES) {
            activities.shift();
            activityIndex = MAX_ACTIVITIES;
        }

        updateElements();
    }
}

function replayActivity() {
    for (let i = 0; i < activityIndex; ++i) {
        activities[i].executeAll();
    }
}

function undoActivity() {
    if (activityIndex > 0) {
        --activityIndex;
        replayActivity();
        updateElements();
    }
}

function redoActivity() {
    if (activityIndex < activities.length) {
        ++activityIndex;
        replayActivity();
        updateElements();
    }
}

function zoom(deltaScale) {
    displayScale += deltaScale;

    displayScale = Math.max(0.1, displayScale);
    displayScale = Math.min(displayScale, 10);
}

function addDebugActivity(output) {
    addSimpleActivity(() => console.log(output));
}

function startDrawing(event) {
    if (!isDrawing) {
        isDrawing = true;
        startActivity(() => addPointer(event.offsetX, event.offsetY));
    }
}

function continueDrawing(event) {
    if (isDrawing) {
        continueActivity(() => addPointer(event.offsetX, event.offsetY));
    }
}

function finishDrawing(event) {
    if (isDrawing) {
        isDrawing = false;
        finishActivity(() => {
            addPointer(event.offsetX, event.offsetY);
            debugPointers();
            clearPointers();
        });
    }
}

function addPointer(x, y) {
    pointers.push(transformCoords(x, y));
}

function debugPointers() {
    pointers.forEach(pointer => console.log("(x, y): (", pointer.x, ", ", pointer.y, ")"));
}

function clearPointers() {
    pointers = [];
}

function transformCoords(x, y) {
    return {
        x: x / displayScale + cameraX - canvasX,
        y: y / displayScale + cameraY - canvasY
    };
}