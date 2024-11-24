const TextSink = require("./TextSink");
const { log } = require("../../debug");
const fs = require("fs");
const { serial, SerialDevice } = require("../../serial/SerialDevice");
const APRSCmd = require("../../coders/APRSCmd");

/**
 * A class write commands to a local file
 */
class SerialCommandSink extends TextSink {
  /**
   *
   * @param {String} name
   * @param {Object} [options]
   * @param {Boolean} options.createLog
   * @param {SerialDevice} [sd]
   */
  constructor(name, options, sd) {
    super(name, sd ? sd : serial);

    this.sd = sd ? sd : serial;

    this.sd.addInputStream(this.name);

    log.debug("Creating serial command sink for: " + this.name);

    this.options = options;
    this.dataFile = null;

    if (this.options.createLog) {
      const logName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".txt"
      );
      this.dataFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    // TODO: handle serial close?
  }

  write(text) {
    let aprsCmd = new APRSCmd({ deviceId: 3, data: { cmd: 0, args: 0 } });
    if (!aprsCmd.loadCmd(text)) {
      log.err("Error parsing command");
      return;
    }
    let outputText = JSON.stringify(aprsCmd);
    this.sd.write(this.name, outputText);
    if (this.options.createLog && this.dataFile)
      this.dataFile.write(outputText + "\n");
  }
}

module.exports = SerialCommandSink;
