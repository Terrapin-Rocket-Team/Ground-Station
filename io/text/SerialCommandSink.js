const TextSink = require("./TextSink");
const { log } = require("../../debug");
const fs = require("fs");
const path = require("path");
const { serial, SerialDevice } = require("../../serial/SerialDevice");
const APRSCmd = require("../../coders/APRSCmd");

/**
 * A class write commands to a serial device
 */
class SerialCommandSink extends TextSink {
  /**
   *
   * @param {String} name the name of the stream to create
   * @param {Object} [options] output configuration options
   * @param {Boolean} options.createLog whether to create a log of the commands
   * @param {SerialDevice} [sd] the serial device to write to, if not the default
   */
  constructor(name, options, sd) {
    super(name, sd ? sd : serial);

    // setup serial interface for this stream
    this.sd = sd ? sd : serial;

    this.sd.addInputStream(this.name);

    log.debug("Creating serial command sink for: " + this.name);

    this.options = options;
    this.dataFile = null;
    this.firstLine = true;

    // create commands log file if necessary
    if (this.options.createLog) {
      const logName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".csv"
      );
      this.dataFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    // TODO: handle serial close?
  }

  /**
   * @param {String} text the command to be written
   */
  write(text) {
    // always write the JSON ouput
    // that's what the Message library on the driver side is expecting
    let aprsCmd = new APRSCmd({ deviceId: 3, data: { cmd: 0, args: 0 } });
    if (!aprsCmd.loadCmd(text)) {
      log.err("Error parsing command");
      return;
    }
    let outputText = JSON.stringify(aprsCmd);
    // write the the serial device
    this.sd.write(this.name, outputText);
    // write to the log file if specified
    if (this.options.createLog && this.dataFile) {
      this.dataFile.write(aprsCmd.toCSV(this.firstLine));
      if (this.firstLine) this.firstLine = false;
    }
  }
}

module.exports = SerialCommandSink;
