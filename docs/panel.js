setup();

function setup() {
    //Style definition
    const style = document.createElement("style");

    style.textContent = `
        .panel {
            pointer-events: auto;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            padding: 1% 5%;
            max-width: 95%;
            max-height: 95%;
            z-index: 1;
            color: white;
            overflow: hidden;
            border: thin solid var(--foreground-color);
            border-radius: 10px;
            background-color: var(--background-color);
        }

        .panel-contents {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 10px;
            z-index: 0;
        }

        .panel-body {
            flex: 1;
            padding: 10px 30px;
            z-index: 0;
        }

        .panel-close {
            pointer-events: auto;
            flex: 1;
            padding: 0px 30px;
            z-index: 1;
            font: 125% serif;
            border: thin solid var(--foreground-color);
            border-radius: 5px;
            background-color: var(--background-color);
        }

        .panel-close:active {
            background-color: var(--foreground-color);
        }
    `;

    document.body.appendChild(style);

    //Element Modification
    const panels = document.querySelectorAll(".panel");
    
    let contents, body, close, onclick, children;

    panels.forEach(panel => {
        contents = document.createElement("div");
        body = document.createElement("div");
        close = document.createElement("div");
        onclick = document.createAttribute("onclick");
        children = [];

        contents.classList.add("panel-contents");
        body.classList.add("panel-body");
        close.classList.add("panel-close");

        close.textContent = "Close";
        onclick.value = "togglePanel('" + panel.id + "')";

        panel.childNodes.forEach(child => {
            if (child instanceof Node) {
                children.push(child);
            }
        });

        close.setAttributeNode(onclick);
        panel.hidden = true;
        panel.textContent = "";

        children.forEach(child => body.appendChild(child));
        contents.appendChild(body);
        contents.appendChild(close);
        panel.appendChild(contents);
    });

    //Panel handling
    const params = new Map();

    panels.forEach(panel => {
        params.set(panel, {
            dragging: false,
            offsetX: 0,
            offsetY: 0,
            normalX: 0.5,
            normalY: 0.5
        });
    });

    addEventListener("pointerdown", event => {
        const target = event.target;

        if (target instanceof HTMLElement && target.classList.contains("panel") && target.hasAttribute("draggable")) {
            const param = params.get(target);

            param.dragging = true;
            param.offsetX = target.offsetLeft - event.pageX;
            param.offsetY = target.offsetTop - event.pageY;
        }
    });

    addEventListener("pointermove", event => {
        params.forEach((params, panel) => {
            if (params.dragging) {
                panel.style.left = (event.pageX + params.offsetX) + "px";
                panel.style.top = (event.pageY + params.offsetY) + "px";

                params.normalX = panel.offsetLeft / window.innerWidth;
                params.normalY = panel.offsetTop / window.innerHeight;
            }
        });
    });

    addEventListener("pointerup", event => {
        params.forEach(params => params.dragging = false);
    });

    window.addEventListener("resize", event => {
        params.forEach((params, panel) => {
            panel.style.left = (params.normalX * window.innerWidth) + "px";
            panel.style.top = (params.normalY * window.innerHeight) + "px";
        });
    });
}

function togglePanel(id = "", onlyOpen = false, onlyClose = false) {
    const panel = document.getElementById(id);

    if (panel instanceof Element) {
        if (onlyOpen && !panel.hidden)
            return;
        if (onlyClose && panel.hidden)
            return;

        panel.hidden = !panel.hidden;
        panel.style.left = (window.innerWidth / 2) + "px";
        panel.style.top = (window.innerHeight / 2) + "px";

        dispatchEvent(new CustomEvent(panel.hidden ? "panelclose" : "panelopen", { detail: panel }));
    }
}