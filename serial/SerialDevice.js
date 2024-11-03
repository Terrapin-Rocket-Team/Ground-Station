const { SerialPort } = require("serialport");
// const { APRSMessage } = require("./APRS");
const { PipeStream } = require("./PipeStream");
const { EventEmitter } = require("node:events");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const { log } = require("../debug.js");

const serialDriverPath = path.join(__dirname, "..", "build", "serial");

/**
 * A class to communicate with the radio module using serialport
 */
class SerialDevice extends EventEmitter {
  /**
   */
  constructor() {
    super();
    this.ready = false;
    this.connected = false;
    this.deviceInput = [];
    this.deviceOutput = [];

    this.driver = {};
    this.control = {};
    this.status = {};
    this.command = {};

    this.chunks3 = "";

    this.setupDriver();
  }

  /**
   * Waits for all streams to be ready, then fires a callback
   * @param {PipeStream[]} streams the streams to wait for
   * @param {Function} callback the callback once all streams are ready
   */
  waitReady(streams, callback) {
    // total number of streams
    let len = streams.length;
    // number connected so far
    let connections = 0;

    streams.forEach((stream) => {
      stream.stream.on("connect", () => {
        connections++;
        if (connections == len) {
          callback();
        }
      });
    });
  }

  setupDriver() {
    //logic for starting the driver program
    if (os.platform() === "win32") {
      // this.cppApp = spawn(path.join(serialDriverPath, "DemuxWindows.exe"));
      this.driver = spawn(path.join(serialDriverPath, "DemuxShell.exe"));
    } else if (os.platform() === "linux") {
      this.driver = spawn(path.join(serialDriverPath, "DemuxLinux"));
    } else {
      log.err(
        "Failed to start serial interface: Unsupported platform! Found platform " +
          os.platform()
      );
    }

    this.driver.on("error", (err) => {
      // attempt to restart?
      log.err(err.message);
    });
    this.driver.once("exit", (code) => {
      log.info("Driver exited with code: " + code);
    });

    this.driver.stdout.once("data", (data) => {
      let dataStr = data.toString().replace("\r", "").split("\n");

      dataStr.forEach((str) => {
        if (str === "driver ready") {
          let streamsReady = 0;

          // create a stream to control the serial driver
          this.control = new PipeStream("control");

          // create a stream to receive status from the driver
          this.status = new PipeStream("status");

          this.waitReady([this.control, this.status], () => {
            log.info("Serial driver ready");
            this.emit("ready");
            this.ready = true;
          });
        }
      });
    });

    this.driver.stdout.on("data", (data) => {
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
      if (this.ready) {
        let stream;
        while ((stream = this.deviceInput.pop())) {
          stream.close();
        }
        while ((stream = this.deviceOutput.pop())) {
          stream.close();
        }

        // setup the driver
        this.control.stream.write("reset\n");
        this.control.stream.write(port + "\n");
        this.control.stream.write(baudRate.toString() + "\n");

        this.control.stream.write("connected\n");

        // check for successful connection
        this.status.stream.once("data", (data) => {
          if (data.toString() === "connected") {
            // setup data streams
            let telemetryStreams = [
              "telemetry-avionics",
              "telemetry-airbrake",
              "telemetry-payload",
            ];
            let commandStreams = ["command"];

            // get driver ready to accept pipe names
            this.control.stream.write("data pipes\n");

            // write the number of pipes
            this.control.stream.write(
              telemetryStreams.length + commandStreams.length + "\n"
            );

            // write the names of all the command pipes
            for (let i = 0; i < commandStreams.length; i++) {
              this.control.stream.write(commandStreams[i] + " " + i + "\n");
            }

            // write the names of all the telemetry pipes
            for (let i = 0; i < telemetryStreams.length; i++) {
              this.control.stream.write(
                telemetryStreams[i] + " " + (i + commandStreams.length) + "\n"
              );
            }

            // wait for all the pipes to successfully be created
            this.status.stream.once("data", (data) => {
              let success = data.toString() === "pipe creation successful";

              if (success) {
                // handle sending commands
                commandStreams.forEach((name) => {
                  let newStream = new PipeStream(name);
                  this.deviceInput.push(newStream);
                });

                this.command = this.deviceInput.find(
                  (o) => o.name === "command"
                );

                // handle telemetry data
                telemetryStreams.forEach((name) => {
                  let newStream = new PipeStream(name);
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

                this.waitReady(
                  this.deviceInput.concat(this.deviceOutput),
                  () => {
                    // resolve the promise
                    this.emit("connected");
                    this.connected = true;
                    res(1);
                  }
                );
              } else {
                rej({ message: "Requested pipes could not be created" });
              }
            });
          } else {
            rej({ message: data.toString() });
          }
        });
      } else {
        rej({ message: "serial driver has not started" });
      }
    });
  }

  writeCommand(command) {
    for (let i = 0; i < command.length; i++) {
      // turn it into a 16 bit signed integer using INT16BE
      this.command.stream.write(command[i]);
    }
    log.info("Radio command sent: " + command);
  }

  isConnected() {
    return {
      connected: this.connected,
    };
  }

  close() {
    this.control.stream.write("exit\n");
  }

  reload() {
    // this.close();

    this.ready = false;
    this.connected = false;

    this.setupDriver();
  }
}

const serial = new SerialDevice();

module.exports = {
  serial,
  SerialDevice,
};
