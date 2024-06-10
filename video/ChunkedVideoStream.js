const { Readable } = require('stream');
const { Radio } = require("../serial/serial");

class ChunkedVideoStream extends Readable {

    constructor(radio, isVideo1, options) {
        super(options);
        this.radio = radio;
        this.isVideo1 = isVideo1;
        console.log("Creating ChunkedVideoStream for " + (isVideo1 ? "Video 1" : "Video 2"));
    }

    _read() {
        this._read(1125);
    }
  
    _read(size) {

        size = Math.min(size, 1125); // 1125 bytes is the size of one frame
        console.log("Asking for " + size + " bytes");

        if (this.isVideo1) {
            // read from chunks1 until buffer is empty or size bytes are read (~1 frame)

            while (this.radio.chunks1bot != this.radio.chunks1top && size > 0) {

                // respect backpressure
                if(!(this.push(this.radio.chunks1[this.radio.chunks1bot]))) {
                    return;
                }
                this.radio.chunks1bot = (this.radio.chunks1bot + 1) % this.radio.maxChunkSize;
                size--;
            }
        }
        else {
            // read from chunks2 until buffer is empty or size bytes are read (~1 frame)
            while (this.radio.chunks2bot != this.radio.chunks2top && size > 0) {

                // respect backpressure
                if(!(this.push(this.radio.chunks2[this.radio.chunks2bot]))) {
                    return;
                }
                this.radio.chunks2bot = (this.radio.chunks2bot + 1) % this.radio.maxChunkSize;
                size--;
            }
        }
  
    }
}

module.exports = ChunkedVideoStream;
  