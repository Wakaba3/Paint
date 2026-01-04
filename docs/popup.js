setup();

function setup() {
    //Style definition
    const style = document.createElement("style");

    style.textContent = `
        .popup {
            pointer-events: auto;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            padding: 1% 5%;
            z-index: 1;
            overflow: hidden;
            color: white;
            border: thin solid var(--foreground-color);
            border-radius: 10px;
            background-color: var(--background-color);
        }

        .popup-contents {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 10px;
            z-index: 0;
        }

        .popup-body {
            flex: 1;
            padding: 10px 30px;
            z-index: 0;
        }

        .popup-close {
            pointer-events: auto;
            flex: 1;
            padding: 0px 30px;
            z-index: 1;
            font: 125% serif;
            border: thin solid var(--foreground-color);
            border-radius: 5px;
            background-color: var(--background-color);
        }

        .popup-close:active {
            background-color: var(--foreground-color);
        }
    `;

    document.body.appendChild(style);

    //Element Modification
    const popups = document.querySelectorAll(".popup");
    
    let contents, body, close, onclick, children;

    popups.forEach(popup => {
        contents = document.createElement("div");
        body = document.createElement("div");
        close = document.createElement("div");
        onclick = document.createAttribute("onclick");
        children = [];

        contents.classList.add("popup-contents");
        body.classList.add("popup-body");
        close.classList.add("popup-close");

        close.textContent = "Close";
        onclick.value = "openOrClosePopup('" + popup.id + "')";

        popup.childNodes.forEach(child => {
            if (child instanceof Node) {
                children.push(child);
            }
        });

        close.setAttributeNode(onclick);
        popup.hidden = true;
        popup.textContent = "";

        children.forEach(child => body.appendChild(child));
        contents.appendChild(body);
        contents.appendChild(close);
        popup.appendChild(contents);
    });

    //Popup handling
    const params = new Map();

    popups.forEach(popup => {
        params.set(popup, {
            dragging: false,
            offsetX: 0,
            offsetY: 0,
            normalX: 0.5,
            normalY: 0.5
        });
    });

    addEventListener("pointerdown", event => {
        const target = event.target;

        if (target instanceof HTMLElement && target.classList.contains("popup") && target.hasAttribute("draggable")) {
            const param = params.get(target);

            param.dragging = true;
            param.offsetX = target.offsetLeft - event.pageX;
            param.offsetY = target.offsetTop - event.pageY;
        }
    });

    addEventListener("pointermove", event => {
        params.forEach((params, popup) => {
            if (params.dragging) {
                popup.style.left = (event.pageX + params.offsetX) + "px";
                popup.style.top = (event.pageY + params.offsetY) + "px";

                params.normalX = popup.offsetLeft / window.innerWidth;
                params.normalY = popup.offsetTop / window.innerHeight;
            }
        });
    });

    addEventListener("pointerup", event => {
        params.forEach(params => params.dragging = false);
    });

    window.addEventListener("resize", event => {
        params.forEach((params, popup) => {
            popup.style.left = (params.normalX * window.innerWidth) + "px";
            popup.style.top = (params.normalY * window.innerHeight) + "px";
        });
    });
}

function openOrClosePopup(id = "") {
    const popup = document.getElementById(id);

    if (popup instanceof Element) {
        popup.hidden = !popup.hidden;
        popup.style.left = (window.innerWidth / 2) + "px";
        popup.style.top = (window.innerHeight / 2) + "px";

        dispatchEvent(new CustomEvent(popup.hidden ? "popupclose" : "popupopen", { detail: popup }));
    }
}