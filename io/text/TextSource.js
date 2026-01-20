const { EventEmitter } = require("node:events");
const { Readable } = require("stream");

/**
 * A template class for a generic source of text data
 */
class TextSource extends EventEmitter {
  /**
   * @param {string} name the source name to identify it later
   * @param {Number} id the stream id to link to a particular pipe
   * @param {Readable} input the input data stream for the source
   */
  constructor(name, id, input) {
    super();
    this.name = name;
    this.id = id;
    this.i = input; // input
    this.lines = [];
  }
}

module.exports = TextSource;
