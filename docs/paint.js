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
    static #RADIAN = Math.PI / 180;

    #view;
    #context;
    #canvas;
    #buffer;

    #offsetX;
    #offsetY;

    #objectList;
    #bindingIndex;
    #bindingObject;

    #backgroundBuffer;
    #layersBuffer;
    #gridBuffer;

    #renderer;
    #repaint;

    constructor(view, width, height) {
        this.#view = view;
        this.#context = view.getContext("2d");
        this.#context.imageSmoothingEnabled = false;
        this.#canvas = new Canvas(width, height);
        this.#buffer = new Frame(view.width, view.height);

        this.#offsetX = view.width / 2;
        this.#offsetY = view.height / 2;

        this.#objectList = new Array();
        this.#bindingIndex = -1;
        this.#bindingObject = null;

        this.#repaint = true;

        // Background renderer
        this.#loadBackground(0, 0, 0, 0);
        this.set(0, 0, 0, 1, 0, () => this.#context.drawImage(this.#backgroundBuffer, 0, 0));

        // layer renderer
        this.#loadLayers();
        this.set(10, 0, 0, 1, 0, this.#createImageRenderer(this.#layersBuffer));

        //Grid renderer
        this.#loadGrid(255, 255, 255, 64);
        this.set(20, 0, 0, 1, 0, this.#createImageRenderer(this.#gridBuffer));
    }

    resize(width = 0, height = 0) {
        if (this.#canvas.resize(width, height)) {
            this.#loadGrid(255, 255, 255, 64);

            return true;
        }

        return false;
    }

    #bind(index = 0) {
        if (index !== this.#bindingIndex) {
            this.#bindingIndex = index;
            this.#bindingObject = this.#get(index);
        }
    }

    translate(index = 0, dx = 0, dy = 0) {
        this.#bind(index);

        this.#bindingObject.x += dx * this.#bindingObject.scale;
        this.#bindingObject.y += dy * this.#bindingObject.scale;

        this.repaint();
    }

    scale(index = 0, power = 0) {
        this.#bind(index);

        this.#bindingObject.scale *= 2 ** power;
        this.#bindingObject.scale = Math.max(2 ** -8, this.#bindingObject.scale);

        this.repaint();
    }

    rotate(index = 0, angle = 0) {
        this.#bind(index);

        this.#bindingObject.angle += angle;
        this.#bindingObject.angle %= 360;

        this.repaint();
    }

    #get(index = 0) {
        let object = this.#objectList[index];

        return object ? object : {
            x: 0,
            y: 0,
            scale: 0,
            angle: 0,
            renderer: () => {}
        };
    }

    set(index = 0, x = 0, y = 0, scale = 1, angle = 0, renderer = () => {}) {
        let object = this.#objectList[index];

        if (object) {
            object.x = x;
            object.y = y;
            object.scale = scale;
            object.angle = angle;
            object.renderer = renderer ?? object.renderer;
        } else {
            object = {
                x: x,
                y: y,
                scale: scale,
                angle: angle,
                renderer: renderer
            };
        }

        if (index >= this.#objectList.length) {
            this.#objectList[index] = object;
        } else {
            this.#objectList.splice(index, 1, object);
        }

        this.repaint();

        return object;
    }

    remove(index = 0) {
        this.#objectList.splice(index, 1);

        this.repaint();
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
        this.#objectList.forEach(object => object.renderer(object.x, object.y, object.scale, object.angle));
    }

    repaint() {
        this.#repaint = true;
    }

    get width() {
        return this.#canvas.width;
    }

    get height() {
        return this.#canvas.height;
    }

    #loadBackground(red = 0, green = 0, blue = 0, alpha = 0) {
        if (this.#backgroundBuffer)
            this.#backgroundBuffer.close();

        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);

        this.#buffer.context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
        this.#buffer.context.fillRect(0, 0, this.#buffer.width, this.#buffer.height);
        this.#backgroundBuffer = this.#buffer.canvas.transferToImageBitmap();

        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);

        this.repaint();
    }

    #loadLayers() {
        if (this.#layersBuffer)
            this.#layersBuffer.close();

        this.#layersBuffer = this.#canvas.composite();

        this.repaint();
    }

    #loadGrid(red = 0, green = 0, blue = 0, alpha = 0) {
        if (this.#gridBuffer)
            this.#gridBuffer.close();

        this.#bind(10);

        const width = 64 / this.#bindingObject.scale;
        const height = 64 / this.#bindingObject.scale;
        const columns = (this.#view.width - 1) / width;
        const rows = (this.#view.height - 1) / height;

        postMessage({
            type: "message",
            message: `グリッド（幅、高さ）＝（${width}、${height}）をロードしました！`
        });

        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);

        this.#buffer.context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
        this.#buffer.context.lineWidth = 1;
        this.#buffer.context.beginPath();
        this.#buffer.translate(0.5, 0.5);

        for (let j = 0; j <= columns; ++j) {
            for (let i = 0; i <= rows; ++i) {
                this.#buffer.context.moveTo((i + 1) * width - 1, j * height);
                this.#buffer.context.lineTo(i * width, j * height);
                this.#buffer.context.lineTo(i * width, (j + 1) * height - 1);
            }
        }

        this.#buffer.context.moveTo(0, this.#view.height - 1);
        this.#buffer.context.lineTo(this.#view.width - 1, this.#view.height - 1);
        this.#buffer.context.lineTo(this.#view.width - 1, 0);
        this.#buffer.context.stroke();
        this.#buffer.context.resetTransform();

        this.#gridBuffer = this.#buffer.canvas.transferToImageBitmap();

        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);

        this.repaint();
    }

    #createImageRenderer(image) {
        return (x, y, scale, angle) => {
            this.#context.translate(this.#offsetX, this.#offsetY);
            this.#context.rotate(angle * Paint.#RADIAN);
            this.#context.scale(scale, scale);
            this.#context.translate(x - this.#offsetX, y - this.#offsetY);
            this.#context.drawImage(image, 0, 0);
            this.#context.resetTransform();
        }
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
            if (event.data.index instanceof Array) {
                event.data.index.forEach(index => paint.translate(index, event.data.dx, event.data.dy));
            } else {
                paint.translate(event.data.index, event.data.dx, event.data.dy);
            }

            break;
        case "scale":
            if (event.data.index instanceof Array) {
                event.data.index.forEach(index => paint.scale(index, event.data.power));
            } else {
                paint.scale(event.data.index, event.data.power);
            }

            break;
        case "ratote":
            if (event.data.index instanceof Array) {
                event.data.index.forEach(index => paint.rotate(index, event.data.angle));
            } else {
                paint.rotate(event.data.index, event.data.angle);
            }

            break;
        default:
            break;
    }
}