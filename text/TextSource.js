const { EventEmitter } = require("node:events");
const { Readable } = require("stream");

/**
 * A template class for a generic source of video
 */
class TextSource extends EventEmitter {
  /**
   * @param {string} name the source name to identify it later
   * @param {Readable} input the input video stream for the source
   */
  constructor(name, input) {
    super();
    this.name = name;
    this.i = input; //input
    this.o = null; //output (not needed?)
    this.frames = [];
  }

  /**
   * Base output start function, should be overriden by child class
   * @returns {Readable} the output stream
   */
  startOutput() {
    return this.o;
  }

  /**
   * Checks whether the source has a frame, can be overriden by base class
   * @returns {Boolean} whether the source has at least one frame
   */
  hasData() {
    return this.frames.length > 0;
  }

  /**
   * Reads a frame from the queue and removes it
   * @returns {any} the frame, type depends on the implementation of the child class
   */
  readData() {
    if (this.frames.length > 0) return this.frames.shift();
    else return null;
  }
}

module.exports = TextSource;
