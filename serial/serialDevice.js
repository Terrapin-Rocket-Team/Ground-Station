const { SerialPort } = require("serialport");
// const { APRSMessage } = require("./APRS");
const { PipeStream } = require("./PipeStream");
const { EventEmitter } = require("node:events");
const { spawn } = require("child_process");
// const fs = require("fs");
const path = require("path");
const os = require("os");
const { log } = require("../debug.js");

const serialDriverPath = path.join(__dirname, "..", "build", "serial");

/**
 * A class to communicate with the radio module using serialport
 */
class SerialDevice extends EventEmitter {
  /**
   * @param {SerialPort} [port] the serial port to listen to
   */
  constructor(port) {
    super();
    this.port = port ? port : null;
    this.connected = false;
    this.deviceInput = [];
    this.deviceOutput = [];

    this.chunks3 = "";

    //logic for starting the cpp program
    if (os.platform() === "win32") {
      this.cppApp = spawn(path.join(serialDriverPath, "DemuxWindows.exe"));
    } else if (os.platform() === "linux") {
      this.cppApp = spawn(path.join(serialDriverPath, "DemuxLinux"));
    } else {
      log.err(
        "Failed to start serial interface: Unsupported platform! Found platform " +
          os.platform()
      );
    }

    this.cppApp.stdout.on("data", (data) => {
      log.debug(`demux stdout: ${data}`);
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
    return new Promise((res, rej) => {
      // create a stream to control the serial driver
      this.deviceInput.push(new PipeStream("control", "ascii", "w"));

      this.control = this.deviceInput.find((o) => o.name === "control");

      // setup the driver
      this.control.stream.write(port + "\n");
      this.control.stream.write(baudRate + "\n");

      // create a stream to receive status from the driver
      this.deviceOutput.push(new PipeStream("status", "ascii", "r"));

      this.status = this.deviceOutput.find((o) => o.name === "status");

      // handle sending commands
      this.command = new PipeStream("command", "binary", "w");
      this.deviceInput.push(this.command);
      // handle telemetry data
      let telemetryStreams = [
        "telemetry-avionics",
        "telemetry-airbrake",
        "telemetry-payload",
      ];

      telemetryStreams.forEach((name) => {
        let newStream = new PipeStream(name, "binary", "r");

        newStream.on("data", (data) => {
          try {
            this.emit("data", name, JSON.parse(data));
          } catch (err) {
            log.err("Error receiving " + name + ": " + err.message);
            this.emit("error", name, data);
          }
        });
        this.deviceOutput.push(newStream);
      });

      // check for successful connection
      this.control.stream.write("connected\n");
      this.status.stream.once("data", (data) => {
        if (data === "connected") {
          this.connected = true;
          res(1);
        } else {
          log.err("Could not connect: " + data);
          rej(data);
        }
      });
    });
  }

  writeCommand(command) {
    for (let i = 0; i < command.length; i++) {
      // turn it into a 16 bit signed integer using INT16BE
      this.command.stream.write(command[i]);
    }
    log.debug("Radio command sent: " + command);
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
    if (os.platform() === "win32") {
      this.cppApp = spawn("./serial/DemuxWindows.exe");
    } else if (os.platform() === "linux") {
      this.cppApp = spawn("./serial/DemuxLinux");
    } else {
      log.err(
        "Failed to reload serial interface: Unsupported platform! Found platform " +
          os.platform()
      );
    }

    this.cppApp.stdout.on("data", (data) => {
      log.debug(`demux stdout: ${data}`);
    });
  }
}

const serial = new SerialDevice();

module.exports = {
  serial,
  SerialDevice,
};
