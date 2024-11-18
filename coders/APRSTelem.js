/**
 * A class to handling encoding and decoding of APRS messages
 */

/*
{
    "type": "APRSTelem",
    "deviceId": 3,
    "data": {
        "lat": 0.0,
        "lng": 0.0,
        "alt": 0.0,
        "spd": 0.0,
        "hdg": 0.0,
        "orient": [0.0, 0.0, 0.0],
        "stateFlags": 0,
        "state": {
          ...
        }
    }
}
*/
class APRSTelem {
  /**
   * @param {string|object} message the APRS message
   * @param {string} [stream]
   */
  constructor(message, stream) {
    this.time = new Date();
    if (stream) {
      this.stream = stream;

      if (typeof message === "string") {
        message = JSON.parse(message);
      }

      this.deviceId = message.deviceId;
      this.latitude = parseFloat(message.data.lat);
      this.longitude = parseFloat(message.data.lng);
      this.altitude = parseFloat(message.data.alt);
      this.speed = parseFloat(message.data.spd);
      this.heading = parseFloat(message.data.hdg);
      this.orientation = [
        parseFloat(message.data.orient[0]),
        parseFloat(message.data.orient[1]),
        parseFloat(message.data.orient[2]),
      ];
      this.stateFlags = parseInt(message.data.stateFlags);
    } else {
      this.stream = message.stream;

      this.deviceId = message.deviceId;
      this.latitude = parseFloat(message.latitude);
      this.longitude = parseFloat(message.longitude);
      this.altitude = parseFloat(message.altitude);
      this.speed = parseFloat(message.speed);
      this.heading = parseFloat(message.heading);
      this.orientation = [
        parseFloat(message.orientation[0]),
        parseFloat(message.orientation[1]),
        parseFloat(message.orientation[2]),
      ];
      this.stateFlags = parseInt(message.stateFlags);
    }
  }

  /**
   * Creates an APRS telemetry message from a single line of a CSV data file
   * @param {string} csvData a single line from a CSV file produced by APRSTelem.toCSV()
   * @returns {APRSTelem} the APRS telemetry corresponding to the input line
   */
  static fromCSV(csvData) {
    let csvArr = csvData.split(",");
    return new APRSTelem(
      {
        deviceId: csvArr[2],
        data: {
          lat: csvArr[3],
          lng: csvArr[4],
          alt: csvArr[5],
          spd: csvArr[6],
          hdg: csvArr[7],
          orient: [csvArr[8], csvArr[9], csvArr[10]],
          stateFlags: csvArr[11],
        },
      },
      csvArr[1]
    );
  }

  /**
   * @returns {number} the orientation of the device as degrees about the Z axis
   */
  getOrientationZ() {
    return this.orientation[2];
  }

  /**
   * @returns {number} the orientation of the device as degrees about the Y axis
   * */
  getOrientationY() {
    return this.orientation[1];
  }

  /**
   * @returns {number} the orientation of the device as degrees about the X axis
   * */
  getOrientationX() {
    return this.orientation[0];
  }

  /**
   * @returns {string} the flags of the device
   * */
  getFlags() {
    return this.stateFlags;
  }

  /**
   * @returns {number[]} [latitude, longitude]
   */
  getLatLong() {
    return [this.latitude, this.longitude];
  }

  /**
   * @returns {string} the latitude and longitude in decimal form formatted as a string
   */
  getLatLongDecimal(br) {
    return (
      Math.abs(this.latitude).toFixed(4) +
      "\u00b0 " +
      (this.latitude >= 0 ? "N" : "S") +
      "/" +
      (br ? "<br>" : "") +
      Math.abs(this.longitude).toFixed(4) +
      "\u00b0 " +
      (this.longitude > 0 ? "E" : "W")
    );
  }

