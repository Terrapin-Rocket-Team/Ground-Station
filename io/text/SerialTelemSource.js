const TextSource = require("./TextSource");
const { log } = require("../../debug");
const { Readable } = require("stream");
const fs = require("fs");
const { serial, SerialDevice } = require("../../serial/SerialDevice");
const path = require("path");

/**
 * A class to play a local file as a video source
 */
class SerialTelemSource extends TextSource {
  /**
   *
   * @param {String} file
   * @param {Object} options
   * @param {Number} options.datarate
   * @param {Function} options.parser
   * @param {Boolean} [options.createLog]
   * @param {SerialDevice} [sd]
   * @param {String} [name]
   */
  constructor(file, options, sd, name) {
    super(name ? name : file, sd ? sd : serial);

    this.sd = sd ? sd : serial;

    this.sd.addOutputStream(this.name);

    log.debug("Creating serial telem source for: " + this.name);

    this.file = file;
    this.options = options;
    this.dataFile = null;

    this.lines = [];

    if (this.options.createLog) {
      const logName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".csv"
      );
      this.dataFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    this.sd.on(this.name + "-data", (data) => {
      this.emit("data", data);
      if (this.dataFile) {
        // if first time write csv header
        // write CSV of data to file
      }
    });

    this.sd.on("close", () => {
      // reset
    });
  }
}

module.exports = SerialTelemSource;