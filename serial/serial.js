const { SerialPort } = require("serialport");
const { APRSMessage } = require("./APRS");
const { EventEmitter } = require("node:events");

class Radio extends EventEmitter {
  constructor(port) {
    super();
    this.port = port ? port : {};
    this.chunks = "";
  }
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
  connect(port, baudRate) {
    return new Promise((res, rej) => {
      //115200
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

module.exports = { radio };
