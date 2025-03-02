const { SerialPort } = require("serialport");
const { PipeStream } = require("./PipeStream");
const { EventEmitter } = require("node:events");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { log } = require("../debug.js");

const serialDriverPath = path.join(__dirname, "..", "build", "serial");
const logPath = "./log";

/**
 * A class to communicate with the radio module using Serial
 */
class SerialDevice extends EventEmitter {
  /**
   * Create a new Serial Device
   */
  constructor() {
    super();
    this.ready = false;
    this.connected = false;
    this.inputStreamNames = [];
    this.outputStreamNames = [];
    this.deviceInput = [];
    this.deviceOutput = [];

    this.port = "";

    this.driver = {};
    this.control = {};
    this.status = {};

    this.useDebug = false;
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
      stream.on("connect", () => {
        connections++;
        if (connections == len) {
          callback();
        }
      });
    });
  }

  /**
   * Adds a stream to the list of streams created when calling connect()
   * @param {String} name the name of the input stream to add
   */
  addInputStream(name) {
    this.inputStreamNames.push(name);
  }

  /**
   * Adds a stream to the list of streams created when calling connect()
   * @param {String} name the name of the output stream to add
   */
  addOutputStream(name) {
    this.outputStreamNames.push(name);
  }

  clearStreams() {
    this.inputStreamNames = [];
    this.outputStreamNames = [];
  }

  /**
   * Wrapper to pipe an output PipeStream to another stream
   * @param {String} name the name of the output PipeStream
   * @param {Writable} outStream the stream to pipe to
   */
  pipe(name, outStream) {
    let stream = this.deviceOutput.find((o) => o.name === name);
    if (stream) stream.stream.pipe(outStream);
    else log.err("Could not find output stream: " + name);
  }

  /**
   * Internal method for setting up the driver program
   */
  setupDriver() {
    // logic for starting the driver program
    if (os.platform() === "win32") {
      if (!this.useDebug)
        this.driver = spawn(path.join(serialDriverPath, "SerialDriver.exe"));
      else this.driver = spawn(path.join(serialDriverPath, "DriverShell.exe"));
    } else if (os.platform() === "linux" || os.platform() === "darwin") {
      if (!this.useDebug)
        this.driver = spawn(path.join(serialDriverPath, "SerialDriver"));
      else this.driver = spawn(path.join(serialDriverPath, "DriverShell"));
    } else {
      log.err(
        "Failed to start serial interface: Unsupported platform! Found platform " +
          os.platform()
      );
    }

    // other listeners
    this.driver.on("error", (err) => {
      // TODO: attempt to restart?
      log.err(err.message);
    });
    this.driver.once("exit", (code, signal) => {
      // reset all flags
      this.ready = false;
      this.connected = false;
      this.port = "";
      if (code) log.info("Driver exited with code: " + code);
      if (signal) log.info("Driver exited with signal: " + signal);
      this.emit("exit");
    });

    // wait for output on stdout
    this.driver.stdout.once("data", (data) => {
      let dataStr = data.toString().replace("\r", "").split("\n");

      // wait for the "driver ready" output from the driver, must be the first output
      dataStr.forEach((str) => {
        if (str === "driver ready") {
          // create a stream to control the serial driver
          this.control = new PipeStream("control");

          // create a stream to receive status from the driver
          this.status = new PipeStream("status");

          // above streams allow us much more flexibility on stdout

          this.waitReady([this.control, this.status], () => {
            this.status.on("data", (data) => {
              let strings = data.toString().split("\n");
              for (let i = 0; i < strings.length - 1; i++) {
                if (strings[i] == "Interrupt") {
                  // we know there the serial driver is trying to tell us something at i+1
                  // figure out what that is
                  if (strings[i + 1].includes("serial connection error")) {
                    log.debug(
                      "Error communicating with serial device: " +
                        strings[i + 1]
                    );
                    this.emit("close", this.port);
                    this.control.stream.write("close\n");
                    this.connected = false;
                    this.port = "";
                  }
                  if (strings[i + 1].includes("serial driver error")) {
                    log.debug("Error with serial driver: " + strings[i + 1]);
                    this.close();
                  }
                }
              }
            });
            log.info("Serial driver ready");
            this.emit("ready");
            this.ready = true;
          });
        }
      });
    });

    // setup debug output of all serial driver stdout data
    this.driver.stdout.pipe(
      fs.createWriteStream(path.join(logPath, "serial_driver_debug.log"))
    );
  }

  /**
   * @returns {Promise<[]|Error>} array of available ports, rejects with the error if one occurs
   */
  getAvailablePorts() {
    // TODO: remove SerialPort dependency
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
    log.debug(port);
    return new Promise((res, rej) => {
      // serial driver must be ready to connect
      if (this.ready) {
        // remove all existing streams
        let stream;
        while ((stream = this.deviceInput.pop())) {
          stream.close();
        }
        while ((stream = this.deviceOutput.pop())) {
          stream.close();
        }

        // setup the driver with serial settings
        log.debug("here1");
        this.control.stream.write("reset\n");
        this.control.stream.write(port + "\n");
        this.control.stream.write(baudRate.toString() + "\n");
        log.debug("here2");

        // request whether the driver successfully connected
        this.control.stream.write("connected\n");

        // check for successful connection
        this.status.stream.once("data", (data) => {
          if (data.toString() === "connected") {
            this.port = port;
            // get driver ready to accept pipe names
            this.control.stream.write("data pipes\n");

            // write the total number of pipes
            this.control.stream.write(this.inputStreamNames.length + "\n");
            this.control.stream.write(this.outputStreamNames.length + "\n");

            // write the names of all the command pipes
            for (let i = 0; i < this.inputStreamNames.length; i++) {
              this.control.stream.write(this.inputStreamNames[i] + "\n");
            }

            // write the names of all the telemetry pipes
            for (let i = 0; i < this.outputStreamNames.length; i++) {
              this.control.stream.write(this.outputStreamNames[i] + "\n");
            }

            // wait for all the pipes to successfully be created
            this.status.stream.once("data", (data) => {
              // check if the pipes were succcessfully created
              let success = data.toString() === "pipe creation successful";

              if (success) {
                // handle sending commands
                this.inputStreamNames.forEach((name) => {
                  let newStream = new PipeStream(name);
                  this.deviceInput.push(newStream);
                });

                // handle telemetry data
                this.outputStreamNames.forEach((name) => {
                  let newStream = new PipeStream(name);
                  newStream.on("data", (data) => {
                    try {
                      // anyone who wants data from this pipe will listen for this event
                      this.emit(name + "-data", data);
                    } catch (err) {
                      this.emit(
                        "error",
                        "Error receiving on " + name + ": " + err.message
                      );
                      log.debug("During error, received data: " + data);
                    }
                  });
                  this.deviceOutput.push(newStream);
                });

                // check if we actually created any pipes
                if (this.deviceInput.length + this.deviceOutput.length > 0) {
                  // wait for all pipes to be ready
                  this.waitReady(
                    this.deviceInput.concat(this.deviceOutput),
                    () => {
                      // tell the serial driver the ground station is ready
                      this.control.stream.write("interface ready\n");
                      this.emit("connected");
                      this.connected = true;
                      // resolve the promise
                      res(1);
                    }
                  );
                } else {
                  // otherwise resolve the promise
                  this.control.stream.write("interface ready\n");
                  this.emit("connected");
                  this.connected = true;
                  res(1);
                }
              } else {
                rej({ message: "Requested pipes could not be created" });
              }
            });
          } else {
            // recevied data will be the error
            rej({ message: data.toString() });
          }
        });
      } else {
        rej({ message: "serial driver has not started" });
      }
    });
  }

  /**
   * Writes data to an input pipe
   * @param {String} name the name of the input pipe to write to
   * @param {String} data the data to write to the pipe
   */
  write(name, data) {
    if (this.ready) {
      let stream = this.deviceInput.find((o) => o.name === name);
      if (stream) {
        stream.stream.write(data);

        log.debug("Wrote to stream " + name + ": " + data);
      } else {
        log.warn("Could not locate stream: " + name);
      }
    }
  }

  /**
   * Check if the serial driver is connected to the requested serial port
   * @returns {Promise<Object|Error>} whether the serial driver is connected, reject with error if one occurs
   */
  isConnected() {
    return new Promise((res, rej) => {
      if (this.ready) {
        this.control.stream.write("connected\n");
        this.status.stream.once("data", (data) => {
          this.connected = data.toString() === "connected";
          res({ path: this.port, connected: this.connected });
        });
      } else {
        rej("serial driver has not started");
      }
    });
  }

  /**
   * Reset the serial driver and close its Serial connection
   */
  reset() {
    if (this.ready) {
      this.control.stream.write("close\n");
      this.emit("close", this.port);
      this.connected = false;
      this.port = "";
    }
  }

  /**
   * Completely close the serial driver
   */
  close() {
    if (this.ready) this.control.stream.write("exit\n");
    else if (this.driver) this.driver.kill();
    else this.emit("exit"); // we only need to emit exit if the driver process doesn't exist
    // since there is a listener that will do this for us when it does

    this.ready = false;
    this.connected = false;
    this.port = "";
  }

  /**
   * Completely close and then relaunch the serial driver
   */
  reload() {
    if (this.ready) this.control.stream.write("exit\n");
    else if (this.driver) this.driver.kill();
    else this.emit("exit");

    if (this.ready || this.driver) {
      this.driver.once("exit", () => {
        this.ready = false;
        this.connected = false;
        this.port = "";
        this.setupDriver();
      });
    } else {
      this.ready = false;
      this.connected = false;
      this.port = "";
      this.setupDriver();
    }
  }
}

// create a default SerialDevice
const serial = new SerialDevice();

module.exports = {
  serial,
  SerialDevice,
};
