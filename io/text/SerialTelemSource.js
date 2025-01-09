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
   * @param {String} name the name of the stream to create
   * @param {Object} options data handling configuration
   * @param {Function} options.parser called for each message received, this is how data is output
   * @param {Boolean} [options.isMetrics] whether this is a Metrics stream (otherwise it's a APRSTelem stream), needs a better solution
   * @param {Boolean} [options.createLog] whether to create a log of the telemetry
   * @param {SerialDevice} [sd] the serial device to read from, if not the default
   */
  constructor(name, options, sd) {
    super(name, sd ? sd : serial);

    // setup serial interface for this stream
    this.sd = sd ? sd : serial;

    this.sd.addOutputStream(this.name);

    log.debug("Creating serial telem source for: " + this.name);

    this.options = options;
    this.dataFile = null;
    this.logFile = null;
    this.firstLine = true;

    // create telemtry log file if necessary
    if (this.options.createLog) {
      const dataName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".csv"
      );
      const logName = path.join("log", this.name + ".txt");
      this.dataFile = fs.createWriteStream(dataName);
      this.logFile = fs.createWriteStream(logName);

      log.debug("Data log file created for " + this.name + ": " + dataName);
    }

    this.sd.on(this.name + "-data", (data) => {
      data
        .toString()
        .split("\n")
        .forEach((line) => {
          if (line) {
            this.options.parser(line);
            if (this.options.createLog && this.dataFile) {
              // write CSV of data to file
              let obj;
              // TODO: not ideal, but good enough for now, ideally we're coder agnostic here
              if (options.isMetrics) obj = new Metrics(line, true);
              if (!options.isMetrics) obj = new APRSTelem(line, this.name);

              // if first time write csv header
              this.dataFile.write(obj.toCSV(this.firstLine));
              if (this.firstLine) this.firstLine = false;
            }
            if (this.options.createLog && this.logFile) {
              // write a log of the raw messages
              this.logFile.write(line + "\n");
            }
          }
        });
    });

    // TODO: handle serial close?
  }
}

module.exports = SerialTelemSource;
