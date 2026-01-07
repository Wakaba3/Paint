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

    #objectList;
    #bindingIndex;
    #bindingObject;

    #background;
    #layers;
    #grid;

    #renderer;
    #repaint;

    constructor(view, width, height) {
        this.#view = view;
        this.#context = view.getContext("2d");
        this.#canvas = new Canvas(width, height);
        this.#buffer = new Frame(view.width, view.height);

        this.#objectList = new Array();
        this.#bindingIndex = -1;
        this.#bindingObject = null;

        this.#repaint = true;

        this.setBackground(64, 0, 0, 255);
        this.setLayers();
        this.setGrid(64, 64, 128, 128, 128, 255);

        // Background renderer
        this.set(0, 0, 0, 1, 0, () => this.#context.drawImage(this.#background, 0, 0));

        // Canvas renderer
        this.set(1, 0, 0, 1, 0, (x, y, scale, angle) => {
            this.#context.translate(-this.#view.width / 2, -this.#view.height / 2);
            this.#context.rotate(angle * Paint.#RADIAN);
            this.#context.scale(scale, scale);
            this.#context.translate(x, y);
            this.#context.drawImage(this.#layers, 0, 0);
            this.#context.resetTransform();
        });

        //Grid renderer
        this.set(2, 0, 0, 1, 0, () => {
            this.#context.translate(-this.#view.width / 2, -this.#view.height / 2);
            this.#context.rotate(angle * Paint.#RADIAN);
            this.#context.scale(scale, scale);
            this.#context.translate(x, y);
            this.#context.drawImage(this.#grid, 0, 0);
            this.#context.resetTransform();
        });
    }

    #bind(index = 0) {
        if (index !== this.#bindingIndex) {
            this.#bindingIndex = index;
            this.#bindingObject = this.#objectList[index];
        }
    }

    move(index = 0, dx = 0, dy = 0) {
        this.#bind(index);

        this.#bindingObject.x1 += dx;
        this.#bindingObject.y1 += dy;

        this.repaint();
    }

    scale(index = 0, dScale = 0) {
        this.#bind(index);

        this.#bindingObject.scale1 *= 2 ** dScale;

        this.repaint();
    }

    angle(index = 0, dAngle = 0) {
        this.#bind(index);

        this.#bindingObject.angle1 += dAngle;
        this.#bindingObject.angle1 %= 360;

        this.repaint();
    }

    set(index = 0, x = 0, y = 0, scale = 1, angle = 0, renderer = null) {
        if (renderer instanceof Function) {
            let object = this.#objectList[index];

            if (object) {
                object.x0 = object.x1;
                object.x1 = x;
                object.y0 = object.y1;
                object.y1 = y;
                object.scale0 = object.scale1;
                object.scale1 = scale;
                object.angle0 = object.angle1;
                object.angle1 = angle;
                object.renderer = renderer ?? object.renderer;
            } else {
                object = {
                    x0: x,
                    x1: x,
                    y0: y,
                    y1: y,
                    scale0: scale,
                    scale1: scale,
                    angle0: angle,
                    angle1: angle,
                    renderer: renderer
                };
            }

            if (index >= this.#objectList.length) {
                this.#objectList[index] = object;
            } else {
                this.#objectList.splice(index, 1, object);
            }

            this.repaint();
        }
    }

    remove(index = 0) {
        this.#objectList.splice(index, 1);

        this.repaint();
    }

    setBackground(red = 0, green = 0, blue = 0, alpha = 0) {
        if (this.#background)
            this.#background.close();

        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);

        this.#buffer.context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
        this.#buffer.context.fillRect(0, 0, this.#buffer.width, this.#buffer.height);
        this.#background = this.#buffer.canvas.transferToImageBitmap();

        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);

        this.repaint();
    }

    setLayers() {
        if (this.#layers)
            this.#layers.close();

        this.#layers = this.#canvas.composite();

        this.repaint();
    }

    setGrid(width = 64, height = 64, red = 64, green = 64, blue = 64, alpha = 64) {
        if (this.#grid)
            this.#grid.close();

        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);
        this.#buffer.context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
        this.#buffer.context.lineWidth = 1;
        this.#buffer.context.beginPath();

        const vns = (this.#view.width - 1) / width;
        const hns = (this.#view.height - 1) / height;

        for (let j = 0; j <= hns; ++j) {
            for (let i = 0; i <= vns; ++i) {
                this.#buffer.context.moveTo((i + 1) * width - 1, j * height);
                this.#buffer.context.lineTo(i * width, j * height);
                this.#buffer.context.lineTo(i * width, (j + 1) * height - 1);
            }
        }

        this.#buffer.context.stroke();
        this.#grid = this.#buffer.canvas.transferToImageBitmap();
        this.#buffer.context.clearRect(0, 0, this.#buffer.width, this.#buffer.height);

        this.repaint();
    }

    run() {
        this.stop();

        let frames = 0;

        this.#renderer = setInterval(() => {
            ++frames;
            if (frames >= 20) {
                frames = 0;

                this.#objectList.forEach(object => {
                    object.x0 = object.x1;
                    object.y0 = object.y1;
                    object.scale0 = object.scale1;
                    object.angle0 = object.angle1;
                });

                this.#render();

                this.#repaint = false;
            } else if (this.#repaint) {
                this.#render(frames / 20);
            }
        }, 1000 / 30);
    }

    stop() {
        if (Number.isFinite(this.#renderer)) {
            clearInterval(this.#renderer);
        }
    }

    #render(step = 1) {
        this.#context.clearRect(0, 0, this.#view.width, this.#view.height);

        this.#objectList.forEach(object => {
            object.renderer(
                View.#lerp(step, object.x0, object.x1),
                View.#lerp(step, object.y0, object.y1),
                View.#lerp(step, object.scale0, object.scale1),
                View.#lerp(step, object.angle0, object.angle1)
            );
        });
    }

    repaint() {
        this.#repaint = true;
    }

    static #lerp(step = 1, start = 0, end = 0) {
        if (step === 0)
            return start;
        if (step === 1)
            return end;

        return start + (end - start) * step;
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
            const successful = paint.canvas.resize(event.data.width, event.data.height)

            postMessage({
                type: "resize",
                width: paint.width,
                height: paint.height,
                successful: successful
            });

            break;
        default:
            break;
    }
}