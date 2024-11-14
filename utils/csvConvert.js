const { APRSMessage } = require("../coders/APRS");
const APRSTelem = require("../coders/APRSTelem");
const readline = require("readline");
const fs = require("fs");

const oldCSVPath = "test_old.csv";
const newCSVPath = "test.csv";

const rl = readline.createInterface({
  input: fs.createReadStream(oldCSVPath),
  crlfDelay: Infinity,
});
let firstLine = true;
let firstLineWritten = false;

const wr = fs.createWriteStream(newCSVPath);

// Stream,Device ID,Latitude,Longitude,Altitude,Speed,Heading,OrientationX,OrientationY,OrientationZ,State Flags,T0,RSSI
rl.on("line", (line) => {
  if (firstLine) {
    firstLine = false;
  } else {
    let oldMsg = APRSMessage.fromCSV(line);
    let newMsgStr = "telem-0,3";
    newMsgStr += "," + oldMsg.body.getDegreesDecimal(oldMsg.body.lat);
    newMsgStr += "," + oldMsg.body.getDegreesDecimal(oldMsg.body.long);
    newMsgStr += "," + oldMsg.body.alt;
    newMsgStr += "," + oldMsg.body.speed;
    newMsgStr += "," + oldMsg.body.heading;
    newMsgStr += ",0,0,0"; // no old orientation
    newMsgStr += ",0"; // no old state flags
    newMsgStr += "," + oldMsg.body.t0;
    newMsgStr += "," + oldMsg.rssi;

    let newMsg = APRSTelem.fromCSV(newMsgStr);
    wr.write(newMsg.toCSV(firstLineWritten));
    firstLineWritten = true;
  }
});

rl.on("close", () => {
  console.log("Finished reading");
});
