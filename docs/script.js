const output = document.querySelector("#output");
const octx = output.getContext("2d");

let canvas = document.createElement("canvas");
let cctx = canvas.getContext("2d");

let buffer = document.createElement("canvas");;
let bctx = canvas.getContext("2d");

let bindLayer = -1;
let layers = [];
let optimizedLayers = {
    back: null,
    bind: null,
    front: null
};

//Optimize Layers for drawing
function optimize() {
    optimizedLayers.back = null;
    optimizedLayers.bind = null;
    optimizedLayers.front = null;

    if (bindLayer >= 0) {
        let length = layers.length;

        bctx.clearRect(0, 0, buffer.width, buffer.height);
        for (let i = 0; i < length; ++i) {
            bctx.putImageData(layers[i], 0, 0);
        }
        optimizedLayers.back = bctx.getImageData(0, 0, buffer.width, buffer.height);

        bctx.clearRect(0, 0, buffer.width, buffer.height);
        bctx.putImageData(layers[bindLayer], 0, 0);
        optimizedLayers.bind = bctx.getImageData(0, 0, buffer.width, buffer.height);

        bctx.clearRect(0, 0, buffer.width, buffer.height);
        for (let i = bindLayer; i < length; ++i) {
            bctx.putImageData(layers[i], 0, 0);
        }
        optimizedLayers.front = bctx.getImageData(0, 0, buffer.width, buffer.height);
    }
}

//Draw layers
function outputLayers() {
    optimize();

    if (optimizedLayers.back != null)
        octx.putImageData(optimizedLayers.back, 0, 0);
    if (optimizedLayers.bind != null)
        octx.putImageData(optimizedLayers.bind, 0, 0);
    if (optimizedLayers.front != null)
        octx.putImageData(optimizedLayers.front, 0, 0);
}