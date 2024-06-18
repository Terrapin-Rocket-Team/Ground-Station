const { SerialPort } = require("serialport");
const { APRSMessage } = require("./APRS");
const { EventEmitter } = require("node:events");
const { spawn } = require('child_process');
const fs = require("fs");


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
        this.cppApp = spawn('./serial/main.exe');

        this.cppApp.stdout.on('data', (data) => {
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

        const pipePath = '\\\\.\\pipe\\terpFcCommands';
        this.commandStream = fs.createWriteStream(pipePath, { encoding: 'utf-8' });

        this.commandStream.on('error', (err) => {
            console.error("error writing command to named pipe", err.message);
        });
        this.commandStream.write(port);

        // handle telemetry data
        const pipeStream = fs.createReadStream("\\\\.\\pipe\\terpTelemetry");

        pipeStream.on('data', (data) => {
            this.chunks3 += data;
            console.log(data);

            // lookahead APRS message filtering
            let resp = this.chunks3.match(/Source:.*?(?=(Source:|$))/g);
            console.log(`resp: ${resp}`);
            if (resp) {
                try {

                    console.log("Telemetry received: " + resp[0]);

                    // remove the processed data
                    this.chunks3 = this.chunks3.substring(resp[0].length);
                    this.emit("data", new APRSMessage(resp[0]));
                }
                catch (err) {
                    this.emit("error", this.chunks3);
                }
            }
        });

        pipeStream.on('error', (err) => {
            console.error("error writing to named pipe", err.message);
        });

        // return promise that just returns 1
        return new Promise((res, rej) => {
            this.connected = true;
            res(1);
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

module.exports = {
    radio,
    Radio
};