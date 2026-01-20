const TextSink = require("./TextSink");
const { log } = require("../../debug");
const fs = require("fs");
const path = require("path");
const { serial, SerialDevice } = require("../../serial/SerialDevice");
const GSControl = require("../../coders/GSControl");

/**
 * A class write control commands to a serial device
 */
class SerialControlSink extends TextSink {
  /**
   *
   * @param {String} name the name of the stream to create
   * @param {Number} id the stream id to link to a particular pipe
   * @param {Object} [options] output configuration options
   * @param {Boolean} options.createLog whether to create a log of the commands
   * @param {SerialDevice} [sd] the serial device to write to, if not the default
   */
  constructor(name, id, options, sd) {
    super(name, id, sd ? sd : serial);

    // setup serial interface for this stream
    this.sd = sd ? sd : serial;

    this.sd.addStream(this.id);

    log.debug(
      "Creating serial control sink for: " + this.name + " id: " + this.id,
    );

    this.options = options ? options : {};
    this.dataFile = null;
    this.logFile = null;
    this.firstLine = true;

    // create commands log file if necessary
    if (this.options.createLog) {
      const dataName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".csv",
      );
      const logName = path.join("log", this.name + ".txt");
      this.dataFile = fs.createWriteStream(dataName);
      this.logFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    // TODO: handle serial close?
  }

  /**
   * @param {String} text the command to be written
   */
  write(text) {
    // TODO: update

    // always write the JSON ouput
    // that's what the Message library on the driver side is expecting
    // TODO: deviceId should not be hardcoded here
    let control = new GSControl({
      deviceId: 3,
      data: { valid: 1, cmd: "", args: "" },
    });
    if (!control.loadCtrl(text)) {
      log.err("Error parsing control command");
      return;
    }
    let outputText = JSON.stringify(control);
    // write the the serial device
    this.sd.write(this.id, outputText);
    // write to the log file if specified
    if (this.options.createLog && this.dataFile) {
      this.dataFile.write(control.toCSV(this.firstLine));
      if (this.firstLine) this.firstLine = false;
    }
    if (this.options.createLog && this.logFile) {
      // write a log of the raw messages
      this.logFile.write(text + "\n");
    }
  }
}

module.exports = SerialControlSink;
