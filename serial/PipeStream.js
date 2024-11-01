const fs = require("fs");
const { log } = require("../debug.js");

const pipePathBase = path.join(".", "pipe");

class PipeStream {
  constructor(name, encoding, type) {
    super();

    this.stream = null;
    this.name = name;
    this.path = path.join(pipePathBase, name);
    this.encoding = encoding;
    this.type = type;

    // setup the stream itself
    let action = "";

    if (type === "r") {
      this.stream = fs.createReadStream(path, { encoding });
      action = "reading from";
    } else if (type === "w") {
      this.stream = fs.createWriteStream(path, { encoding });
      action = "writing to";
    } else {
      log.err("Invalid type for PipeStream " + path);
      return;
    }

    this.stream.on("error", (err) => {
      log.err("Failed " + action + " pipe: " + path + "\n" + err.message);
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
