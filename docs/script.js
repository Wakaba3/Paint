const view = document.getElementById("view");
const vctx = view.getContext("2d");

const undo = document.getElementById("undo");
const redo = document.getElementById("redo");

//Popup
const popup = document.getElementById("popup");
const popupBar = document.getElementById("popup-bar");
const popupTitle = document.getElementById("popup-title");
const popupContent = document.getElementById("popup-content");
let popupX = 0;
let popupY = 0;
let popupWidth = 0;
let popupHeight = 0;
let popupOffsetX = 0;
let popupOffsetY = 0;
let draggingPopup = false;

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
let canvas = new OffscreenCanvas(view.width, view.height);
let cctx = canvas.getContext("2d");
let canvasX = 0;
let canvasY = 0;
let canvasWidth = view.width;
let canvasHeight = view.height;
let layers = [];
let bindingLayer = null; // Nullable

// Drawing
let pointers = [];
let drawing = false;

// Rendering
let timer = 0;
let fps = 30;
let requireViewUpdate = true;

// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("toutchmove", event => event.preventDefault(), { passive: false });

window.addEventListener("resize", event => locatePopup());

view.addEventListener("pointerdown", startDrawing);
view.addEventListener("pointermove", continueDrawing);
view.addEventListener("pointerup", finishDrawing);

popupBar.addEventListener("pointerdown", startDraggingPopup);
addEventListener("pointermove", continueDraggingPopup);
addEventListener("pointerup", finishDraggingPopup);

function main() {
    if (timer)
        clearInterval(timer);

    timer = setInterval(() => {
        // Render
        if (requireViewUpdate) {
            vctx.clearRect(0, 0, view.width, view.height);

            requireViewUpdate = false;
        }
    }, 1000 / fps);
}

function updateElements() {
    undo.disabled = activityIndex <= 0;
    redo.disabled = activityIndex >= activities.length;

    updateView();
}

function openOrClosePopup(name, width, height) {
    if (popup.classList.contains("popup-disabled")) {
        openPopup(name, width, height);
    } else {
        closePopup();
    }
}

function openPopup(name, width, height) {
    if (popup.classList.contains("popup-enabled"))
        closePopup();

    popup.classList.remove("popup-disabled");
    popup.classList.add("popup-enabled");
    popupTitle.textContent = name;

    locatePopup();
    resizePopup(width, height);
}

function closePopup() {
    popup.classList.remove("popup-enabled");
    popup.classList.add("popup-disabled");
}

function startDraggingPopup(event) {
    if (!draggingPopup && event.target.id === popupBar.id) {
        draggingPopup  = true;

        popupOffsetX = parseInt(popup.style.left) - event.pageX;
        popupOffsetY = parseInt(popup.style.top) - event.pageY;

        locatePopup(event.pageX, event.pageY);
    }
}

function continueDraggingPopup(event) {
    if (draggingPopup) {
        locatePopup(event.pageX, event.pageY);
    }
}

function finishDraggingPopup(event) {
    if (draggingPopup) {
        draggingPopup = false;

        locatePopup(event.pageX, event.pageY);

        popupOffsetX = 0;
        popupOffsetY = 0;
    }
}

function locatePopup(x, y) {
    popupX = Number.isFinite(x) ? x : window.scrollX + window.innerWidth / 2;
    popupY = Number.isFinite(y) ? y : window.scrollY + window.innerHeight / 2;

    popup.style.left = (popupX + popupOffsetX) + "px";
    popup.style.top = (popupY + popupOffsetY) + "px";
}

function resizePopup(width, height) {
    popupWidth = Number.isFinite(width) ? width : 300;
    popupHeight = Number.isFinite(height) ? height : 300;
    
    popup.style.width = popupWidth + "px";
    popup.style.height = popupHeight + "px";
}

function updateView() {
    requireViewUpdate = true;
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

        updateElements();
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

    updateView();
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

    updateView();
}

function resizeCanvas(width, height) {
    if (!canvas) {
        canvas = new OffscreenCanvas(width, height);
        cctx = canvas.getContext("2d");
    } else {

    }

    updateElements();
}

function startDrawing(event) {
    if (!drawing) {
        drawing = true;
        startActivity(() => addPointer(event.offsetX, event.offsetY));
    }
}

function continueDrawing(event) {
    if (drawing) {
        continueActivity(() => addPointer(event.offsetX, event.offsetY));
    }
}

function finishDrawing(event) {
    if (drawing) {
        drawing = false;
        finishActivity(() => {
            addPointer(event.offsetX, event.offsetY);
            clearPointers();
        });
    }
}

function addPointer(x, y) {
    pointers.push(transformCoords(x, y));

    updateView();
}

function debugPointers() {
    pointers.forEach(pointer => print("(x, y): (", pointer.x, ", ", pointer.y, ")"));
}

function clearPointers() {
    pointers = [];

    updateView();
}

function addDebugActivity(output) {
    addSimpleActivity(() => print(output));
}

function print(...outputs) {
    console.log(outputs.join(""));
}

function transformCoords(x, y) {
    return {
        x: x / displayScale + cameraX - canvasX,
        y: y / displayScale + cameraY - canvasY
    };
}