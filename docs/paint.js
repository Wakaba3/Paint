class Layer {
    constructor(name = "") {
        this.name = name;
    }

    copy() {
        return new Layer(this.name);
    }
}

class ImageLayer extends Layer {
    constructor(name = "", blendMode = "source-over", imageData = null) {
        super(name);

        this.blendMode = blendMode;
        this.imageData = imageData;
    }

    copy() {
        return new ImageLayer(this.name, this.blendMode, this.imageData);
    }
}

class ListLayer extends Layer {
    constructor(name = "", start = -1, length = 0) {
        super(name);

        this.layers = layers;
        this.start = start;
        this.length = length;
    }

    copy() {
        return new ListLayer(this.name, this.start, this.length);
    }
}

class Canvas {
    #canvas;
    #context;
    #layers;
    #lists;
    #records;

    #bindingIndex;
    #bindingLayer;
    #bindingList;
    #bindingRecord;

    constructor(width = 0, height = 0) {
        if (!Number.isFinite(width) || width < 0)
            width = 0;
        if (!Number.isFinite(height) || height < 0)
            height = 0;

        this.#canvas = new OffscreenCanvas(width, height);
        this.#context = this.#canvas.getContext("2d", { willReadFrequently : true });
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

    #restore() {
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
        if (this.#bindingRecord && this.#bindingRecord > 0) {
            --this.#bindingRecord;
            this.#restore();
        }
    }

    redo() {
        if (this.#bindingRecord && this.#bindingRecord < this.#records.length - 1) {
            ++this.#bindingRecord;
            this.#restore();
        }
    }

    resize(width = 0, height = 0) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || this.#canvas.width === width && this.#canvas.height === height)
            return;

        this.#canvas.width = width;
        this.#canvas.height = height;
    }

    apply() {
        this.bind(this.#bindingIndex);
        this.save();
    }

    bind(index = -1) {
        if (this.#bindingLayer instanceof ImageLayer) {
            this.#bindingLayer.imageData = this.context.getImageData(0, 0, this.width, this.height);

            if (index === this.#bindingIndex)
                return;
        }

        if (0 <= index && index < this.#layers.length) {
            this.#bindingIndex = index;
            this.#bindingLayer = this.#layers[index];
            this.#bindingList = this.#getListThatIncludes(index);
        } else {
            this.#bindingIndex = -1;
            this.#bindingLayer = null;
            this.#bindingList = null;
        }

        if (this.#bindingLayer instanceof ImageLayer && this.#bindingLayer.imageData instanceof ImageData) {
            this.context.putImageData(this.#bindingLayer.imageData, 0, 0);

            return;
        }

        this.context.clearRect(0, 0, this.width, this.height);
    }

    addImage(name = "", blendMode = "source-over", binding = false) {
        this.addLayer(new ImageLayer(name, blendMode, this.context.createImageData(this.width, this.height)), binding);
    }

    addLayer(layer = null, binding = false) {
        this.addLayerAt(this.#bindingIndex + 1, layer);

        if (binding) {
            this.bind(this.#bindingIndex + 1);
        }
    }

    addLayerAt(index = -1, layer = null) {
        if (index < 0 || index > this.#layers.length)
            return;

        this.#layers.splice(index, 0, layer);
        this.#shiftListIndexes(index, 1)
    }

    removeLayer() {
        this.removeLayerAt(this.#bindingIndex);
    }

    removeLayerAt(index = -1) {
        if (index < 0 || index >= this.#layers.length)
            return;

        this.#layers.splice(index, 1);
        this.#shiftListIndexes(index, -1);
    }

    #shiftListIndexes(start = -1, amount = 0) {
        if (!Number.isFinite(amount) || amount === 0)
            return;

        if (Math.abs(amount) > 1) {
            let repeats = Math.abs(amount);
            let signum = amount > 0 ? 1 : -1;

            for (let i = 0; i < repeats; ++i) {
                this.#shiftListIndexes(start, signum);
            }

            return;
        }

        this.#lists.forEach(list => {
            if (start >= list.start) {
                if (start < list.start + list.length) {
                    list.length += amount;
                }
            } else {
                list.start += amount;
            }
        });
    }

    #getListThatIncludes(index) {
        this.#lists.forEach(list => {
            if (index >= list.start && index < list.start + list.length) {
                return list;
            }
        });

        return null;
    }

    get context() {
        return this.#context;
    }

    get width() {
        return this.#canvas.width;
    }

    get height() {
        return this.#canvas.height;
    }
}