const TextSink = require("./TextSink");
const { log } = require("../../debug");
const fs = require("fs");

/**
 * A class read telemetry from a local file
 */
class FileCommandSink extends TextSink {
  /**
   *
   * @param {String} file
   * @param {Object} [options]
   * @param {Boolean} options.asString
   * @param {Boolean} options.asJSON
   * @param {String} [name]
   */
  constructor(file, options, name) {
    super(name ? name : file, fs.createWriteStream(file));

    this.file = file;
    this.options = options;
  }

  write(text) {
    let outputText;
    if (!this.options) {
      outputText = text;
    }
    if (this.options.asString) {
      outputText = text;
    }
    this.o.write(outputText + "\n");
  }
}

module.exports = FileCommandSink;
