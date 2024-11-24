const TextSource = require("./TextSource");
const { log } = require("../../debug");
const fs = require("fs");
const { serial, SerialDevice } = require("../../serial/SerialDevice");
const path = require("path");
const Metrics = require("../../coders/Metrics");
const APRSTelem = require("../../coders/APRSTelem");

/**
 * A class to read telemetry from a serial device
 */
class SerialTelemSource extends TextSource {
  /**
   *
   * @param {String} name
   * @param {Object} options
   * @param {Function} options.parser
   * @param {Boolean} [options.isMetrics]
   * @param {Boolean} [options.createLog]
   * @param {SerialDevice} [sd]
   */
  constructor(options, sd, name) {
    super(name, sd ? sd : serial);

    this.sd = sd ? sd : serial;

    this.sd.addOutputStream(this.name);

    log.debug("Creating serial telem source for: " + this.name);

    this.options = options;
    this.dataFile = null;
    this.firstLine = true;

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
      if (this.options.createLog && this.dataFile) {
        // write CSV of data to file
        let obj;
        if (options.isMetrics) obj = new Metrics(data);
        if (!options.isMetrics) obj = new APRSTelem(data);

        // if first time write csv header
        this.dataFile.write(obj.toCSV(this.firstLine) + "\n");
        if (this.firstLine) this.firstLine = false;
      }
    });

    // TODO: handle serial close?
  }
}

module.exports = SerialTelemSource;
