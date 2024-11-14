const VideoSource = require("./video/VideoSource");
const FileVideoSource = require("./video/FileVideoSource");
const SerialVideoSource = require("./video/SerialVideoSource");

// package all the VideoSource classes together
module.exports = { VideoSource, FileVideoSource, SerialVideoSource };
