const paint = new Worker("paint.js");

const canvas = document.getElementById("view");
const view = canvas.transferControlToOffscreen();

const importChooser = document.getElementById("import-chooser");

const sizeWidth = document.getElementById("size-width");
const sizeHeight = document.getElementById("size-height");

const keys = new Set();

paint.postMessage({
    type: "init",
    view: view,
    width: 768,
    height: 1024
}, [view]);

paint.onmessage = event => {
    switch (event.data.type) {
        case "init":
            break;
        case "resize":
            sizeWidth.value = event.data.width;
            sizeHeight.value = event.data.height;

            if (event.data.successful) {
                showMessage(`キャンバスのサイズを（幅、高さ）＝（${event.data.width}px、${event.data.height}px）に変更しました！`);
            }

            break;
        case "message":
            showMessage(event.data.message);

            break;
        case "error":
            throw new Error(event.data.error);

            break;
    }
};

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

addEventListener("keydown", event => {
    keys.add(event.key);

    let dx = 0, dy = 0, length;

    if (keys.has("d") || keys.has("D") || keys.has("ArrowRight"))
        dx -= 1;
    if (keys.has("w") || keys.has("W") || keys.has("ArrowUp"))
        dy += 1;
    if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft"))
        dx += 1;
    if (keys.has("s") || keys.has("S") || keys.has("ArrowDown"))
        dy -= 1;

    length = Math.sqrt(dx * dx + dy * dy);

    if (length > 0)
        translateCanvas(dx / length, dy / length);
});

addEventListener("keyup", event => {
    keys.delete(event.key);
});

function importImages(files = []) {
    if (files.length <= 0)
        return;

    Promise.all(files.map(file => createImageBitmap(file))).then(images => {
        images.forEach(image => {
            image.close();
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
    });
}

function resizeCanvas(width = 0, height = 0) {
    paint.postMessage({
        type: "resize",
        width: width,
        height: height
    });
}

function translateCanvas(dx = 0, dy = 0) {
    paint.postMessage({
        type: "translate",
        index: [10, 20],
        dx: dx,
        dy: dy
    });
}

function scaleCanvas(power = 0) {
    paint.postMessage({
        type: "scale",
        index: [10, 20],
        power: power
    });
}

function rotateCanvas(angle = 0) {
    paint.postMessage({
        type: "rotate",
        index: [10, 20],
        angle: angle
    });
}