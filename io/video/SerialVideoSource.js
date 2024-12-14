const VideoSource = require("./VideoSource");
const { serial, SerialDevice } = require("../../serial/SerialDevice");
const { log } = require("../../debug");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const fs = require("fs");
const path = require("path");

const ffmpegPath =
  os.platform() == "win32"
    ? path.join(
        __dirname,
        "..",
        "..",
        "build",
        "coders",
        "ffmpeg-7.0.1",
        "ffmpeg.exe"
      )
    : path.join("/usr", "bin", "ffmpeg");

/**
 * A class to stream video from a serial device
 */
class SerialVideoSource extends VideoSource {
  /**
   * @param {String} file the file name to read from
   * @param {Object} options the video format configuration
   * @param {Object} options.resolution the video resolution
   * @param {Number} options.resolution.width the width of the video
   * @param {Number} options.resolution.height the height of the video
   * @param {Number} options.framerate the framerate of the video
   * @param {String} [options.rotation] how to rotate the video, if given
   * @param {Boolean} [options.createLog] whether to create a log of the video itself
   * @param {Boolean} [options.createDecoderLog] whether to create a log of ffmpeg's output
   * @param {SerialDevice} [sd] the serial device to read from, if not the default
   * @param {String} [name] the name to use instead of the file name
   */
  constructor(file, options, sd, name) {
    // call the VideoSource constructor with the name as the file name if "name" is not given
    super(name ? name : file, sd ? sd : serial);

    // setup serial interface for this stream
    this.sd = sd ? sd : serial;

    this.sd.addOutputStream(this.name);

    log.debug("Creating serial video source for: " + file);

    this.file = file;
    this.options = options;
    this.ffmpeg = null;
    // allocate a Buffer for frame data
    this.data = Buffer.alloc(
      this.options.resolution.width * this.options.resolution.height * 2
    );
    this.dataLen = 0;

    // check if rotation should be used
    if (this.options.rotation === undefined) {
      // set up ffmpeg instance
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
      // find proper rotation for ffmpeg
      let r = 0;
      if (this.options.rotation === "ccw") r = 0;
      else if (this.options.rotation === "cw") r = 1;
      else throw new Error("Invalid rotation");

      // set up ffmpeg instance
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

    // create video log file if necessary
    if (this.options.createLog) {
      const logName = path.join(
        "data",
        this.name + "_" + new Date().toISOString().replace(/:/g, "-") + ".av1"
      );
      this.dataFile = fs.createWriteStream(logName);

      log.debug("Log file created for " + this.name + ": " + logName);
    }

    // if ffmpeg was properly initialized, set up a write stream for the log file if necessary
    if (this.ffmpeg !== null && this.options.createDecoderLog) {
      const logName = path.join("logs", "ffmpeg-" + this.name + ".log");
      const logFile = fs.createWriteStream(logName);
      this.ffmpeg.stderr.pipe(logFile);

      log.debug("Log file created for " + this.name + ": " + logName);
    }
  }

  /**
   * Connects the output stream to ffmpeg output and ffmpeg input to the file read stream
   * @returns {Readable} the output stream
   */
  startOutput() {
    //connect pipes
    this.o = this.ffmpeg.stdout;
    this.i.pipe(this.name, this.ffmpeg.stdin);
    // connect video log pipe if necessary
    if (this.options.createLog && this.dataFile) this.i.pipe(this.dataFile);

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

    // other event handlers
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

module.exports = SerialVideoSource;
