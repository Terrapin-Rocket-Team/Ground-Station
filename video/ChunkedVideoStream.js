const { Readable } = require('stream');


class ChunkedVideoStream extends Readable {
    constructor(options) {
        super(options);
        this.chunks = []; // Store chunks temporarily
    }
  
    _read(size) {
      // This method is called when the stream wants more data
        if (this.chunks.length > 0) {
            // If there are chunks available, push them to the stream
            this.push(this.chunks.shift());
        } else {
            // If no data is available, push null to indicate the end of the stream
            this.push(null);
        }
    }
  
    addChunk(chunk) {
        // This method will be called to add new chunks of data to the stream
        this.chunks.push(chunk);
        // Notify the stream that new data is available
        this.emit('readable');
    }
  }
  