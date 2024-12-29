/**
 * A class to handling encoding and decoding of Ground Station radio metrics
 */
class Metrics {
  /**
   * @param {object|string} metrics the metrics data
   */
  constructor(metrics) {
    // log message time
    this.time = new Date();

    if (typeof metrics === "string") {
      metrics = JSON.parse(metrics);
    }

    this.deviceId = parseInt(metrics.deviceId);
    this.bitrate = parseFloat(metrics.bitrate);
    this.rssi = parseInt(metrics.rssi);
  }

  /**
   * Creates an Metrics object from a single line of a CSV data file
   * @param {String} csvData a single line from a CSV file produced by Metrics.toCSV()
   * @returns {Metrics} the Metrics object corresponding to the input line
   */
  static fromCSV(csvData) {
    let csvArr = csvData.split(",");
    return new Metrics({
      deviceId: csvArr[1],
      bitrate: csvArr[2],
      rssi: csvArr[3],
    });
  }

  /**
   * @param {String} [scale] if given, converts the bitrate to the given units (supports: k, M)
   * @returns {Number} the bitrate in the given units
   */
  getBitrate(scale) {
    if (!scale) {
      return this.bitrate;
    }
    if (scale === "k") {
      return this.bitrate / 1000;
    }
    if (scale === "M") {
      return this.bitrate / 1e6;
    }
  }

  /**
   * @returns {String} High/Medium/Low/None signal strength, rssi ranges: >-60 / -90<x<-60 / -120<x<-90 / <-120
   */
  getSignalStrength() {
    return this.rssi > -60
      ? "High"
      : this.rssi <= -90 && this.rssi > -120
      ? "Low"
      : this.rssi <= -60 && this.rssi > -90
      ? "Med"
      : "None";
  }

  /**
   * @returns {Number} the current RSSI
   */
  getRSSI() {
    return this.rssi;
  }

  /**
   * @returns {String} the Metrics object as a string
   */
  toString() {
    return `Device ${this.deviceId} | ${this.rssi} dBm @ ${this.getBitrate(
      "k"
    )} kbps`;
  }

  /**
   * @param {Boolean} firstLine whether to write the CSV header
   * @returns {string} the CSV string
   */
  toCSV(firstLine) {
    let csv = "";
    if (firstLine) {
      csv = "Time,Device ID,Bitrate,RSSI\n";
    }
    csv += `${this.time.toISOString().split("T")[1]},${this.deviceId},${
      this.bitrate
    },${this.rssi}\n`;
    return csv;
  }
}

if (
  typeof window === "undefined" ||
  (typeof exports !== "undefined" && this === exports && exports !== window)
)
  module.exports = Metrics;
