const VideoSource = require("./video/VideoSource");
const FileVideoSource = require("./video/FileVideoSource");
const SerialVideoSource = require("./video/SerialVideoSource");

// collect all video-io modules

module.exports = { VideoSource, FileVideoSource, SerialVideoSource };
