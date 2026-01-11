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
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
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
        this.#buffer = new Frame(0, 0);

        this.#layers = [];
        this.#lists = [];
        this.#records = [];

        this.bind();

        this.save();
    }

    decode(object) {
        this.resize(object.width, object.height);
        
        if (object.layers instanceof Array)
            this.#layers = object.layers.map(layer => layer.copy());

        if (object.lists instanceof Array)
            this.#lists = object.lists.map(list => list.copy());

        this.bind(object.binding);
    }

    encode() {
        return {
            width: this.width,
            height: this.height,
            binding: this.#bindingIndex,
            layers: this.#layers.map(layer => layer.copy()),
            lists: this.#lists.map(list => list.copy())
        };
    }

    #load() {
        this.decode(this.#records[this.#bindingRecord]);
    }

    save() {
        this.#bindingRecord = Number.isFinite(this.#bindingRecord) && this.#bindingRecord >= 0 ? this.#bindingRecord + 1 : 0;
        this.#bindingRecord = Math.max(0, this.#bindingRecord);

        this.#records.splice(this.#bindingRecord, Infinity, this.encode());
        
        if (this.#records.length > 256) {
            --this.#bindingRecord;
            this.#records.shift();
        }
    }

    undo() {
        if (this.#bindingRecord > 0) {
            --this.#bindingRecord;
            this.#load();

            return true;
        }

        return false;
    }

    redo() {
        if (this.#bindingRecord < this.#records.length - 1) {
            ++this.#bindingRecord;
            this.#load();

            return true;
        }

        return false;
    }

    resize(width = 0, height = 0) {
        return this.#canvas.resize(width, height);
    }

    apply() {
        if (this.#bindingLayer) {
            this.#bindingLayer.imageData = this.#canvas.context.getImageData(0, 0, this.width, this.height);
        }
    }

    bind(index = -1) {
        this.#canvas.context.clearRect(0, 0, this.width, this.height);

        if (0 <= index && index < this.#layers.length) {
            this.#bindingIndex = index;
            this.#bindingLayer = this.#layers[index];
        } else {
            this.#bindingIndex = -1;
            this.#bindingLayer = null;

            return false;
        }

        if (this.#bindingLayer) {
            this.#canvas.context.putImageData(this.#bindingLayer.imageData, 0, 0);
        }

        return true;
    }

    draw(index = -1, renderer = () => {}) {
        if (this.bind(index)) {
            renderer(this.#canvas.context);
            this.apply();
        }
    }

    upload(index) {
        if (!Number.isFinite(index))
            index = this.#bindingIndex;

        if (0 <= index && index < this.#layers.length) {
            const layer = this.#layers[index];

            if (layer instanceof Layer) {
                const imageData = layer.imageData;
                const context = this.#buffer.context;

                context.canvas.width = imageData.width;
                context.canvas.height = imageData.height

                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
                context.putImageData(imageData, 0, 0);

                context.canvas.transferToImageBitmap().then(image => {
                    postMessage({
                        type: "upload",
                        content: {
                            index: index,
                            name: layer.name,
                            blendMode: layer.blendMode,
                            image: image
                        }
                    });
                });
            }
        }

        return null;
    }

    composite(target = null, x = 0, y = 0) {
        if (target instanceof OffscreenCanvasRenderingContext2D) {
            const context = this.#canvas.context;
            const buffer = this.#buffer.context;
            const width = this.width;
            const height = this.height;

            context.clearRect(0, 0, width, height);

            this.#layers.forEach(layer => {
                if (layer.imageData instanceof ImageData) {
                    buffer.canvas.width = layer.imageData.width;
                    buffer.canvas.height = layer.imageData.height;

                    buffer.clearRect(0, 0, buffer.canvas.width, buffer.canvas.height);
                    buffer.putImageData(layer.imageData, 0, 0);

                    context.globalCompositeOperation = layer.blendMode;
                    context.drawImage(buffer.canvas, 0, 0);
                }
            });

            target.drawImage(context.canvas, x, y);
        }
    }

    addLayer(name = "", blendMode = "source-over", imageData = new ImageData(this.width, this.height)) {
        return this.addLayerAt(this.#bindingIndex + 1, name, blendMode, imageData);
    }

    addLayerAt(index = -1, name = "", blendMode = "source-over", imageData = new ImageData(this.width, this.height)) {
        if (index < 0 || index > this.#layers.length)
            return -1;

        this.#layers.splice(index, 0, new Layer(name, blendMode, imageData));
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

    get width() {
        return this.#canvas.width;
    }

    get height() {
        return this.#canvas.height;
    }

    get info() {
        return {
            canUndo: this.#bindingRecord > 0,
            canRedo: this.#bindingRecord < this.#records.length - 1,
        };
    }
}

class Paint {
    static INSTANCE;

    static #MIN_SCALE = 2 ** -3;
    static #MAX_SCALE = 2 ** 6;
    static #RADIAN = Math.PI / 180;

    #view;
    #context;
    #buffer;
    #canvas;
    #preferences;

    #objects;
    #functions;
    #bindingIndex;
    #bindingObject;

    #renderer;
    #repaint;

    constructor(view = null, width = 0, height = 0) {
        this.#view = view;
        this.#context = view.getContext("2d");
        this.#context.imageSmoothingEnabled = false;
        this.#buffer = new Frame(0, 0);
        this.#canvas = new Canvas(width, height);

        this.#objects = new Array();
        this.#functions = new Map();
        this.#bindingIndex = -1;
        this.#bindingObject = null;

        this.#repaint = 0;

        this.setPreferences();

        // Background renderer
        this.setObject(0, 0, 0, this.#view.width, this.#view.height, 1, 0, () => (context, x, y, width, height, scale, angle) => {
            context.fillStyle = this.#preferences.backgroundColor;
            context.fillRect(0, 0, width, height);
        });

        // Canvas renderer
        this.setObject(10, 0, 0, this.width, this.height, 1, 0, (context, x, y, width, height, scale, angle) => {
            context.translate(this.#view.width / 2, this.#view.height / 2);
            context.scale(scale, scale);
            context.translate(x + (width - this.#view.width) / 2, y + (height - this.#view.height) / 2);
            context.rotate(angle * Paint.#RADIAN);
            context.translate(width / -2, height / -2);
            this.#canvas.composite(context);
            context.resetTransform();
        });

        // Grid renderer
        this.setObject(20, 0, 0, this.width, this.height, 1, 0, (context, x, y, width, height, scale, angle) => {
            if (!this.#preferences.displayGrid)
                return;

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

        // Functions
        this.addFunction("grid-setup", () => {
            this.resizeObject(10, this.width, this.height);
            this.imitateObject(10, 20);
        });

        this.addFunction("cross-setup", () => {
            this.locateObject(30, this.#view.width / 2, this.#view.height / 2);
        });
    }

    save() {
        this.#canvas.save();
    }

    undo() {
        return this.#canvas.undo();
    }

    redo() {
        return this.#canvas.redo();
    }

    run() {
        this.stop();
        this.repaint(2);

        this.#renderer = setInterval(() => {
            if (this.#repaint > 0) {
                this.#render();

                --this.#repaint;
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

    repaint(attempts = 1) {
        this.#repaint = Math.max(this.#repaint, attempts);
        this.#repaint = Number.isFinite(this.#repaint) ? this.#repaint : 1;

        this.#bindObject(10);
        
        const info = this.#canvas.info;

        postMessage({
            type: "info",
            x: this.#bindingObject.x,
            y: this.#bindingObject.y,
            width: this.#bindingObject.width,
            height: this.#bindingObject.height,
            scale: this.#bindingObject.scale,
            angle: this.#bindingObject.angle,

            backgroundColor: this.#preferences.backgroundColor,
            displayGrid: this.#preferences.displayGrid,

            canRedo: info.canRedo,
            canUndo: info.canUndo,
            canZoomIn: this.#bindingObject.scale < Paint.#MAX_SCALE,
            canZoomOut: this.#bindingObject.scale > Paint.#MIN_SCALE
        });
    }

    resize(width = 0, height = 0) {
        if (this.#canvas.resize(width, height)) {
            this.repaint();

            return true;
        }

        return false;
    }

    import(data) {
        if (!(data instanceof Array))
            return;

        const context = this.#buffer.context;

        data.forEach(element => {
            element = Object.assign({
                name: "",
                content: null
            }, element);

            if (element.content instanceof ImageBitmap) {
                context.canvas.width = element.content.width;
                context.canvas.height = element.content.height;

                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
                context.drawImage(element.content, 0, 0);

                element.content.close();

                this.#canvas.bind(this.#canvas.addLayer(element.name, "source-over", context.getImageData(0, 0, context.canvas.width, context.canvas.height)));
            } else if (element.content instanceof ImageData) {
                this.#canvas.bind(this.#canvas.addLayer(element.name, "source-over", element.content));
            }
        });
    }

    upload(index) {
        this.#canvas.upload(index);
    }

    #bindObject(index = 0) {
        if (index !== this.#bindingIndex) {
            this.#bindingIndex = index;
            this.#bindingObject = this.#getObject(index);
        }
    }

    centerObject(index = 0) {
        this.#bindObject(index);

        this.#bindingObject.x = this.#view.width / 2 - this.#bindingObject.width / 2;
        this.#bindingObject.y = this.#view.height / 2 - this.#bindingObject.height / 2;

        this.repaint();
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

    #createPreferences() {
        return {
            backgroundColor: "rgba(0, 0, 0, 0)",
            displayGrid: true
        };
    }

    setPreferences(preferences = this.#createPreferences()) {
        this.#preferences = Object.assign(this.#preferences ?? {}, preferences);

        this.repaint();
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
            Paint.INSTANCE.run();

            if (!(Paint.INSTANCE instanceof Paint)) {
                postMessage({
                    type: "error",
                    error: "ペイントを初期化できませんでした！"
                });
            }

            break;
        case "import":
            Paint.INSTANCE.import(event.data.contents);
            Paint.INSTANCE.save();
            Paint.INSTANCE.repaint();

            break;
        case "resize":
            const successful = Paint.INSTANCE.resize(event.data.width, event.data.height);

            if (successful)
                Paint.INSTANCE.save();

            postMessage({
                type: "resize",
                width: Paint.INSTANCE.width,
                height: Paint.INSTANCE.height,
                successful: successful
            });

            break;
        case "center":
            Paint.INSTANCE.centerObject(event.data.index);

            break;
        case "translate":
            Paint.INSTANCE.translateObject(event.data.index, event.data.dx, event.data.dy);

            break;
        case "scale":
            Paint.INSTANCE.scaleObject(event.data.index, event.data.dScale);

            break;
        case "rotate":
            Paint.INSTANCE.rotateObject(event.data.index, event.data.dAngle);

            break;
        case "set":
            Paint.INSTANCE.setObject(event.data.index, event.data.x, event.data.y, event.data.width, event.data.height, event.data.scale, event.data.angle);

            break;
        case "undo":
            if (Paint.INSTANCE.undo()) {
                Paint.INSTANCE.repaint();

                postMessage({
                    type: "message",
                    message: "操作を元に戻しました"
                });
            }

            break;
        case "redo":
            if (Paint.INSTANCE.redo()) {
                Paint.INSTANCE.repaint();

                postMessage({
                    type: "message",
                    message: "操作をやり直しました"
                });
            }

            break;
        case "preferences":
            Paint.INSTANCE.setPreferences(event.data.preferences);

            break;
        case "upload":
            Paint.INSTANCE.upload(event.data.index);
        case "repaint":
            Paint.INSTANCE.repaint();

            break;
        default:
            break;
    }
}