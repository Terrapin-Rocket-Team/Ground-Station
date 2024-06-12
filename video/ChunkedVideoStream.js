const { Readable } = require('stream');
const { Radio } = require("../serial/serial");

class ChunkedVideoStream extends Readable {

    constructor(radio, isVideo1, options) {
        super(options);
        this.radio = radio;
        this.isVideo1 = isVideo1;
        console.log("Creating ChunkedVideoStream for " + (isVideo1 ? "Video 1" : "Video 2"));
        this.buffer = Buffer.alloc(1250);
    }

    _read() {
        this._read(1250);
    }
  
    _read(size) {

        size = Math.min(size, 1250); // 1116 bytes is the size of one frame
        console.log("Asking for " + size + " bytes");

        if (this.isVideo1) {

            console.log("Vid 1:" + this.radio.chunks1bot + " " + this.radio.chunks1top);
            
            // create a buffer to hold the data
            let offset = 0;

            // read from chunks1 until buffer is empty or size bytes are read (~1 frame)
            while (this.radio.chunks1bot != this.radio.chunks1top && offset < size) {

                // fill up buffer
                this.buffer.writeUInt8(this.radio.chunks1[this.radio.chunks1bot], offset);

                this.radio.chunks1bot = (this.radio.chunks1bot + 1) % this.radio.maxChunkSize;
                offset++;
            }

            console.log("eVid 1:" + this.radio.chunks1bot + " " + this.radio.chunks1top);

            if (offset > 0) {
                // respect backpressure
                if(!(this.push(this.buffer))) {
                    return;
                }
            }
        }
        else {
            console.log("Vid 2:" + this.radio.chunks2bot + " " + this.radio.chunks2top);
            
            // create a buffer to hold the data
            let offset = 0;

            // read from chunks2 until buffer is empty or size bytes are read (~1 frame)
            while (this.radio.chunks2bot != this.radio.chunks2top && offset < size) {

                // fill up buffer
                this.buffer.writeUInt8(this.radio.chunks2[this.radio.chunks2bot], offset);

                this.radio.chunks2bot = (this.radio.chunks2bot + 1) % this.radio.maxChunkSize;
                offset++;
            }

            console.log("eVid 2:" + this.radio.chunks2bot + " " + this.radio.chunks2top);

            if (offset > 0) {
                // this.radio.writeStream.write(this.buffer);
                // respect backpressure
                if(!(this.push(this.buffer))) {
                    return;
                }
            }
        }

        return;
  
    }
}

module.exports = ChunkedVideoStream;
  