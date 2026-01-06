const paint = new Worker("paint.js");

const view = document.getElementById("view").transferControlToOffscreen();

const importChooser = document.getElementById("import-chooser");

const sizeWidth = document.getElementById("size-width");
const sizeHeight = document.getElementById("size-height");

paint.postMessage({
    type: "init",
    view: view,
    canvasWidth: 768,
    canvasHeight: 1024
});

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
    switch (event.detail.id) {}
})

addEventListener("panelclose", event => {
    switch (event.detail.id) {
        case "import-panel":
            importImages(Array.from(importChooser.files));

            break;
        case "preference-panel":
            resizeCanvas(Number(sizeWidth.value), Number(sizeHeight.value));

            break;
    }
});

addEventListener("keydown", event => {
    switch (event.key) {
        case "d":
        case "ArrowRight":
            moveCanvas(180, 10);
            
            break;
        case "w":
        case "ArrowTop":
            moveCanvas(90, 10);

            break;
        case "a":
        case "ArrowLeft":
            moveCanvas(0, 10);

            break;
        case "s":
        case "ArrowDown":
            moveCanvas(-90, 10);

            break;
        case "-":
            zoomCanvas(-1);

            break;
        case "+":
            zoomCanvas(1);

            break;
    }
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

function moveCanvas(angle = 0, velocity = 0) {
}

function zoomCanvas(step = 0) {
}

function retateCanvas(angle = 0) {
}

function resizeCanvas(width = 0, height = 0) {
    paint.postMessage({
        type: "resize",
        width: width,
        height: height
    });
}