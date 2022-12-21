const fs = require("fs");
const path = require("path");

const getLogPrefix = (level) => {
  const e = new Error();
  const regex = /\((.*):(\d+):(\d+)\)$/;
  const match = regex.exec(e.stack.split("\n")[4]);
  return (
    "[" +
    path.basename(match[1]) +
    ":" +
    match[2] +
    "]" +
    "[" +
    level.toUpperCase() +
    "] "
  );
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
    this.win = {};
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

let log = new Debug();

module.exports = { log };
