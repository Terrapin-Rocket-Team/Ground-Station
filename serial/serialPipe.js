const { SerialPort } = require("serialport");
const { APRSMessage } = require("./APRS");
const { EventEmitter } = require("node:events");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const serialDriverPath = path.join(
  __dirname,
  "..",
  "build",
  "serial",
  "serial.exe"
);

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

    this.chunks3 = "";

    //logic for starting the cpp program
    this.cppApp = spawn(serialDriverPath);

    this.cppApp.stdout.on("data", (data) => {
      console.log(`demux stdout: ${data}`);
    });
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
    const pipePath = "\\\\.\\pipe\\terpFcCommands";
    this.commandStream = fs.createWriteStream(pipePath, { encoding: "binary" });

    this.commandStream.on("error", (err) => {
      console.error("error writing command to named pipe", err.message);
    });
    this.commandStream.write(port);

    // handle telemetry data
    const pipeStream = fs.createReadStream("\\\\.\\pipe\\terpTelemetry");

    pipeStream.on("data", (data) => {
      this.chunks3 += data;
      console.log(data);

      // lookahead APRS message filtering
      let resp = this.chunks3.match(/Source:.*\0/g);
      console.log(`resp: ${resp}`);
      if (resp) {
        try {
          console.log("Telemetry received: " + resp[0]);

          // remove the processed data
          this.chunks3 = "";
          this.emit("data", new APRSMessage(resp[0]));
        } catch (err) {
          this.emit("error", data);
        }
      }
    });

    pipeStream.on("error", (err) => {
      console.error("error writing to named pipe", err.message);
    });

    // return promise that just returns 1
    return new Promise((res, rej) => {
      this.connected = true;
      res(1);
    });
  }

  writeCommand(command) {
    for (let i = 0; i < command.length; i++) {
      // turn it into a 16 bit signed integer using INT16BE
      this.commandStream.write(command[i]);
    }
    // write the last byte (boolean)
    // this.commandStream.write(command[command.length - 1]);
    console.log("Radio command sent: " + command);
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
    this.cppApp.kill("SIGINT");
  }

  reload() {
    //logic for starting the cpp program
    this.cppApp = spawn("./serial/main.exe");

    this.cppApp.stdout.on("data", (data) => {
      console.log(`demux stdout: ${data}`);
    });
  }
}

const radio = new Radio();

module.exports = {
  radio,
  Radio,
};
