class Popup {
    static #registry = new Map();
    static #dragging = null; //Nullable

    static {
        addEventListener("pointermove", Popup.#continueDragging);
        addEventListener("pointerup", Popup.#finishDragging);
        window.addEventListener("resize", event => this.#registry.forEach(popup => popup.locate()));
    }

    #popup;
    #bar;
    #title;
    #close;
    #content;
    #x;
    #y;
    #offsetX;
    #offsetY;
    #width;
    #height;

    constructor(id = "untitled-popup", title = "Untitled", width = 300, height = 300) {
        this.#popup = document.createElement("div");
        this.#bar = document.createElement("div");
        this.#title = document.createElement("div");
        this.#close = document.createElement("button");
        this.#content = document.createElement("div");

        this.#popup.id = id;
        this.#bar.id = this.#popup.id + "-bar";
        this.#title.id = this.#popup.id + "-title";
        this.#close.id = this.#popup.id + "-close";
        this.#content.id = this.#popup.id + "-content";

        this.#popup.classList.add("popup", "popup-disabled", "bordered-menu");
        this.#bar.classList.add("popup-bar");
        this.#title.classList.add("popup-title");
        this.#close.classList.add("popup-close");
        this.#content.classList.add("popup-content");

        this.#close.setAttribute("translate", "no");

        this.#title.textContent = title;
        this.#close.textContent = "✕";
        this.#bar.addEventListener("pointerdown", Popup.#startDragging);
        this.#close.addEventListener("click", event => this.close());

        this.#popup.appendChild(this.#bar);
        this.#popup.appendChild(this.#content);
        this.#bar.appendChild(this.#title);
        this.#bar.appendChild(this.#close);

        this.#x = 0;
        this.#y = 0;
        this.#offsetX = 0;
        this.#offsetY = 0;
        this.#width = width;
        this.#height = height;

        document.body.appendChild(this.#popup);

        Popup.#registry.set(this.#popup.id, this);
    }

    static #get(id) {
        return Popup.#registry.get(id);
    }

    static openOrClose(id) {
        let popup = Popup.#get(id);

        if (popup) {
            popup.openOrClose();
        }
    }

    static open(id) {
        let popup = Popup.#get(id);

        if (popup) {
            popup.open();
        }
    }

    static close(id) {
        let popup = Popup.#get(id);

        if (popup) {
            popup.close();
        }
    }

    openOrClose() {
        if (this.isDisabled()) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        if (this.isEnabled()) {
            this.close();
        }

        this.#setEnabled();
        this.locate();
    }

    close() {
        this.#setDisabled();
    }

    locate(x, y) {
        this.#x = Number.isFinite(x) ? x : window.scrollX + window.innerWidth / 2;
        this.#y = Number.isFinite(y) ? y : window.scrollY + window.innerHeight / 2;

        this.#popup.style.left = (this.#x + this.#offsetX) + "px";
        this.#popup.style.top = (this.#y + this.#offsetY) + "px";
    }

    resize(width, height) {
        this.#width = Number.isFinite(width) ? width : 300;
        this.#height = Number.isFinite(height) ? height : 300;

        this.#popup.style.width = this.#width + "px";
        this.#popup.style.height = this.#height + "px";
    }

    setContent(content) {
        // Clear
        while (this.#content.firstChild) {
            this.#content.removeChild(this.#content.firstChild);
        }

        this.#content.appendChild(content);
    }

    isEnabled() {
        return this.#popup.classList.contains("popup-enabled");
    }

    isDisabled() {
        return this.#popup.classList.contains("popup-disabled");
    }

    static #startDragging(event) {
        if (!Popup.#dragging && event.target) {
            let id = event.target.id;

            if (id.endsWith("-bar")) {
                Popup.#dragging = Popup.#get(id.substring(0, id.length - 4));

                if (Popup.#dragging instanceof Popup) {
                    Popup.#dragging.#offsetX = parseInt(Popup.#dragging.#popup.style.left) - event.pageX;
                    Popup.#dragging.#offsetY = parseInt(Popup.#dragging.#popup.style.top) - event.pageY;

                    Popup.#dragging.locate(event.pageX, event.pageY);
                } else {
                    Popup.#dragging = null;
                }
            }
        }
    }

    static #continueDragging(event) {
        if (Popup.#dragging) {
            Popup.#dragging.locate(event.pageX, event.pageY);
        }
    }

    static #finishDragging(event) {
        if (Popup.#dragging) {
            Popup.#dragging.locate(event.pageX, event.pageY);

            Popup.#dragging.#offsetX = 0;
            Popup.#dragging.#offsetY = 0;

            Popup.#dragging = null;
        }
    }

    #setEnabled() {
        this.#popup.classList.remove("popup-disabled");
        this.#popup.classList.add("popup-enabled");
    }

    #setDisabled() {
        this.#popup.classList.remove("popup-enabled");
        this.#popup.classList.add("popup-disabled");
    }
}

class Activity {
    #tasks;
    
    constructor() {
        this.#tasks = [];
    }

    executeAndRegister(task) {
        if (typeof task === "function") {
            task();
            this.#tasks.push(task);
        }
    }

    executeAll() {
        this.#tasks.forEach(task => task());
    }
}

class Layer {
    constructor(imageData) {
        this.imageData = imageData;
        this.blending = "source-over";
    }
}