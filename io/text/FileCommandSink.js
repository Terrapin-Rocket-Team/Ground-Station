const TextSink = require("./TextSink");
const { log } = require("../../debug");
const fs = require("fs");
const APRSCmd = require("../../coders/APRSCmd");

/**
 * A class write commands to a local file
 */
class FileCommandSink extends TextSink {
  /**
   * @param {String} file the file name to read from
   * @param {Number} id the stream id to link to a particular pipe
   * @param {Object} [options] output configuration options (only one should be specified)
   * @param {Boolean} options.asString write the output as a formatted string
   * @param {Boolean} options.asJSON write the output as JSON
   * @param {String} [name] the name to use instead of the file name
   */
  constructor(file, id, options, name) {
    super(name ? name : file, id, fs.createWriteStream(file));

    log.debug(
      "Creating file command sink for: " + this.name + " id: " + this.id,
    );

    this.file = file;
    this.options = options ? options : {};
  }

  /**
   * @param {String} text the command to be written
   */
  write(text) {
    let outputText;
    // if no format was written, just write the plain text
    if (!this.options) {
      outputText = text;
    }
    // if asString was set, write formatted text
    if (this.options.asString) {
      let aprsCmd = new APRSCmd({ deviceId: 3, data: { cmd: 0, args: 0 } });
      if (!aprsCmd.loadCmd(text)) {
        log.err("Error parsing command");
        return;
      }
      outputText = aprsCmd.toString();
    }
    // if asJSON was set, write the command as JSON text
    if (this.options.asJSON) {
      let aprsCmd = new APRSCmd({ deviceId: 3, data: { cmd: 0, args: 0 } });
      if (!aprsCmd.loadCmd(text)) {
        log.err("Error parsing command");
        return;
      }
      outputText = JSON.stringify(aprsCmd);
    }
    // write to the file
    this.o.write(outputText + "\n");
  }
}

module.exports = FileCommandSink;
