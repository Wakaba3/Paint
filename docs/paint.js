class Layer {
    constructor(name = "", blendMode = "source-over", imageData = null) {
        this.name = name;
        this.blendMode = blendMode;
        this.imageData = imageData;
    }

    copy() {
        return new Layer(this.name, this.blendMode, this.imageData);
    }
}

class LayerList {
    constructor(name = "", start = -1, length = 0) {
        this.name = name;
        this.start = start;
        this.length = length;
    }

    copy() {
        return new LayerList(this.name, this.start, this.length);
    }
}

class Frame {
    constructor(width = 0, height = 0) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            postMessage({
                type: "error",
                error: `Invalid size: (width, height) = (${width}, ${height})`
            });
        }

        this.canvas = new OffscreenCanvas(width, height);
        this.context = this.canvas.getContext("2d", { willReadFrequently : true });
        this.context.imageSmoothingEnabled = false;
    }

    resize(width = 0, height = 0) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || this.canvas.width === width && this.canvas.height === height)
            return false;

        this.canvas.width = width;
        this.canvas.height = height;

        return true;
    }

    get width() {
        return this.canvas.width;
    }

    get height() {
        return this.canvas.height;
    }
}

class Canvas {
    #canvas;
    #buffer;

    #layers;
    #lists;
    #records;

    #bindingIndex;
    #bindingLayer;
    #bindingRecord;

    constructor(width = 0, height = 0) {
        this.#canvas = new Frame(width, height);
        this.#buffer = new Frame(width, height);

        this.#layers = [];
        this.#lists = [];
        this.#records = [];

        this.bind();

        this.save();
    }

    decode(object) {
        this.resize(object.width, object.height);
        
        if (object.layers instanceof Array)
            this.#layers = object.layers;

        if (object.lists instanceof Array)
            this.#lists = object.lists;
    }

    encode() {
        return {
            width: this.width,
            height: this.height,
            layers: this.#layers.map(layer => layer.copy()),
            lists: this.#lists.map(list => list.copy())
        };
    }

    #load() {
        this.decode(this.#records[this.#bindingRecord]);
        this.bind(this.#bindingLayer);
    }

    save() {
        this.#bindingRecord = this.#bindingRecord ? ++this.#bindingRecord : this.#records.length;

        this.#records.splice(this.#bindingRecord, 0, this.encode());
        this.#records.length = this.#bindingRecord + 1;
        
        if (this.#records.length > 256) {
            this.#records.shift();
        }
    }

    undo() {
        if (this.#bindingRecord > 0) {
            --this.#bindingRecord;
            this.#load();
        }
    }

    redo() {
        if (this.#bindingRecord < this.#records.length - 1) {
            ++this.#bindingRecord;
            this.#load();
        }
    }

    resize(width = 0, height = 0) {
        return this.#canvas.resize(width, height) && this.#buffer.resize(width, height);
    }

    apply() {
        if (this.#bindingLayer) {
            this.#bindingLayer.imageData = this.context.getImageData(0, 0, this.width, this.height);
        }
    }

    bind(index = -1) {
        this.context.clearRect(0, 0, this.width, this.height);

        if (0 <= index && index < this.#layers.length) {
            this.#bindingIndex = index;
            this.#bindingLayer = this.#layers[index];
        } else {
            this.#bindingIndex = -1;
            this.#bindingLayer = null;
        }

        if (this.#bindingLayer) {
            this.context.putImageData(this.#bindingLayer.imageData, 0, 0);
        }
    }

    composite() {
        const context = this.context;
        const buffer = this.#buffer.context;
        const image = this.#buffer.canvas;
        const width = this.width;
        const height = this.height;

        context.clearRect(0, 0, width, height);
        buffer.clearRect(0, 0, width, height);

        this.#layers.forEach(layer => {
            buffer.putImageData(layer.imageData, 0, 0);

            context.globalCompositeOperation = layer.blendMode;
            context.drawImage(image, 0, 0);

            buffer.clearRect(0, 0, width, height);
        });

        return this.#canvas.canvas.transferToImageBitmap();
    }

