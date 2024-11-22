/**
 * A class to handling encoding and decoding of Ground Station radio metrics
 */
class Metrics {
  constructor(metrics) {
    this.time = new Date();

    if (typeof metrics === "string") {
      metrics = JSON.parse(metrics);
    }

    this.bitrate = parseFloat(metrics.bitrate);
    this.rssi = parseInt(metrics.rssi);
    this.deviceId = metrics.deviceId;
  }

  static fromCSV(csvData) {
    let csvArr = csvData.split(",");
    return new Metrics({
      deviceId: csvArr[1],
      bitrate: csvArr[2],
      rssi: csvArr[3],
    });
  }

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
   * @returns {String} High/Medium/Low/None signal strength, rssi range: >-60/-90<x<-60/-120<x<-90/<-120
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

  getRSSI() {
    return this.rssi;
  }

  /**
   * @returns {string} the APRS message object as a string
   */
  toString() {
    return `Device ${this.deviceId} | ${this.rssi} dBm @ ${this.getBitrate(
      "k"
    )} kbps`;
  }

  //convert lat/long to a better format
  toCSV(csvCreated) {
    let csv = "";
    if (!csvCreated) {
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
