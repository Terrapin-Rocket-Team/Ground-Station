const { SerialPort } = require("serialport");
const { APRSMessage } = require("./APRS");
const { EventEmitter } = require("node:events");
const fs = require("fs");
const { spawn } = require("node:child_process");

const maxChunkSize = 10000;   // in bytes (8 times one packet size)
const maxTelemetryChunkSize = 480;   // in bytes (8 times one packet size)

/**
 * A class to communicate with the radio module using serialport
 */
class Radio extends EventEmitter {
  /**
   * @param {SerialPort} [port] the serial port to listen to
   */
  constructor(port) {
    super();
    this.port = port ? port : null;
    this.connected = false;

    /** video1 circular buffer (8x default packetsize)*/
    this.chunks1 = new Uint8Array(maxChunkSize);
    /** video2 circular buffer (8x default packetsize)*/
    this.chunks2 = new Uint8Array(maxChunkSize);
    /** telemetry string */
    this.chunks3 = "";

    /** The index of the next byte to write to for chunks1 circular buffer */
    this.chunks1top = 0;
    /** The index of the next byte to write to for chunks2 circular buffer */
    this.chunks2top = 0;

    /** The index of the next byte to read from for chunks1 circular buffer */
    this.chunks1bot = 0;
    /** The index of the next byte to read from for chunks2 circular buffer */
    this.chunks2bot = 0;

    this.source = 0;
    this.packetSize = 0;
    this.packetidx = 0;
    this.packetSizeFound = false;
    this.maxChunkSize = maxChunkSize;
    this.maxTelemetryChunkSize = maxTelemetryChunkSize;

    // this.writeStream = fs.createWriteStream("humana2.av1", { flags: "a" });

    this.totalCount = 0;
  }

  /**
   * @returns {Promise<[]|Error>} array of available ports, rejects with the error if one occurs
   */
  getAvailablePorts() {
    return new Promise((res, rej) => {
      SerialPort.list()
        .then((list) => {
          res(list);
        })
        .catch((err) => {
          rej(err);
        });
    });
  }