    addLayer(name = "", blendMode = "source-over") {
        return this.addLayerAt(this.#bindingIndex + 1, name, blendMode);
    }

    addLayerAt(index = -1, name = "", blendMode = "source-over") {
        if (index < 0 || index > this.#layers.length)
            return -1;

        this.#layers.splice(index, 0, new Layer(name, blendMode, this.context.createImageData(this.width, this.height)));
        this.#shiftListIndexes(index, 1)

        return index;
    }

    removeLayer() {
        return this.removeLayerAt(this.#bindingIndex);
    }

    removeLayerAt(index = -1) {
        if (index < 0 || index >= this.#layers.length)
            return -1;

        this.#layers.splice(index, 1);
        this.#shiftListIndexes(index, -1);

        return index;
    }

    addList(name = "", start = -1, length = 0) {
        this.#lists.push(new LayerList(name, start, length));

        return true;
    }

    #shiftListIndexes(start = -1, dir = 0) {
        dir = Math.sign(dir);

        this.#lists.forEach(list => {
            if (start >= list.start) {
                if (start < list.start + list.length) {
                    list.length += dir;
                }
            } else {
                list.start += dir;
            }
        });
    }

    get context() {
        return this.#canvas.context;
    }

    get width() {
        return this.#canvas.width;
    }

    get height() {
        return this.#canvas.height;
    }
}

class Paint {
    static INSTANCE;

    static #MIN_SCALE = 2 ** -3;
    static #MAX_SCALE = 2 ** 6;
    static #RADIAN = Math.PI / 180;

    #view;
    #context;
    #canvas;

    #objects;
    #functions;
    #bindingIndex;
    #bindingObject;

    #buffers;

    #renderer;
    #repaint;

    constructor(view = null, width = 0, height = 0) {
        this.#view = view;
        this.#context = view.getContext("2d");
        this.#context.imageSmoothingEnabled = false;
        this.#canvas = new Canvas(width, height);

        this.#objects = new Array();
        this.#functions = new Map();
        this.#bindingIndex = -1;
        this.#bindingObject = null;

        this.#buffers = new Map();

        // Background renderer
        this.setObject(0, 0, 0, this.#view.width, this.#view.height, 1, 0, () => (context, x, y, width, height, scale, angle) => {
            context.fillStyle = "rgba(0, 0, 0, 0)";
            context.fillRect(0, 0, width, height);
        });

