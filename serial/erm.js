const fs = require('fs');
const pipePath = '\\\\.\\pipe\\ffmpegVideoOne';
const pipePath2 = '\\\\.\\pipe\\ffmpegVideoTwo';
const pipePath3 = '\\\\.\\pipe\\terpTelemetry';

const pipeStream = fs.createReadStream(pipePath);
const pipeStream2 = fs.createReadStream(pipePath2);
const pipeStream3 = fs.createReadStream(pipePath3);

let count1 = 0;
let count2 = 0;
let count3 = 0;

pipeStream.on('data', (data) => {
    count1 += data.length;

    if (count1 > 5000) {
        console.log("Video 1 emitted");
        count1 = 0;
    }
});

pipeStream2.on('data', (data) => {

    count2 += data.length;

    if (count2 > 5000) {
        console.log("Video 2 emitted");
        count2 = 0;
    }
});

pipeStream3.on('data', (data) => {
    count3 += data.length;

    if (count3 > 50) {
        console.log("Telemetry emitted");
        count3 = 0;
    }
});
