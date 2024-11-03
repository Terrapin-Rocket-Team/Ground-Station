const fs = require("fs");
const net = require("net");
const path = require("path");
const os = require("os");
const { log } = require("../debug.js");

let pipePathBase;

if (os.platform() === "win32") {
  pipePathBase = "\\\\.\\pipe";
} else if (os.platform() === "linux") {
  pipePathBase = path.join(".", "build", "serial", "pipe");
}

class PipeStream {
  constructor(name, callback) {
    this.stream = null;
    this.name = name;
    this.path = path.join(pipePathBase, name);

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

  // simply adds a listener to the stream within
  on(eventName, listener) {
    this.stream.on(eventName, listener);
  }

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
