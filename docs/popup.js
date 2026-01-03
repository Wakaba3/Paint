setup();

function setup(name = "popup") {
    let fragment = document.createDocumentFragment();

    //Style definition
    let style = document.createElement("style");

    style.textContent = `
        .${name} {
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

        .${name + "-contents"} {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 10px;
            z-index: 0;
        }

        .${name + "-body"} {
            flex: 1;
            padding: 10px 30px;
            z-index: 0;
        }

        .${name + "-close"} {
            pointer-events: auto;
            flex: 1;
            padding: 0px 30px;
            z-index: 1;
            border: thin solid var(--foreground-color);
            border-radius: 5px;
            background-color: var(--background-color);
        }

        .${name + "-close"}:active {
            background-color: var(--foreground-color);
        }
    `;

    //Element Modification
    let nodes = document.querySelectorAll("." + name);
    
    let contents, body, close, onclick, state, children;

    nodes.forEach(node => {
        contents = document.createElement("div");
        body = document.createElement("div");
        close = document.createElement("div");
        onclick = document.createAttribute("onclick");
        state = document.createAttribute("state");
        children = [];

        contents.classList.add(name + "-contents");
        body.classList.add(name + "-body");
        close.classList.add(name + "-close");

        close.textContent = "Close";
        onclick.value = "closePopup('" + node.id + "')";
        state.value = "none";

        node.childNodes.forEach(child => {
            if (child instanceof Node) {
                children.push(child);
            }
        });

        close.setAttributeNode(onclick);
        node.setAttributeNode(state);
        node.hidden = true;
        node.textContent = "";

        children.forEach(child => body.appendChild(child));
        contents.appendChild(body);
        contents.appendChild(close);
        node.appendChild(contents);
    });

    addEventListener("pointerdown", event => {
        let target = event.target;

        if (target instanceof Element) {
            while (!target.classList.contains("popup")) {
                if (target.offsetParent) {
                    target = target.offsetParent;

                    continue;
                }

                return;
            }
        }

        console.log(target);

        if (target && target.classList.contains("popup")) {
            console.log("Clicked!");
        }
    });

    fragment.appendChild(style);

    document.body.appendChild(fragment);
}

function openOrClosePopup(id = "") {
    let popup = document.getElementById(id);

    if (popup instanceof Element) {
        popup.hidden = !popup.hidden;
    }
}

function closePopup(id = "") {
    let popup = document.getElementById(id);

    if (popup instanceof Element) {
        popup.hidden = true;
    }
}