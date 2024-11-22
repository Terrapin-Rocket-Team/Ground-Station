const fs = require("fs");
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
  constructor(name, encoding, type) {
    this.stream = null;
    this.name = name;
    this.path = path.join(pipePathBase, name);
    this.encoding = encoding;
    this.type = type;

    // setup the stream itself
    let action = "";

    if (type === "r") {
      // this.stream = fs.createReadStream(this.path, { encoding });
      this.stream = fs.createReadStream(this.path);
      action = "reading from";
    } else if (type === "w") {
      this.stream = fs.createWriteStream(this.path, { encoding });
      action = "writing to";
    } else {
      log.err("Invalid type for PipeStream " + this.path);
      return;
    }

    this.stream.on("error", (err) => {
      log.err("Failed " + action + " pipe: " + this.path + "\n" + err.message);
    });
  }

  // simply adds a listener to the stream within
  on(eventName, listener) {
    this.stream.on(eventName, listener);
  }
}

module.exports = {
  PipeStream,
};
