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
    this.firstLine = true;

    // create telemtry log file if necessary
    if (this.options.createLog) {
      // TODO: log raw messages
      const logName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".csv"
      );
      this.dataFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    this.sd.on(this.name + "-data", (data) => {
      this.options.parser(data);
      if (this.options.createLog && this.dataFile) {
        // write CSV of data to file
        let obj;
        // not ideal, but good enough for now, ideally we're coder agnostic here
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
