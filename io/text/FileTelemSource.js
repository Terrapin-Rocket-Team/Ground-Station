const TextSource = require("./TextSource");
const { log } = require("../../debug");
const { Readable } = require("stream");
const fs = require("fs");
const readline = require("readline");
const path = require("path");

/**
 * A class to play a local file as a video source
 */
class FileTelemSource extends TextSource {
  /**
   *
   * @param {String} file
   * @param {Object} options
   * @param {Number} options.datarate
   * @param {Function} options.parser
   * @param {Boolean} [options.createLog]
   * @param {String} [name]
   */
  constructor(file, options, name) {
    super(name ? name : file, fs.createReadStream(file));

    this.file = file;
    this.options = options;

    const rl = readline.createInterface({
      input: this.i,
      crlfDelay: Infinity,
    });
    this.lines = [];
    this.isPaused = false;
    this.isClosed = false;
    this.firstLine = true;

    rl.on("line", (line) => {
      if (!this.firstLine) this.lines.push(line);
      if (this.firstLine) this.firstLine = false;
      //stop reading lines so we don't fill up memory
      if (this.lines.length > 100) {
        rl.pause();
        this.isPaused = true;
      }
    });

    rl.on("close", () => {
      this.isClosed = true;
      log.debug("Finished reading " + this.name);
    });

    if (this.options.createLog) {
      const logName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".csv"
      );
      this.dataFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    setInterval(() => {
      let line = this.lines.shift();
      // skip any empty lines
      while (!line) line = this.lines.shift();
      // send the line to the user defined parser
      this.options.parser(line); // currently a string, should be a JSON object
      if (this.options.createLog) this.dataFile.write(line);
      // close if we finished sending all lines
      if (this.lines.length === 0 && this.isClosed) {
        this.emit("close");
      }
      // resume if we have emptied lots of lines
      if (this.lines.length < 50 && this.isPaused) {
        rl.resume();
        this.isPaused = false;
      }
    }, options.datarate * 1000);
  }
}

module.exports = FileTelemSource;