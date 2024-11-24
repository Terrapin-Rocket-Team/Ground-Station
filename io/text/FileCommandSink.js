const TextSink = require("./TextSink");
const { log } = require("../../debug");
const fs = require("fs");
const APRSCmd = require("../../coders/APRSCmd");

/**
 * A class write commands to a local file
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

    log.debug("Creating file command sink for: " + this.name);

    this.file = file;
    this.options = options;
  }

  write(text) {
    let outputText;
    if (!this.options) {
      outputText = text;
    }
    if (this.options.asString) {
      let aprsCmd = new APRSCmd({ deviceId: 3, data: { cmd: 0, args: 0 } });
      if (!aprsCmd.loadCmd(text)) {
        log.err("Error parsing command");
        return;
      }
      outputText = aprsCmd.toString();
    }
    if (this.options.asJSON) {
      let aprsCmd = new APRSCmd({ deviceId: 3, data: { cmd: 0, args: 0 } });
      if (!aprsCmd.loadCmd(text)) {
        log.err("Error parsing command");
        return;
      }
      outputText = JSON.stringify(aprsCmd);
    }
    this.o.write(outputText + "\n");
  }
}

module.exports = FileCommandSink;
