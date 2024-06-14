const fs = require('fs');
const path = require('path');

// Define the paths to your input and output files
const inputFilePath = path.join(__dirname, 'mux.bin'); // Replace with your input file path
const outputFilePath = path.join(__dirname, 'yummy2.av1'); // Replace with your output file path


const maxChunkSize = 10000;   // in bytes (8 times one packet size)
const maxTelemetryChunkSize = 480;   // in bytes (8 times one packet size)
/** video1 circular buffer (8x default packetsize)*/
chunks1 = new Uint8Array(maxChunkSize);
/** video2 circular buffer (8x default packetsize)*/
chunks2 = new Uint8Array(maxChunkSize);
/** telemetry string */
chunks3 = "";

/** The index of the next byte to write to for chunks1 circular buffer */
chunks1top = 0;
/** The index of the next byte to write to for chunks2 circular buffer */
chunks2top = 0;

/** The index of the next byte to read from for chunks1 circular buffer */
chunks1bot = 0;
/** The index of the next byte to read from for chunks2 circular buffer */
chunks2bot = 0;

source = 0;
packetSize = 0;
packetidx = 0;
packetSizeFound = false;

totalCount = 0;

// // Create a readable stream to read the input file
// const readStream = fs.createReadStream('./mux.bin', {
//     highWaterMark: 1
// });

// Create a writable stream to write to the output file
const writeStream = fs.createWriteStream(outputFilePath);

// Read the input file byte by byte
fs.readFile('./mux.bin', function(err,data) {

    console.log("data received: " + data.length + " bytes")
    let dataidx = 0; // index of the next byte to read from data (so we don't need to always resize it)

    // repeat until we have processed all data
    while (dataidx < data.length) {

        console.log(`STARTING datidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks1top: ${chunks1top} chunks1bot: ${chunks1bot}`);


        // we need to check if the data is either video or telemetry
        if (source == 0) {

            console.log("looking for source " + data[dataidx] + " at " + dataidx + " of " + data.length + " - " + totalCount)

            if (data[dataidx] == 0x01)
                source = 1;
            else if (data[dataidx] == 0x02)
                source = 2;
            else if (data[dataidx] == 0xfe)
                source = 3;

            // console.log("source: " + source);

            dataidx++;
            totalCount++;
            packetSize = 0;
        }

        // we need to find packetsize
        if (packetSize == 0 && packetSizeFound == false) {
            packetSize = data[dataidx] * 256
            packetSizeFound = false;
            dataidx++;
            totalCount++;
        }
        // find the second byte of the packetsize
        if (packetSizeFound == false) {
            packetSize += data[dataidx];
            packetSizeFound = true;
            packetidx = 0;
            dataidx++;
            totalCount++;
        }

        if (source == 1 && packetSizeFound) {

            // console.log(`datidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks1top: ${chunks1top} chunks1bot: ${chunks1bot}`);
            // copy data to the circular buffer
            while (dataidx < data.length && packetidx < packetSize) {
                chunks1[chunks1top] = data[dataidx];
                chunks1top = (chunks1top + 1) % maxChunkSize;
                packetidx++;
                dataidx++;
                totalCount++;
                console.log(`datidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks1top: ${chunks1top} chunks1bot: ${chunks1bot}`);
            }
            // console.log(`edatidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks1top: ${chunks1top} chunks1bot: ${chunks1bot}`);

            // if we have a full packet, emit it
            if (packetidx == packetSize) {
                source = 0;
                packetSize = 0;
                packetSizeFound = false;
                packetidx = 0;
                // emit("video1chunk");
                console.log("video1chunk emitted");
                console.log(`edatidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks1top: ${chunks1top} chunks1bot: ${chunks1bot}`);

            }
        } else if (source == 2 && packetSizeFound) {

            // console.log(`datidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks2top: ${chunks2top} chunks2bot: ${chunks2bot}`);

            // copy data to the circular buffer
            while (dataidx < data.length && packetidx < packetSize) {
                chunks2[chunks2top] = data[dataidx];
                writeStream.write(Buffer.from([data[dataidx]]));
                chunks2top = (chunks2top + 1) % maxChunkSize;
                packetidx++;
                dataidx++;
                totalCount++;
                console.log(`datidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks2top: ${chunks2top} chunks2bot: ${chunks2bot}`);
            }

            // console.log(`edatidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks2top: ${chunks2top} chunks2bot: ${chunks2bot}`);

            // if we have a full packet, emit it
            if (packetidx == packetSize) {
                source = 0;
                packetSize = 0;
                packetSizeFound = false;
                packetidx = 0;
                // emit("video2chunk");
                console.log("video2chunk emitted");
                console.log(`edatidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks2top: ${chunks2top} chunks2bot: ${chunks2bot}`);

            }
        } else if (source == 3 && packetSizeFound) {

            console.log(`datidx: ${dataidx} source: ${source} tot: ${totalCount}  packetidx: ${packetidx} packetSize: ${packetSize} chunks3: ${chunks3}`);

            // copy data to the telemetry string
            let chars = Math.min(packetSize - packetidx, data.length - dataidx);
            console.log(`chars: ${chars}`);
            chunks3 += data.toString("utf8", dataidx, dataidx + chars);
            console.log(`chunks3: ${chunks3}`);

            packetidx += chars;
            dataidx += chars;
            totalCount += chars;

            // if we have a full packet, emit it
            if (packetidx >= packetSize - 1) {
                source = 0;
                packetSize = 0;
                packetSizeFound = false;
                packetidx = 0;

                // lookahead APRS message filtering
                let resp = chunks3.match(/Source:.*?(?=(Source:|$))/g);
                console.log(`resp: ${resp}`);
                if (resp) {
                    try {

                        console.log("Telemetry emitted")
                        // remove the processed data
                        chunks3 = chunks3.substring(resp[0].length);
                        //   emit("data", new APRSMessage(resp[0]));
                    } catch (err) {
                        // emit("error", err.message);
                    }
                }
            }
        }
    }
});

// // Handle end of input file
// readStream.on('end', () => {
//     console.log('File processing completed.');
//     writeStream.end();
// });

// // Handle errors
// readStream.on('error', (err) => {
//     console.error('Error reading input file:', err);
// });

writeStream.on('error', (err) => {
    console.error('Error writing output file:', err);
});