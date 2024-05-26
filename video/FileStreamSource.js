const VideoSource = require("./VideoSource");
const { fp } = require("ffmpeg-static-electron");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const fs = require("fs");

class FileStreamSource extends VideoSource {
  /**
   *
   * @param {String} file
   * @param {Object} options
   * @param {Object} options.resolution
   * @param {Number} options.resolution.width
   * @param {Number} options.resolution.height
   * @param {Number} options.framerate
   * @param {String} options.rotation
   * @param {Boolean} options.createLog
   */
  constructor(file, options) {
    super(file.split("/").at(-1), fs.createReadStream(file));
    this.options = options;
    this.ffmpeg = null;
    this.logFile = null;
    if (this.options.rotation === undefined) {
      this.ffmpeg = spawn(fp, [
        "-s",
        this.options.resolution.width + "x" + this.options.resolution.height,
        "-framerate",
        this.options.framerate + "/1",
        "-",
      ]);
    } else {
      let r = 0;
      if (this.options.rotation === "ccw") r = 0;
      else if (this.options.rotation === "cw") r = 1;
      else throw new Error("Invalid rotation");

      this.ffmpeg = spawn(fp, [
        "-i",
        "-",
        "-vf",
        "transpose=" + r,
        "-s",
        this.options.resolution.width + "x" + this.options.resolution.height,
        "-framerate",
        this.options.framerate + "/1",
        "-",
      ]);
    }
    if (this.ffmpeg !== null) {
      if (this.options.createLog) {
        this.logFile = fs.createWriteStream("./ffmpeg-" + file + ".log");
        this.ffmpeg.stderr.pipe(this.logFile);
      }
    }
  }

  /**
   *
   * @returns {Readable}
   */
  startOutput() {
    this.o = new Readable();
    this.ffmpeg.stdout.pipe(this.o);
    this.i.pipe(this.ffmpeg.stdin);

    this.o.on("data", (chunks) => {
      this.data.push(chunks);
      this.emit("data", chunks);
    });

    this.o.on("close", () => {
      this.emit("close");
    });

    this.o.on("error", (err) => {
      this.emit("error", err);
    });

    return this.o;
  }
}

module.exports = FileStreamSource;
