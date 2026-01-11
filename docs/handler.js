const worker = new Worker("paint.js");

const view = document.getElementById("view").transferControlToOffscreen();
const buffer = new OffscreenCanvas(0, 0);
const context = buffer.getContext("2d", { willReadFrequently : true });

const undo = document.getElementById("undo");
const redo = document.getElementById("redo");
const canvasZoomOut = document.getElementById("canvas-zoom-out");
const canvasZoomIn = document.getElementById("canvas-zoom-in");

const displayGrid = document.getElementById("display-grid");

const importChooser = document.getElementById("import-chooser");

const sizeWidth = document.getElementById("size-width");
const sizeHeight = document.getElementById("size-height");

const points = new Map();
const keys = new Set();
let primary;
let axis;

let canvasData;
let bindingLayer;
let layerData;

worker.onmessage = event => {
    switch (event.data.type) {
        case "resize":
            sizeWidth.value = event.data.width;
            sizeHeight.value = event.data.height;

            if (event.data.successful) {
                showMessage(`キャンバスのサイズを（幅、高さ）＝（${event.data.width}px、${event.data.height}px）に変更しました！`);
            }

            break;
        case "info":
            undo.style.color = event.data.canUndo ? "" : "var(--foreground-color)";

            redo.style.color = event.data.canRedo ? "" : "var(--foreground-color)";

            canvasZoomOut.style.pointerEvents = event.data.canZoomOut ? "auto" : "none";
            canvasZoomOut.style.color = event.data.canZoomOut ? "" : "var(--foreground-color)";

            canvasZoomIn.style.pointerEvents = event.data.canZoomIn ? "auto" : "none";
            canvasZoomIn.style.color = event.data.canZoomIn ? "" : "var(--foreground-color)";

            displayGrid.checked = event.data.displayGrid;

            canvasData = event.data.canvasData;
            bindingLayer = event.data.bindingLayer;
            layerData = event.data.layerData;
            
            break;
        case "message":
            showMessage(event.data.message);

            break;
        case "error":
            throw new Error(event.data.error);

            break;
    }
};

worker.postMessage({
    type: "init",
    view: view,
    width: 768,
    height: 1024
}, [view]);

displayGrid.addEventListener("input", event => {
    setPreferences({ displayGrid: event.target.checked });
});

// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("touchmove", event => event.preventDefault(), { passive: false });

addEventListener("panelopen", event => {
    switch (event.detail.id) {
        case "import-panel":
            importChooser.value = null;

            break;
    }
})

addEventListener("panelclose", event => {
    switch (event.detail.id) {
        case "import-panel":
            importImages(Array.from(importChooser.files));

            break;
        case "size-panel":
            resizeCanvas(Number(sizeWidth.value), Number(sizeHeight.value));

            break;
    }
});

addEventListener("pointerdown", event => {
    if (event.target.id !== "contents")
        return;

    points.set(event.pointerId, event);

    if (event.isPrimary)
        primary = event.pointerId;
})

addEventListener("pointermove", event => {
    const point = points.get(event.pointerId);

    if (point instanceof PointerEvent) {
        if (points.size === 1) {
            translateCanvas(event.pageX - point.pageX, event.pageY - point.pageY);
        } else if (points.size === 2) {
        }

        points.set(event.pointerId, event);
    }
});

addEventListener("pointerup", event => {
    points.delete(event.pointerId);

    if (event.isPrimary)
        primary = NaN;
});

addEventListener("keydown", event => {
    if (event.target !== document.body)
        return;

    keys.add(event.key);

    let dx = 0, dy = 0, mScale = 1;

    // Activity
    if (event.ctrlKey && !event.shiftKey && keys.has("z"))
        undoCanvas();
    if (event.ctrlKey && event.shiftKey && keys.has("Z"))
        redoCanvas();

    // Transform
    if (keys.has("d") || keys.has("D") || keys.has("ArrowRight"))
        dx -= 1;
    if (keys.has("w") || keys.has("W") || keys.has("ArrowUp"))
        dy += 1;
    if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft"))
        dx += 1;
    if (keys.has("s") || keys.has("S") || keys.has("ArrowDown"))
        dy -= 1;
    if (keys.has(";") || keys.has("+"))
        mScale *= Math.SQRT2;
    if (keys.has("-"))
        mScale /= Math.SQRT2;

    if (dx !== 0 || dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
            dx /= length;
            dy /= length;

            translateCanvas(dx, dy, true);
        }
    }

    if (mScale !== 0) {
        scaleCanvas(mScale);
    }
});

addEventListener("keyup", event => {
    keys.delete(event.key);
});

function importImages(files = []) {
    if (files.length <= 0)
        return;

    Promise.all(files.map(file => createImageBitmap(file).then(image => {
        return {
            name: file.name, 
            content: image
        };
    }).catch(error => {
        return {
            name: "",
            content: null
        };
    }))).then(contents => {
        if (contents.length > 0) {
            worker.postMessage({
                type: "import",
                contents: contents
            });

            showMessage(contents.length === 1 ? "画像を読み込みました" : `${contents.length}枚の画像を読み込みました`);
        }
    }).catch(error => {
        showMessage("画像の読み込みに失敗しました！");
        console.log(error);
    });
}

function resizeCanvas(width = 0, height = 0) {
    worker.postMessage({
        type: "resize",
        width: width,
        height: height
    });
}

function undoCanvas() {
    worker.postMessage({ type: "undo" });
}

function redoCanvas() {
    worker.postMessage({ type: "redo" });
}

function centerCanvas() {
    worker.postMessage({
        type: "center",
        index: 10
    });
}

function translateCanvas(dx = 0, dy = 0, discrete = false) {
    worker.postMessage({
        type: "translate",
        index: 10,
        dx: dx,
        dy: dy,
        discrete: discrete
    });
}

function scaleCanvas(dScale = 0) {
    worker.postMessage({
        type: "scale",
        index: 10,
        dScale: dScale
    });
}

function rotateCanvas(dAngle = 0) {
    worker.postMessage({
        type: "rotate",
        index: 10,
        dAngle: dAngle
    });
}

function setPreferences(preferences = {}) {
    worker.postMessage({
        type: "preferences",
        preferences: preferences
    });
}

function uploadLayer(index = NaN) {
    worker.postMessage({
        type: "upload",
        index: index
    });
}