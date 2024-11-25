/* Extracts metrics (RSSI, bitrate) from a pre v2.0.0 Ground Station data csv */

const { APRSMessage } = require("../coders/APRS");
const Metrics = require("../coders/Metrics");
const readline = require("readline");
const fs = require("fs");

const oldCSVPath = "2024-06-19T21-35-26.433Z.csv";
const newCSVPath = "metrics.csv";

const rl = readline.createInterface({
  input: fs.createReadStream(oldCSVPath),
  crlfDelay: Infinity,
});
let firstLine = true;
let firstLineWritten = false;

const wr = fs.createWriteStream(newCSVPath);

let timeElapsed = new Date();
let messages = [];

rl.on("line", (line) => {
  if (firstLine) {
    firstLine = false;
  } else {
    let oldMsg = APRSMessage.fromCSV(line);
    messages.push(oldMsg);
  }
});

let runsWithoutMsg = 0;
let int = setInterval(() => {
  let oldMsg = messages.shift();
  if (oldMsg) {
    let newMsgStr = JSON.stringify(oldMsg);
    let metric = new Metrics({
      deviceId: 3,
      bitrate: (newMsgStr.length * 8) / ((Date.now() - timeElapsed) / 1000),
      rssi: oldMsg.rssi,
    });
    wr.write(metric.toCSV(firstLineWritten));
    firstLineWritten = true;
    timeElapsed = new Date();
  } else {
    runsWithoutMsg++;
  }
  if (runsWithoutMsg > 10) clearInterval(int);
}, 1000);

rl.on("close", () => {
  console.log("Finished reading");
});
