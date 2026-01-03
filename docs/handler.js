const chooser = document.getElementById("chooser");

const canvas = new Canvas(64, 64);

// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("touchmove", event => event.preventDefault(), { passive: false });

addEventListener("popupclose", event => {
    if (event.detail.id === "import-popup") {
        const files = Array.from(chooser.files);
        
        if (files.length > 0) {
            const context = canvas.context;

            Promise.all(files.map(file => createImageBitmap(file))).then(images => {
                images.forEach(image => {
                    canvas.addImage("");

                    context.clearRect(0, 0, canvas.width, canvas.height);

                    image.close();
                });
            }).catch(error => {});
        }
    }
});