  /**
   * @returns {string} the latitude and longitude in degress, minutes, seconds form as a string
   */
  getLatLongDMS() {
    let latDegrees = Math.floor(this.latitude),
      latMinutes = Math.floor(60 * (this.latitude - latDegrees)),
      latSeconds = Math.floor(
        60 * (60 * (this.latitude - latDegrees) - latMinutes)
      );
    let longDegrees = Math.floor(this.longitude),
      longMinutes = Math.floor(60 * (this.longitude - longDegrees)),
      longSeconds = Math.floor(
        60 * (60 * (this.longitude - longDegrees) - longMinutes)
      );
    return (
      Math.abs(latDegrees) +
      "\u00b0" +
      Math.abs(latMinutes) +
      "'" +
      Math.abs(latSeconds) +
      '"' +
      (this.latitude > 0 ? "N" : "S") +
      " " +
      Math.abs(longDegrees) +
      "\u00b0" +
      Math.abs(longMinutes) +
      "'" +
      Math.abs(longSeconds) +
      '"' +
      (this.longitude > 0 ? "E" : "W")
    );
  }

  /**
   * @returns {float} last updated altitude
   */
  getAlt() {
    return this.altitude;
  }

  /**
   * @returns {Number} last updated heading
   */
  getHeading() {
    return this.heading;
  }

  /**
   * @returns {Number} last updated speed
   */
  getSpeed() {
    return this.speed;
  }

  /**
   * @returns {String} the current stage in the form s(index), ex: s0
   */
  getStage() {
    // stage is the first state flag (should probably be part of Message, leaving this here for now)
    return this.stateFlags.toString()[0];
  }

  /**
   * @returns {Number} the current stage number
   */
  getStageNumber() {
    return parseInt(this.stateFlags.toString()[0]);
  }

  /**
   * @returns {Date} a Date object containing the date of T0
   */
  // getT0() {
  //   return this.t0Date;
  // }

  /**
   * @returns {Number} the T0 time in milliseconds
   */
  // getT0ms() {
  //   return this.t0Date.getTime();
  // }

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
   * Creates a Date object from a t0 time in UTC
   * @returns {Date} the Date object
   */
  // dateFromT0(time0) {
  //   return new Date( // 2
  //     new Date()
  //       .toString()
  //       .match(
  //         /[A-Z][a-z][a-z] [A-Z][a-z][a-z] [0-9][0-9] [0-9][0-9][0-9][0-9] /g
  //       )[0] +
  //       new Date( // 1
  //         new Date()
  //           .toISOString()
  //           .match(
  //             /^([+-][0-9][0-9])?[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T/g
  //           )[0] +
  //           time0 +
  //           "Z"
  //       ).toTimeString() // 1 - get local t0
  //   ); // 2 get local date and combine with local t0
  // }

  /**
   * @returns {string} the APRS message object as a string
   */
  toString() {
    return `${this.time.toISOString().split("T")[1]} ${this.stream}@${
      this.deviceId
    } | Latitude: ${this.latitude}, Longitude: ${this.longitude}, Altitude: ${
      this.altitude
    }, Speed: ${this.speed}, Heading: ${this.heading}, Orientation: [${
      this.orientation[0]
    },${this.orientation[1]},${this.orientation[2]}], State Flags: ${
      this.stateFlags
    }\n`;
  }

  //convert lat/long to a better format
  toCSV(csvCreated) {
    let csv = "";
    if (!csvCreated) {
      csv =
        "Time,Stream,Device ID,Latitude,Longitude,Altitude,Speed,Heading,OrientationX,OrientationY,OrientationZ,State Flags\n";
    }
    csv += `${this.time.toISOString().split("T")[1]},${this.stream},${
      this.deviceId
    },${this.latitude},${this.longitude},${this.altitude},${this.speed},${
      this.heading
    },${this.orientation[0]},${this.orientation[1]},${this.orientation[2]},${
      this.stateFlags
    }\n`;
    return csv;
  }
}

if (
  typeof window === "undefined" ||
  (typeof exports !== "undefined" && this === exports && exports !== window)
)
  module.exports = APRSTelem;