        // Canvas renderer
        this.setObject(10, 0, 0, this.width, this.height, 1, 0, (context, x, y, width, height, scale, angle) => {
            context.translate(this.#view.width / 2, this.#view.height / 2);
            context.scale(scale, scale);
            context.translate(x + (width - this.#view.width) / 2, y + (height - this.#view.height) / 2);
            context.rotate(angle * Paint.#RADIAN);
            context.translate(width / -2, height / -2);
            context.drawImage(this.#registerBuffer("canvas", this.#canvas.composite()), 0, 0);
            context.resetTransform();
        });

        // Grid renderer
        this.setObject(20, 0, 0, this.width, this.height, 1, 0, (context, x, y, width, height, scale, angle) => {
            postMessage({
                type: "message",
                message: `グリッドを描画（幅、高さ）＝（${width}、 ${height}）`
            });

            width *= scale;
            height *= scale;

            const columns = width / Paint.#MAX_SCALE;
            const rows = height / Paint.#MAX_SCALE;

            context.strokeStyle = "rgba(255, 255, 255, 0.25)";
            context.lineWidth = 1;
            context.translate(this.#view.width / 2 + (x - this.#view.width / 2) * scale + width / 2, this.#view.height / 2 + (y - this.#view.height / 2) * scale + height / 2);
            context.rotate(angle * Paint.#RADIAN);
            context.translate(width / -2, height / -2);
            context.beginPath();

            for (let i = 1; i < columns; ++i) {
                if ((i & 7) === 0) {
                    context.stroke();
                    context.strokeStyle = "rgba(192, 192, 192, 1)";
                    context.beginPath();

                    context.moveTo(i * Paint.#MAX_SCALE, 0);
                    context.lineTo(i * Paint.#MAX_SCALE, height - 1);

                    context.stroke();

                    context.strokeStyle = "rgba(255, 255, 255, 0.25)";
                    context.beginPath();
                } else {
                    context.moveTo(i * Paint.#MAX_SCALE, 0);
                    context.lineTo(i * Paint.#MAX_SCALE, height - 1);
                }
            }

            for (let i = 1; i < rows; ++i) {
                if ((i & 7) === 0) {
                    context.stroke();
                    context.strokeStyle = "rgba(192, 192, 192, 1)";
                    context.beginPath();

                    context.moveTo(0, i * Paint.#MAX_SCALE);
                    context.lineTo(width - 1, i * Paint.#MAX_SCALE);

                    context.stroke();
                    context.strokeStyle = "rgba(255, 255, 255, 0.25)";
                    context.beginPath();
                } else {
                    context.moveTo(0, i * Paint.#MAX_SCALE);
                    context.lineTo(width - 1, i * Paint.#MAX_SCALE);
                }
            }

            context.stroke();
            context.beginPath();
            context.strokeStyle = "rgba(192, 192, 192, 1)";
            context.rect(0, 0, width - 1, height - 1);
            context.stroke();
            context.resetTransform();
        });

        // Cross renderer
        this.setObject(30, this.#view.width / 2, this.#view.height / 2, 0, 0, 1, 0, (context, x, y) => {
            context.strokeStyle = "rgba(192, 192, 192, 1)";
            context.beginPath();
            context.moveTo(x + 8, y);
            context.lineTo(x - 8, y);
            context.moveTo(x, y - 8);
            context.lineTo(x, y + 8);
            context.stroke();
        });

        this.addFunction("grid-setup", () => {
            this.resizeObject(10, this.width, this.height);
            this.imitateObject(10, 20);
        });

        this.addFunction("cross-setup", () => {
            this.locateObject(30, this.#view.width / 2, this.#view.height / 2);
        });

        this.repaint();
        this.run();
    }

    resize(width = 0, height = 0) {
        if (this.#canvas.resize(width, height)) {
            this.repaint();

            return true;
        }

        return false;
    }

    run() {
        this.stop();

        this.#renderer = setInterval(() => {
            if (this.#repaint) {
                this.#render();

                this.#repaint = false;
            }
        }, 1000 / 30);
    }

    stop() {
        if (Number.isFinite(this.#renderer)) {
            clearInterval(this.#renderer);
        }
    }

    #render() {
        this.#context.clearRect(0, 0, this.#view.width, this.#view.height);
        this.#functions.forEach(execution => execution());
        this.#objects.forEach(object => object.renderer(this.#context, object.x, object.y, object.width, object.height, object.scale, object.angle));
    }

    repaint() {
        this.#repaint = true;

        this.#bindObject(10);

        postMessage({
            type: "repaint",
            x: this.#bindingObject.x,
            y: this.#bindingObject.y,
            width: this.#bindingObject.width,
            height: this.#bindingObject.height,
            scale: this.#bindingObject.scale,
            angle: this.#bindingObject.angle,
        });
    }

    #bindObject(index = 0) {
        if (index !== this.#bindingIndex) {
            this.#bindingIndex = index;
            this.#bindingObject = this.#getObject(index);
        }
    }

    locateObject(index = 0, x = 0, y = 0) {
        this.#bindObject(index);

        this.#bindingObject.x = x;
        this.#bindingObject.y = y;

        this.repaint();
    }

    translateObject(index = 0, dx = 0, dy = 0) {
        this.#bindObject(index);

        this.#bindingObject.x += Number.isFinite(dx) ? dx * Math.max(1, Paint.#MAX_SCALE / this.#bindingObject.scale) : 0;
        this.#bindingObject.y += Number.isFinite(dy) ? dy * Math.max(1, Paint.#MAX_SCALE / this.#bindingObject.scale) : 0;

        this.repaint();
    }

    resizeObject(index = 0, width = 0, height = 0) {
        this.#bindObject(index);

        this.#bindingObject.width = Number.isFinite(width) ? width : 0;
        this.#bindingObject.height = Number.isFinite(height) ? height : 0;

        this.repaint();
    }

    scaleObject(index = 0, dScale = 0) {
        this.#bindObject(index);

        this.#bindingObject.scale *= Number.isFinite(dScale) ? dScale : 1;
        this.#bindingObject.scale = Math.min(Paint.#MAX_SCALE, Math.max(this.#bindingObject.scale, Paint.#MIN_SCALE));

        this.repaint();
    }

    rotateObject(index = 0, dAngle = 0) {
        this.#bindObject(index);

        this.#bindingObject.angle -= Number.isFinite(dAngle) ? dAngle : 0;
        this.#bindingObject.angle %= 360;

        this.repaint();
    }

    imitateObject(sourceIndex = 0, targetIndex = 0) {
        this.#bindObject(sourceIndex);

        const targetObject = this.#getObject(targetIndex);

        targetObject.x = this.#bindingObject.x;
        targetObject.y = this.#bindingObject.y;
        targetObject.width = this.#bindingObject.width;
        targetObject.height = this.#bindingObject.height;
        targetObject.scale = this.#bindingObject.scale;
        targetObject.angle = this.#bindingObject.angle;

        this.repaint();
    }

    #getObject(index = 0) {
        let object = this.#objects[index];

        return object ? object : this.createObject();
    }

    createObject(x = 0, y = 0, width = 0, height = 0, scale = 0, angle = 0, renderer = () => {}) {
        return {
            x: x,
            y: y,
            width: width,
            height: height,
            scale: scale,
            angle: angle,
            renderer: renderer
        };
    }

    setObject(index = 0, x, y, width, height, scale, angle, renderer) {
        let object = this.#objects[index];

        if (object) {
            object.x = Number.isFinite(x) ? x : object.x;
            object.y = Number.isFinite(y) ? y : object.y;
            object.width = Number.isFinite(width) ? width : object.width;
            object.height = Number.isFinite(height) ? height : object.height;
            object.scale = Number.isFinite(scale) ? scale : object.scale;
            object.angle = Number.isFinite(angle) ? angle : object.angle;
            object.renderer = renderer instanceof Function ? renderer : object.renderer;
        } else {
            object = this.createObject(x, y, width, height, scale, angle, renderer);
        }

        if (index >= this.#objects.length) {
            this.#objects[index] = object;
        } else {
            this.#objects.splice(index, 1, object);
        }

        this.repaint();

        return object;
    }

    removeObject(index = 0) {
        this.#objects.splice(index, 1, this.createObject());

        this.repaint();
    }

    addFunction(name = "", execution = () => {}) {
        this.#functions.set(name, execution);
    }

    removeFunction(name = "") {
        this.#functions.delete(name);
    }

    #registerBuffer(name = "", image = null) {
        if (image) {
            this.#closeBuffer(name);

            this.#buffers.set(name, image);
        }

        return image;
    }

    #closeBuffer(name = "") {
        const image = this.#buffers.get(name);

        if (image) {
            if (image instanceof ImageBitmap) {
                image.close();
            }

            this.#buffers.delete(name);
        }
    }

    get width() {
        return this.#canvas.width;
    }

    get height() {
        return this.#canvas.height;
    }
}

onmessage = event => {
    switch (event.data.type) {
        case "init":
            Paint.INSTANCE = new Paint(event.data.view, event.data.width, event.data.height);

            if (Paint.INSTANCE instanceof Paint) {
                postMessage({
                    type: "init",
                    width: Paint.INSTANCE.width,
                    height: Paint.INSTANCE.height,
                    successful: true
                });
            } else {
                postMessage({
                    type: "error",
                    error: "ペイントを初期化できませんでした！"
                });
            }

            return;
        case "resize":
            const successful = Paint.INSTANCE.resize(event.data.width, event.data.height)

            postMessage({
                type: "resize",
                width: Paint.INSTANCE.width,
                height: Paint.INSTANCE.height,
                successful: successful
            });

            return;
        case "translate":
            Paint.INSTANCE.translateObject(event.data.index, event.data.dx, event.data.dy);

            return;
        case "scale":
            Paint.INSTANCE.scaleObject(event.data.index, event.data.dScale);

            return;
        case "rotate":
            Paint.INSTANCE.rotateObject(event.data.index, event.data.dAngle);

            return;
        case "set":
            Paint.INSTANCE.setObject(event.data.index, event.data.x, event.data.y, event.data.width, event.data.height, event.data.scale, event.data.angle);

            return;
        default:
            return;
    }
}