  /**
   * @param {string} port the serial port to connect to
   * @param {number} [baudRate] the baud rate of the connected device, default is 115200
   * @returns {Promise<Number|Error>} 1 if the port was successfully connected, otherwise rejects with the error
   */
  connect(port, baudRate) {
    return new Promise((res, rej) => {
      if (!baudRate) baudRate = 4800000;
      //attempt the connection, rejecting the promise if there is an error
      this.port = new SerialPort(
        {
          path: port,
          baudRate,
        },
        (err) => {
          if (err) rej(err);
        }
      );

      // let ffplay;
      // let ffplayLog = fs.createWriteStream("ffplay.log");

      //if the port is successfully opened resolve the promise
      this.port.on("open", () => {
        this.connected = true;
        // ffplay = spawn("ffplay", [
        //   "-vf",
        //   "transpose=1",
        //   "-framerate",
        //   "30/1",
        //   "-",
        // ]);
        // ffplay.stdout.pipe(ffplayLog);
        // ffplay.stderr.pipe(ffplayLog);
        this.port.flush();
        res(1);
      });

      // let bytes = 0;
      // let lastBytes = new Date();
      // setInterval(() => {
      //   let thisBytes = new Date();
      //   process.stderr.write(
      //     "Bitrate: " + (bytes * 8) / (thisBytes - lastBytes) + "\n"
      //   );
      //   lastBytes = thisBytes;
      //   bytes = 0;
      // }, 1000);

      //get data from the serial port, and once a full message has been recieved, emit the data with the data event
      this.port.on("data", (data) => {
        console.log("data received: " + data.length + " bytes")
        let dataidx = 0;  // index of the next byte to read from data (so we don't need to always resize it)

        // repeat until we have processed all data
        while (dataidx < data.length) {

          // we need to check if the data is either video or telemetry
          if (this.source == 0) {

            console.log("looking for source " + data[dataidx] + " at " + dataidx + " of " + data.length + " - " + this.totalCount)

            if (data[dataidx] == 0x01)
              this.source = 1;
            else if (data[dataidx] == 0x02)
              this.source = 2;
            else if (data[dataidx] == 0xfe)
              this.source = 3;

            // console.log("source: " + this.source);

            dataidx++;
            this.totalCount++;
            this.packetSize = 0;
          }

          // we need to find packetsize
          if (this.packetSize == 0 && this.packetSizeFound == false) {
            this.packetSize = data[dataidx] * 256
            this.packetSizeFound = false;
            dataidx++;
            this.totalCount++;
          }
          // find the second byte of the packetsize
          if (this.packetSizeFound == false) {
            this.packetSize += data[dataidx];
            this.packetSizeFound = true;
            this.packetidx = 0;
            dataidx++;
            this.totalCount++;
          }

          if (this.source == 1 && this.packetSizeFound) {

            // console.log(`datidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks1top: ${this.chunks1top} chunks1bot: ${this.chunks1bot}`);
            // copy data to the circular buffer
            while (dataidx < data.length && this.packetidx < this.packetSize) {
              this.chunks1[this.chunks1top] = data[dataidx];
              this.chunks1top = (this.chunks1top + 1) % maxChunkSize;
              this.packetidx++;
              dataidx++;
              this.totalCount++;
              console.log(`datidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks1top: ${this.chunks1top} chunks1bot: ${this.chunks1bot}`);
            }
            // console.log(`edatidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks1top: ${this.chunks1top} chunks1bot: ${this.chunks1bot}`);

            // if we have a full packet, emit it
            if (this.packetidx == this.packetSize) {
              this.source = 0;
              this.packetSize = 0;
              this.packetSizeFound = false;
              this.packetidx = 0;
              this.emit("video1chunk");
              console.log("video1chunk emitted");
              console.log(`edatidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks1top: ${this.chunks1top} chunks1bot: ${this.chunks1bot}`);

            }
          }

          else if (this.source == 2 && this.packetSizeFound) {

            // console.log(`datidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks2top: ${this.chunks2top} chunks2bot: ${this.chunks2bot}`);

            // copy data to the circular buffer
            while (dataidx < data.length && this.packetidx < this.packetSize) {
              this.chunks2[this.chunks2top] = data[dataidx];
              this.chunks2top = (this.chunks2top + 1) % maxChunkSize;
              this.packetidx++;
              dataidx++;
              this.totalCount++;
              console.log(`datidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks2top: ${this.chunks2top} chunks2bot: ${this.chunks2bot}`);
            }

            // console.log(`edatidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks2top: ${this.chunks2top} chunks2bot: ${this.chunks2bot}`);

            // if we have a full packet, emit it
            if (this.packetidx == this.packetSize) {
              this.source = 0;
              this.packetSize = 0;
              this.packetSizeFound = false;
              this.packetidx = 0;
              this.emit("video2chunk");
              console.log("video2chunk emitted");
              console.log(`edatidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks2top: ${this.chunks2top} chunks2bot: ${this.chunks2bot}`);

            }
          }

          else if (this.source == 3 && this.packetSizeFound) {

            console.log(`datidx: ${dataidx} source: ${this.source} tot: ${this.totalCount}  packetidx: ${this.packetidx} packetSize: ${this.packetSize} chunks3: ${this.chunks3}`);

            // copy data to the telemetry string
            let chars = Math.min(this.packetSize - this.packetidx, data.length - dataidx);
            console.log(`chars: ${chars}`);
            this.chunks3 += data.toString("utf8", dataidx, dataidx + chars);
            console.log(`chunks3: ${this.chunks3}`);

            this.packetidx += chars;
            dataidx += chars;
            this.totalCount += chars;

            // if we have a full packet, emit it
            if (this.packetidx >= this.packetSize - 1) {
              this.source = 0;
              this.packetSize = 0;
              this.packetSizeFound = false;
              this.packetidx = 0;

              // lookahead APRS message filtering
              let resp = this.chunks3.match(/Source:.*?(?=(Source:|$))/g);
              console.log(`resp: ${resp}`);
              if (resp) {
                try {

                  console.log("Telemetry emitted")
                  // remove the processed data
                  this.chunks3 = this.chunks3.substring(resp[0].length);
                  this.emit("data", new APRSMessage(resp[0]));
                }
                catch (err) {
                  this.emit("error", err.message);
                }
              }
            }
          }
        }
      });

      //if the serial port is disconnected, emit the close event
      this.port.on("close", () => {
        let path = this.port.path;
        this.port = null;
        // this.writeStream.end();
        console.log("received close event " + this.totalCount + " bytes")
        this.emit("close", path);
      });
    });
  }

  isConnected() {
    return {
      connected: this.connected,
      port: this.port ? this.port.path : null,
    };
  }

  close() {
    if (this.port != null && this.port.isOpen) {
      this.port.close();
    }
  }
}

const radio = new Radio();

module.exports = { radio, Radio };
