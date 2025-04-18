const TextSource = require("./text/TextSource");
const TextSink = require("./text/TextSink");
const FileTelemSource = require("./text/FileTelemSource");
const SerialTelemSource = require("./text/SerialTelemSource");
const FileCommandSink = require("./text/FileCommandSink");
const SerialCommandSink = require("./text/SerialCommandSink");

// collect all text-io modules

module.exports = {
  TextSource,
  TextSink,
  FileTelemSource,
  SerialTelemSource,
  FileCommandSink,
  SerialCommandSink,
};
