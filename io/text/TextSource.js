const { EventEmitter } = require("node:events");
const { Readable } = require("stream");

/**
 * A template class for a generic source of text data
 */
class TextSource extends EventEmitter {
  /**
   * @param {string} name the source name to identify it later
   * @param {Readable} input the input data stream for the source
   */
  constructor(name, input) {
    super();
    this.name = name;
    this.i = input; // input
    this.lines = [];
  }
}

module.exports = TextSource;
