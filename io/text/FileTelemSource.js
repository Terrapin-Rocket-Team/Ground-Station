const TextSource = require("./TextSource");
const { log } = require("../../debug");
const fs = require("fs");
const readline = require("readline");
const path = require("path");

/**
 * A class read telemetry from a local file
 */
class FileTelemSource extends TextSource {
  /**
   *
   * @param {String} file the file name to read from
   * @param {Object} options data handling configuration
   * @param {Number} options.datarate how fast the data should be emitted in seconds
   * @param {Function} options.parser called for each message received, this is how data is output
   * @param {Boolean} [options.createLog] whether to create a log of the telemetry
   * @param {String} [name] the name to use instead of the file name
   */
  constructor(file, options, name) {
    super(name ? name : file, fs.createReadStream(file));

    log.debug("Creating file telem source for: " + this.name);

    this.file = file;
    this.options = options;

    // read the CSV line by line
    const rl = readline.createInterface({
      input: this.i,
      crlfDelay: Infinity,
    });
    this.isPaused = false;
    this.isClosed = false;
    this.firstLine = true;

    // handle a line being read
    rl.on("line", (line) => {
      if (!this.firstLine) this.lines.push(line);
      if (this.firstLine) this.firstLine = false;
      // stop reading lines at 100 so we don't fill up memory
      if (this.lines.length > 100) {
        rl.pause();
        this.isPaused = true;
      }
    });

    // handle when the reader closes
    rl.on("close", () => {
      this.isClosed = true;
      log.debug("Finished reading " + this.name);
    });

    // create telemtry log file if necessary
    if (this.options.createLog) {
      const logName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".csv"
      );
      this.dataFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    // set an interval at the specified datarate
    let loop = setInterval(() => {
      if (this.lines.length > 0) {
        let line = this.lines.shift();
        // skip any empty lines
        while (!line) line = this.lines.shift();
        // send the line to the user defined parser
        this.options.parser(line); // currently outputs a string
        if (this.options.createLog) this.dataFile.write(line);
        // close if we finished sending all lines
        if (this.lines.length === 0 && this.isClosed) {
          clearInterval(loop);
          this.emit("close");
        }
        // resume if we have emptied lots of lines
        if (this.lines.length < 50 && this.isPaused) {
          rl.resume();
          this.isPaused = false;
        }
      }
    }, options.datarate * 1000);
  }
}

module.exports = FileTelemSource;
