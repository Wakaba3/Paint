const worker = new Worker("paint.js");

const view = document.getElementById("view");
const context = view.getContext("2d");

const importChooser = document.getElementById("import-chooser");

const sizeWidth = document.getElementById("size-width");
const sizeHeight = document.getElementById("size-height");

context.imageSmoothingEnabled = false;

// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("touchmove", event => event.preventDefault(), { passive: false });

addEventListener("panelopen", event => {
    switch (event.detail.id) {
        case "preference-panel":
            sizeWidth.value = canvas.width;
            sizeHeight.value = canvas.height;

            break;
    }
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
                alert("画像を読み込みました");
            } else {
                alert(`${images.length}枚の画像を読み込みました`);
            }
        }
    }).catch(error => {
        alert("画像の読み込みに失敗しました！");
    });
}

function moveCanvas(angle = 0, velocity = 0) {
}

function zoomCanvas(step = 0) {
}

function retateCanvas(angle = 0) {
}

function resizeCanvas(width = 0, height = 0) {
    if (false) {
        alert(`キャンバスのサイズを（幅、高さ）＝（${width}px、${height}px）に変更しました！`);
    }
}