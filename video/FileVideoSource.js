const VideoSource = require("./VideoSource");
const { log } = require("../debug");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const fs = require("fs");
const path = require("path");

const ffmpegPath = path.join(
  __dirname,
  "..",
  "build",
  "video",
  "ffmpeg-7.0.1",
  "ffmpeg.exe"
);

/**
 * A class to play a local file as a video source
 */
class FileStreamSource extends VideoSource {
  /**
   * @param {String} file
   * @param {Object} options
   * @param {Object} options.resolution
   * @param {Number} options.resolution.width
   * @param {Number} options.resolution.height
   * @param {Number} options.framerate
   * @param {String} [options.rotation]
   * @param {Boolean} [options.createLog]
   * @param {String} [name]
   */
  constructor(file, options, name) {
    //call the VideoSource constructor with the name as the file name
    super(name ? name : file, fs.createReadStream(file));

    log.debug("Creating file stream source for: " + file);

    this.file = file;
    this.options = options;
    this.ffmpeg = null;
    this.logFile = null;
    this.data = Buffer.alloc(
      this.options.resolution.width * this.options.resolution.height * 2
    );
    this.dataLen = 0;

    //check if rotation should be used
    if (this.options.rotation === undefined) {
      //set up ffmpeg instance
      this.ffmpeg = spawn(ffmpegPath, [
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
      //find proper rotation for ffmpeg
      let r = 0;
      if (this.options.rotation === "ccw") r = 0;
      else if (this.options.rotation === "cw") r = 1;
      else throw new Error("Invalid rotation");

      //set up ffmpeg instance
      this.ffmpeg = spawn(ffmpegPath, [
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

    //if ffmpeg was properly initialized, set up a write stream for the log file if necessary
    if (this.ffmpeg !== null && this.options.createLog) {
      this.logFile = fs.createWriteStream("./ffmpeg-" + this.name + ".log");
      this.ffmpeg.stderr.pipe(this.logFile);

      log.debug("Log file created" + this.name + " " + this.logFile);
    }
  }

  /**
   * Connects the output stream to ffmpeg output and ffmpeg input to the file read stream
   * @returns {Readable} the output stream
   */
  startOutput() {
    //connect pipes
    this.o = this.ffmpeg.stdout;
    this.i.pipe(this.ffmpeg.stdin);

    //handle data output from ffmpeg
    this.o.on("data", (chunks) => {
      //this needs to be efficient or ffmpeg runs too slow
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

    //other event handlers
    this.o.on("close", () => {
      this.emit("close");
    });

    this.o.on("error", (err) => {
      this.emit("error", err);
    });

    return this.o;
  }

  /**
   * Decomposes a single YUV420 video frame into its component Y, U, and V parts
   * @param {Buffer} YUVarr a buffer containing a single YUV420 video frame
   * @param {Number} width the width of the video frame
   * @param {Number} height the height of the video frame
   * @returns {Object} object with separated Y, U, and V parts
   */
  decomposeYUV(YUVarr, width, height) {
    return {
      y: YUVarr.subarray(0, width * height),
      u: YUVarr.subarray(width * height, (width * height * 5) / 4),
      v: YUVarr.subarray((width * height * 5) / 4, (width * height * 3) / 2),
    };
  }

  /**
   * Outputs a single frame from the source
   * @returns {Buffer} A single frame with Y, U, V separated
   */
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
