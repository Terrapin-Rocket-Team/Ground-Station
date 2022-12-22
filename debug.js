const fs = require("fs");
const path = require("path");

const getLogPrefix = (level) => {
  const e = new Error();
  let stackArr = e.stack.split("\n")[4].split(path.sep);
  let info = stackArr[stackArr.length - 1].split(":");
  return "[" + info[0] + ":" + info[1] + "]" + "[" + level.toUpperCase() + "] ";
};

class Debug {
  constructor(win, logPath) {
    this.win = win;
    this.useDebug = false;
    if (!logPath) logPath = "debug.log";
    this.ws = fs.createWriteStream(logPath);
  }
  setWin(win) {
    this.win = win;
  }
  removeWin() {
    this.win = null;
  }
  println(message, level) {
    message = getLogPrefix(level) + message;

    console.log(message);
    this.ws.write(message + "\n");
    if (this.win) this.win.webContents.send("print", message + "\n", level);
  }
  debug(message) {
    if (this.useDebug) this.println(message, "debug");
  }
  info(message) {
    this.println(message, "info");
  }
  warn(message) {
    this.println(message, "warn");
  }
  err(message) {
    this.println(message, "error");
  }
}

const log = new Debug();

module.exports = { log };
