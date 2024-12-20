const net = require("net");
const os = require("os");
const path = require("path");
const { log } = require("../debug.js");

class PipeStream {
  /**
   * @param {String} name the name of the pipe
   * @param {Function} callback callback to call when the pipe is connected
   */
  constructor(name, callback) {
    let pipePathBase;

    // get the right pipe path based on platform
    if (os.platform() === "win32") {
      pipePathBase = "\\\\.\\pipe\\"; // windows named pipe path
    } else if (os.platform() === "linux") {
      // pipePathBase = '\0'; // abstract unix pipe prefix
      pipePathBase =
        path.join(__dirname, "../", "build", "serial", "pipes") + "/"; // temp store on file system since electron breaks abstract pipes
    }

    this.stream = null;
    this.name = name;
    this.path = pipePathBase + name; // need to add (not path.join()) because pipePathBase on linux is just a prefix and not the root path

    // create a new net socket (fs locks up when trying to connect to too many pipes on Windows)
    this.stream = net.connect(this.path, () => {
      log.debug("connected " + this.path);
      if (callback) callback();
    });

    this.stream.on("error", (err) => {
      log.err("Error on pipe: " + this.path + "\n" + err.message);
    });
    this.stream.on("end", () => {
      log.debug("disconnected " + this.path);
    });
  }

  /**
   * Simply adds a listener to the stream within
   * @param {String} eventName the event to listen for
   * @param {Function} listener the callback to when the event fires
   */
  on(eventName, listener) {
    if (this.stream != null) this.stream.on(eventName, listener);
  }

  /**
   * Close the pipe connection
   */
  close() {
    if (this.stream != null) {
      this.stream.end();
      this.stream = null;
    }
  }
}

module.exports = {
  PipeStream,
};
