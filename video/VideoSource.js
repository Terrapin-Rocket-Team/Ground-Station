const { EventEmitter } = require("node:events");
const { Readable } = require("stream");

class VideoSource extends EventEmitter {
  /**
   *
   * @param {Readable} input
   */
  constructor(name, input) {
    super();
    this.name = name;
    this.i = input;
    this.o = null;
    this.frames = [];
  }

  startOutput() {
    return this.o;
  }

  hasFrame() {
    return this.frames.length > 0;
  }

  readFrame() {
    if (this.frames.length > 0) return this.frames.shift();
    else return null;
  }
}

module.exports = VideoSource;
