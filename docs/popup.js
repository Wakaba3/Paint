setup();

function setup() {
    //Style definition
    let style = document.createElement("style");

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
    let nodes = document.querySelectorAll(".popup");
    
    let contents, body, close, onclick, children;

    nodes.forEach(node => {
        contents = document.createElement("div");
        body = document.createElement("div");
        close = document.createElement("div");
        onclick = document.createAttribute("onclick");
        children = [];

        contents.classList.add("popup-contents");
        body.classList.add("popup-body");
        close.classList.add("popup-close");

        close.textContent = "Close";
        onclick.value = "openOrClosePopup('" + node.id + "')";

        node.childNodes.forEach(child => {
            if (child instanceof Node) {
                children.push(child);
            }
        });

        close.setAttributeNode(onclick);
        node.hidden = true;
        node.textContent = "";

        children.forEach(child => body.appendChild(child));
        contents.appendChild(body);
        contents.appendChild(close);
        node.appendChild(contents);
    });

    //Dragging definition
    let draggingPopups = [];

    addEventListener("pointerdown", event => {
        let target = event.target;

        if (target instanceof HTMLElement && target.classList.contains("popup")) {
            draggingPopups.push([target, target.offsetLeft, target.offsetTop, target.offsetLeft - event.pageX, target.offsetTop - event.pageY]);
        }
    });

    addEventListener("pointermove", event => {
        draggingPopups.forEach(popup => {
            popup[0].style.left = (event.pageX + popup[3]) + "px";
            popup[0].style.top = (event.pageY + popup[4]) + "px";
        });
    });

    addEventListener("pointerup", event => {
        draggingPopups.length = 0;
    });
}

function openOrClosePopup(id = "") {
    let popup = document.getElementById(id);

    if (popup instanceof Element) {
        popup.hidden = !popup.hidden;
        popup.style.left = (window.innerWidth / 2) + "px";
        popup.style.top = (window.innerHeight / 2) + "px";
    }
}