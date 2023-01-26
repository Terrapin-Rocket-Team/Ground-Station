const { SerialPort } = require("serialport");
const { APRSMessage } = require("./APRS");
const { EventEmitter } = require("node:events");

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
    this.chunks = "";
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
      if (!baudRate) baudRate = 115200;
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

      //if the port is successfully open resolve the promise
      this.port.on("open", () => {
        res(1);
      });

      //get data from the serial port, and, once a full message has been recieved, emit the data with the data event
      this.port.on("data", (data) => {
        this.chunks += data.toString();
        if (this.chunks.match(/^s\r\nSource:.+\r\ne\r\n/g)) {
          let msg = new APRSMessage(this.chunks.split("\r\n")[1]);
          this.emit("data", msg);
          this.chunks = "";
        }
      });

      //if the serial port is disconnected, emit the close event
      this.port.on("close", () => {
        this.emit("close");
      });
    });
  }

  close() {
    if (this.port) {
      this.port.close();
      this.port = null;
    }
  }
}

const radio = new Radio();

module.exports = { radio, Radio };
