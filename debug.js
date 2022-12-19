const fs = require("fs");
const path = require("path");

/*
Object.defineProperty(global, "__stack", {
  get: function () {
    let orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
      return stack;
    };
    let err = new Error();
    Error.captureStackTrace(err, arguments.callee);
    let stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  },
});

Object.defineProperty(global, "__callerline", {
  get: function () {
    console.log(__stack.length);
    console.log(
      __stack[0].getLineNumber(),
      __stack[1].getLineNumber(),
      __stack[2].getLineNumber()
    );
    console.log(
      __stack[3].getLineNumber(),
      __stack[4].getLineNumber(),
      __stack[5].getLineNumber()
    );
    console.log(
      __stack[6].getLineNumber(),
      __stack[7].getLineNumber(),
      __stack[8].getLineNumber(),
      __stack[9].getLineNumber()
    );
    return __stack[9].getLineNumber();
  },
});

Object.defineProperty(global, "__callerfile", {
  get: function () {
    return path.basename(__stack[9].getFileName());
  },
});

*/
const getLogPrefix = () => {
  const e = new Error();
  const regex = /\((.*):(\d+):(\d+)\)$/;
  const match = regex.exec(e.stack.split("\n")[3]);
  return "[" + path.basename(match[1]) + ":" + match[2] + "] ";
};

class Debug {
  constructor(win, logPath) {
    this.win = win;
    if (!logPath) logPath = "debug.log";
    this.ws = fs.createWriteStream(logPath);
  }
  setWin(win) {
    this.win = win;
  }
  print(message) {
    message = getLogPrefix() + message;

    console.log(message);
    this.ws.write(message);
    this.win.webContents.send("print", message);
  }
  println(message) {
    message = getLogPrefix() + message;

    console.log(message);
    this.ws.write(message + "\n");
    if (this.win) this.win.webContents.send("print", message + "\n");
  }
}

let debug = new Debug();

module.exports = { debug };
