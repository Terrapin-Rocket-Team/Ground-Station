const { EventEmitter } = require("node:events");
const { Readable } = require("stream");

/**
 * A template class for a generic source of text data
 */
class TextSink extends EventEmitter {
  /**
   * @param {string} name the source name to identify it later
   * @param {Readable} output the output data stream for the sink
   */
  constructor(name, output) {
    super();
    this.name = name;
    this.o = output; // output
    this.lines = [];
  }

  /**
   * Generic write method, should be overwritten by child class
   * @param {String} text the text to write to the output
   */
  write(text) {
    this.o.write(text);
  }
}

module.exports = TextSink;
