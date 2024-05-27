const VideoSource = require("./VideoSource");
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
    super(
      file.split("/").at(-1),
      fs.createReadStream(file, {
        highWaterMark:
          (options.resolution.width * options.resolution.height * 3) / 2,
      })
    );
    this.file = file;
    this.options = options;
    this.ffmpeg = null;
    this.logFile = null;
    this.data = Buffer.alloc(
      this.options.resolution.width * this.options.resolution.height * 2
    );
    this.dataLen = 0;
    if (this.options.rotation === undefined) {
      this.ffmpeg = spawn("ffmpeg", [
        "-re",
        "-framerate",
        this.options.framerate + "/1",
        "-i",
        "-",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "yuv420p",
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

      this.ffmpeg = spawn("ffmpeg", [
        "-re",
        "-framerate",
        this.options.framerate + "/1",
        "-i",
        "-",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "yuv420p",
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
        this.logFile = fs.createWriteStream("./ffmpeg-" + this.name + ".log");
        this.ffmpeg.stderr.pipe(this.logFile);
      }
    }
  }

  /**
   *
   * @returns {Readable}
   */
  startOutput() {
    this.o = this.ffmpeg.stdout;
    this.i.pipe(this.ffmpeg.stdin);

    this.o.on("data", (chunks) => {
      chunks.copy(this.data, this.dataLen, 0, chunks.length);
      this.dataLen += chunks.length;
      if (
        this.dataLen >
        (this.options.resolution.width * this.options.resolution.height * 3) / 2
      ) {
        this.frames.push(
          Buffer.from(
            this.data.subarray(
              0,
              (this.options.resolution.width *
                this.options.resolution.height *
                3) /
                2
            )
          )
        );
        this.data.copy(
          this.data,
          0,
          (this.options.resolution.width * this.options.resolution.height * 3) /
            2,
          this.datalen
        );
        this.dataLen -=
          (this.options.resolution.width * this.options.resolution.height * 3) /
          2;
      }
    });

    this.o.on("close", () => {
      this.emit("close");
    });

    this.o.on("error", (err) => {
      this.emit("error", err);
    });

    return this.o;
  }

  decomposeYUV(YUVarr, width, height) {
    return {
      y: YUVarr.subarray(0, width * height),
      u: YUVarr.subarray(width * height, (width * height * 5) / 4),
      v: YUVarr.subarray((width * height * 5) / 4, (width * height * 3) / 2),
    };
  }

  readFrame() {
    if (this.frames.length > 0)
      return this.decomposeYUV(
        this.frames.shift(),
        this.options.resolution.width,
        this.options.resolution.height
      );
    else return null;
  }
}

module.exports = FileStreamSource;
