const net = require("net");
const path = require("path");
const os = require("os");
const { log } = require("../debug.js");

let pipePathBase;

// get the right pipe path based on platform
if (os.platform() === "win32") {
  pipePathBase = "\\\\.\\pipe";
} else if (os.platform() === "linux") {
  pipePathBase = path.join(".", "build", "serial", "pipe");
}

class PipeStream {
  /**
   * @param {String} name the name of the pipe
   * @param {Function} callback callback to call when the pipe is connected
   */
  constructor(name, callback) {
    this.stream = null;
    this.name = name;
    this.path = path.join(pipePathBase, name);

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
    this.stream.on(eventName, listener);
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
