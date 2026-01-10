const worker = new Worker("paint.js");

const view = document.getElementById("view").transferControlToOffscreen();

const undo = document.getElementById("undo");
const redo = document.getElementById("redo");
const zoomOut = document.getElementById("zoom-out");
const zoomIn = document.getElementById("zoom-in");

const importChooser = document.getElementById("import-chooser");

const sizeWidth = document.getElementById("size-width");
const sizeHeight = document.getElementById("size-height");

const points = new Map();
const keys = new Set();

worker.onmessage = event => {
    switch (event.data.type) {
        case "resize":
            sizeWidth.value = event.data.width;
            sizeHeight.value = event.data.height;

            if (event.data.successful) {
                showMessage(`キャンバスのサイズを（幅、高さ）＝（${event.data.width}px、${event.data.height}px）に変更しました！`);
            }

            break;
        case "repaint":
            undo.style.pointerEvents = event.data.canvas.canUndo ? "auto" : "none";
            undo.style.color = event.data.canvas.canUndo ? "" : "var(--foreground-color)";
            redo.style.pointerEvents = event.data.canvas.canRedo ? "auto" : "none";
            redo.style.color = event.data.canvas.canRedo ? "" : "var(--foreground-color)";
            zoomOut.style.pointerEvents = event.data.canZoomOut ? "auto" : "none";
            zoomOut.style.color = event.data.canZoomOut ? "" : "var(--foreground-color)";
            zoomIn.style.pointerEvents = event.data.canZoomIn ? "auto" : "none";
            zoomIn.style.color = event.data.canZoomIn ? "" : "var(--foreground-color)";
            
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
    console.log(event);
})

addEventListener("pointermove", event => {
});

addEventListener("pointerup", event => {
});

addEventListener("keydown", event => {
    if (event.target !== document.body)
        return;

    keys.add(event.key);

    let dx = 0, dy = 0, mScale = 1;

    if (keys.has("d") || keys.has("D") || keys.has("ArrowRight"))
        dx -= 1;
    if (keys.has("w") || keys.has("W") || keys.has("ArrowUp"))
        dy += 1;
    if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft"))
        dx += 1;
    if (keys.has("s") || keys.has("S") || keys.has("ArrowDown"))
        dy -= 1;
    if (keys.has("+"))
        mScale *= Math.SQRT2;
    if (keys.has("-"))
        mScale /= Math.SQRT2;

    if (dx !== 0 || dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
            translateCanvas(dx / length, dy / length);
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

    Promise.all(files.map(file => createImageBitmap(file))).then(images => {
        worker.postMessage({
            type: "import",
            objects: images.map((image, index) => {
                return {
                    name: files[index].name,
                    image: image
                };
            })
        });

        if (images.length > 0) {
            if (images.length === 1) {
                showMessage("画像を読み込みました");
            } else {
                showMessage(`${images.length}枚の画像を読み込みました`);
            }
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

function translateCanvas(dx = 0, dy = 0) {
    worker.postMessage({
        type: "translate",
        index: 10,
        dx: dx,
        dy: dy
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