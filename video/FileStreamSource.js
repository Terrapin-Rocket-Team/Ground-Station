const VideoSource = require("./VideoSource");
const ffmpegPath = require("ffmpeg-static-electron");
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
      //   this.ffmpeg = exec(
      //     "ffmpeg -re -framerate " +
      //       this.options.framerate +
      //       "/1 -i - -f rawvideo -pix_fmt yuv420p -s " +
      //       this.options.resolution.width +
      //       "x" +
      //       this.options.resolution.height +
      //       " -framerate " +
      //       this.options.framerate +
      //       "/1 -",
      //     { shell: "cmd.exe" }
      //   );
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
      //   this.ffmpeg = exec(
      //     "ffmpeg -re -framerate " +
      //       this.options.framerate +
      //       "/1 -i - -f rawvideo -pix_fmt yuv420p -vf transpose=" +
      //       r +
      //       " -s " +
      //       this.options.resolution.width +
      //       "x" +
      //       this.options.resolution.height +
      //       " -framerate " +
      //       this.options.framerate +
      //       "/1 -",
      //     { shell: "cmd.exe" }
      //   );
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

    let out = fs.createWriteStream("out2.av1");
    this.o.pipe(out);

    // this.o.on("data", (chunks) => {
    //   this.data = this.data.concat(Array.from(chunks));
    //   if (
    //     this.data.length >
    //     (this.options.resolution.width * this.options.resolution.height * 3) / 2
    //   ) {
    //     this.emit(
    //       "data",
    //       this.data.splice(
    //         0,
    //         (this.options.resolution.width *
    //           this.options.resolution.height *
    //           3) /
    //           2
    //       )
    //     );
    //   }
    // });

    // this.o.on("close", () => {
    //   this.emit("close");
    // });

    // this.o.on("error", (err) => {
    //   this.emit("error", err);
    // });

    return this.o;
  }

  decomposeYUV(YUVarr, width, height) {
    return {
      y: YUVarr.slice(0, width * height),
      u: YUVarr.slice(width * height, (width * height * 5) / 4),
      v: YUVarr.slice((width * height * 5) / 4, (width * height * 3) / 2),
    };
  }
}

module.exports = FileStreamSource;
