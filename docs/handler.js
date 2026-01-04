const view = document.getElementById("view");
const context = view.getContext("2d");

const importChooser = document.getElementById("import-chooser");

const canvas = new Canvas(800, 800);

// Prevent right clicking
addEventListener("contextmenu", event => event.preventDefault(), { passive: false });

// Prevent touch scrolling
addEventListener("touchmove", event => event.preventDefault(), { passive: false });

addEventListener("popupclose", event => {
    if (event.detail.id === "import-popup") {
        const files = Array.from(importChooser.files);
        
        if (files.length > 0) {
            const context = canvas.context;

            Promise.all(files.map(file => createImageBitmap(file))).then(images => {
                images.forEach(image => {                    
                    canvas.bind(canvas.addLayer(""));

                    context.drawImage(image, 0, 0);

                    canvas.apply();

                    image.close();
                });

                updateView();
            }).catch(error => {
                alert("Failed to load images!");
            });
        }
    }
});

function updateView() {
    context.putImageData(canvas.composite(), 0, 0);
}