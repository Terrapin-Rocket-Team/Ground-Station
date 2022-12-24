const { SerialPort } = require("serialport");
const { APRSMessage } = require("./APRS");
const { EventEmitter } = require("node:events");

/**
 * A class to communicate with the radio module using serialport
 */
class Radio extends EventEmitter {
  /**
   *
   * @param {SerialPort} [port] the serial port to listen to
   */
  constructor(port) {
    super();
    this.port = port ? port : {};
    this.chunks = "";
  }

  /**
   *
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
   *
   * @param {string} port the serial port to connect to
   * @param {number} baudRate the baud rate of the connected device
   * @returns {Promise<Number|Error>} 1 if the port was successfully connected, otherwise rejects with the error
   */
  connect(port, baudRate) {
    return new Promise((res, rej) => {
      if (!baudRate) baudRate = 115200;
      this.port = new SerialPort(
        {
          path: port,
          baudRate,
        },
        (err) => {
          if (err) rej(err);
        }
      );
      this.port.on("open", () => {
        res(1);
      });
      this.port.on("data", (data) => {
        this.chunks += data.toString().replace(/\n/g, "");
        if (this.chunks.match(/Source: .+!w.+!/g)) {
          let msg = new APRSMessage(this.chunks);
          this.emit("data", msg);
          this.chunks = "";
        }
      });
    });
  }
}

const radio = new Radio();

module.exports = { radio, Radio };
