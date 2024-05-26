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
    this.data = [];
  }

  startOutput() {
    return this.o;
  }

  hasData() {
    return this.data.length > 0;
  }

  readData() {
    return this.data.splice(0, data.length);
  }
}

module.exports = VideoSource;
