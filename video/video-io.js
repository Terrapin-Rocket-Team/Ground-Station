const VideoSource = require("./VideoSource");
const FileStreamSource = require("./FileStreamSource");
const SerialStreamSource = require("./SerialStreamSource");

// package all the VideoSource classes together
module.exports = { VideoSource, FileStreamSource, SerialStreamSource };
