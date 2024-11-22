const { EventEmitter } = require("node:events");
const { Readable } = require("stream");

/**
 * A template class for a generic source of text data
 */
class TextSink extends EventEmitter {
  /**
   * @param {string} name the source name to identify it later
   * @param {Readable} input the input data stream for the source
   */
  constructor(name, output) {
    super();
    this.name = name;
    this.o = output; //output
    this.lines = [];
  }

  write(text) {}
}

module.exports = TextSink;
