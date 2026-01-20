const TextSource = require("./text/TextSource");
const TextSink = require("./text/TextSink");
const FileTelemSource = require("./text/FileTelemSource");
const SerialTelemSource = require("./text/SerialTelemSource");
const FileCommandSink = require("./text/FileCommandSink");
const SerialCommandSink = require("./text/SerialCommandSink");
const SerialControlSink = require("./text/SerialControlSink");
const FileControlSink = require("./text/FileControlSink");

// collect all text-io modules

module.exports = {
  TextSource,
  TextSink,
  FileTelemSource,
  SerialTelemSource,
  FileCommandSink,
  SerialCommandSink,
  SerialControlSink,
  FileControlSink,
};
