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
    static #MIN_SCALE = 2 ** -3;
    static #MAX_SCALE = 2 ** 6;
    static #RADIAN = Math.PI / 180;

    #view;
    #context;
    #buffer;
    #canvas;

    #offsetX;
    #offsetY;
    #backgroundColor;

    #objects;
    #modifiers;
    #bindingIndex;
    #bindingObject;

    #buffers;

    #renderer;
    #repaint;

    constructor(view = null, width = 0, height = 0) {
        this.#view = view;
        this.#context = view.getContext("2d");
        this.#context.imageSmoothingEnabled = false;
        this.#buffer = new Frame(view.width, view.height);
        this.#canvas = new Canvas(width, height);

        this.#offsetX = view.width / 2;
        this.#offsetY = view.height / 2;

        this.#objects = new Array();
        this.#modifiers = new Map();
        this.#bindingIndex = -1;
        this.#bindingObject = null;

        this.#buffers = new Map();
        this.#repaint = true;

        // Background renderer
        this.setObject(0, 0, 0, 1, 0, () => (x, y, scale, angle) => {
            this.#context.fillStyle = "rgba(0, 0, 0, 0)";
            this.#context.fillRect(0, 0, this.#view.width, this.#view.height);
        });

        // layer renderer
        this.setObject(10, 0, 0, 1, 0, (x, y, scale, angle) => {
            this.#context.translate(this.#offsetX, this.#offsetY);
            this.#context.rotate(angle * Paint.#RADIAN);
            this.#context.scale(scale, scale);
            this.#context.translate(x - this.#offsetX, y - this.#offsetY);
            this.#context.drawImage(this.#registerBuffer("layers", this.#canvas.composite()), 0, 0);
            this.#context.resetTransform();
        });

        //Grid renderer
        this.setObject(20, 0, 0, 1, 0, (x, y, scale, angle) => {
            this.#context.translate(this.#offsetX, this.#offsetY);
            this.#context.rotate(angle * Paint.#RADIAN);
            this.#context.scale(scale, scale);
            this.#context.translate(x - this.#offsetX + 0.5, y - this.#offsetY + 0.5);

            this.#bindObject(10);

            const width = this.width * this.#bindingObject.scale - 1;
            const height = this.height * this.#bindingObject.scale - 1;
            const columns = width / Paint.#MAX_SCALE;
            const rows = height / Paint.#MAX_SCALE;

            this.#context.strokeStyle = "rgba(255, 255, 255, 0.25)";
            this.#context.lineWidth = 1;
            this.#context.beginPath();
            
            for (let i = 0; i < columns; ++i) {
                this.#context.moveTo(i * Paint.#MAX_SCALE, 0);
                this.#context.lineTo(i * Paint.#MAX_SCALE, height);
            }

            for (let i = 0; i < rows; ++i) {
                this.#context.moveTo(0, i * Paint.#MAX_SCALE);
                this.#context.lineTo(width, i * Paint.#MAX_SCALE);
            }

            this.#context.stroke();
            this.#context.resetTransform();

            postMessage({
                type: "message",
                message: "グリッドがレンダリングされました！"
            });
        });

        this.addModifier(() => {
            this.imitateObject(10, 20);
        });
    }

    resize(width = 0, height = 0) {
        return this.#canvas.resize(width, height);
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
        this.#modifiers.forEach(modifier => modifier());
        this.#objects.forEach(object => object.renderer(object.x, object.y, object.scale, object.angle));
    }

    repaint() {
        this.#repaint = true;
    }

    #bindObject(index = 0) {
        if (index !== this.#bindingIndex) {
            this.#bindingIndex = index;
            this.#bindingObject = this.#getObject(index);
        }
    }

    translateObject(index = 0, dx = 0, dy = 0) {
        this.#bindObject(index);

        this.#bindingObject.x += dx * this.#bindingObject.scale;
        this.#bindingObject.y += dy * this.#bindingObject.scale;

        this.repaint();
    }

    scaleObject(index = 0, scale = 0) {
        this.#bindObject(index);

        this.#bindingObject.scale *= scale;
        this.#bindingObject.scale = Math.min(Paint.#MAX_SCALE, Math.max(this.#bindingObject.scale, Paint.#MIN_SCALE));

        this.repaint();
    }

    rotateObject(index = 0, angle = 0) {
        this.#bindObject(index);

        this.#bindingObject.angle += angle;
        this.#bindingObject.angle %= 360;

        this.repaint();
    }

    imitateObject(sourceIndex = 0, targetIndex = 0) {
        this.#bindObject(sourceIndex);

        const targetObject = this.#getObject(targetIndex);

        targetObject.x = this.#bindingObject.x;
        targetObject.y = this.#bindingObject.y;
        targetObject.scale = this.#bindingObject.scale;
        targetObject.angle = this.#bindingObject.angle;

        this.repaint();
    }

    #getObject(index = 0) {
        let object = this.#objects[index];

        return object ? object : this.createObject();
    }

    createObject(x = 0, y = 0, scale = 0, angle = 0, renderer = () => {}) {
        return {
            x: x,
            y: y,
            scale: scale,
            angle: angle,
            renderer: renderer
        };
    }

    setObject(index = 0, x = 0, y = 0, scale = 1, angle = 0, renderer = () => {}) {
        let object = this.#objects[index];

        if (object) {
            object.x = x;
            object.y = y;
            object.scale = scale;
            object.angle = angle;
            object.renderer = renderer;
        } else {
            object = this.createObject(x, y, scale, angle);
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
        this.#objects.splice(index, 1);

        this.repaint();
    }

    addModifier(name = "", modifier = () => {}) {
        this.#modifiers.set(name, modifier);
    }

    removeModifier(name = "") {
        this.#modifiers.delete(name);
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

let paint = null;

onmessage = event => {
    event.data.type = String(event.data.type);

    if (event.data.type === "init") {
        paint = new Paint(event.data.view, event.data.width, event.data.height);
        paint.run();

        postMessage({
            type: "init",
            width: paint.width,
            height: paint.height,
            successful: paint instanceof Paint
        });
    } else if (!paint) {
        postMessage({
            type: "error",
            error: "Paint is not initialized!"
        });

        return;
    }

    switch (event.data.type) {
        case "init":
            paint = new Paint(event.data.view, event.data.width, event.data.height);
            paint.run();

            postMessage({
                type: "init",
                width: paint.width,
                height: paint.height,
                successful: paint instanceof Paint
            });

            break;
        case "resize":
            const successful = paint.resize(event.data.width, event.data.height)

            postMessage({
                type: "resize",
                width: paint.width,
                height: paint.height,
                successful: successful
            });

            break;
        case "translate":
            paint.translateObject(event.data.index, event.data.dx, event.data.dy);

            break;
        case "scale":
            paint.scaleObject(event.data.index, event.data.dScale);

            break;
        case "ratote":
            paint.rotateObject(event.data.index, event.data.dAngle);

            break;
        default:
            break;
    }
}