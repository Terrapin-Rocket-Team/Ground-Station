/**
 * A class to handling encoding and decoding of APRS messages
 */

/*
{
    "type": "APRSTelem",
    "deviceId": 3,
    "rssi": -45,
    "data": {
        "lat": 0.0,
        "lng": 0.0,
        "alt": 0.0,
        "spd": 0.0,
        "hdg": 0.0,
        "orient": [0.0, 0.0, 0.0],
        "stateFlags": 0
    }
}
*/
class APRSTelem {
  /**
   * @param {string|APRSMessage} message the APRS message
   * @param {string} [stream]
   */
  constructor(message, stream) {
    this.stream = stream;

    if (typeof message === "string") {
      message = JSON.parse(message);
    }

    this.deviceId = message.deviceId;
    this.latitude = message.data.lat;
    this.longitude = message.data.lng;
    this.altitude = message.data.alt;
    this.speed = message.data.spd;
    this.heading = message.data.hdg;
    this.orientation = message.data.orient;
    this.stateFlags = message.data.stateFlags;
    this.rssi = message.rssi; // TODO

    this.t0Date = new Date(); // maybe switch t0 to be more like received time
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
        deviceId: csvArr[1],
        rssi: csvArr[12],
        data: {
          lat: csvArr[2],
          lng: csvArr[3],
          alt: csvArr[4],
          spd: csvArr[5],
          hdg: csvArr[6],
          orient: [csv[7], csvArr[8], csvArr[9]],
          stateFlags: csvArr[10],
        },
      },
      csvArr[0]
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
    return this.getLatLongDecimal();
  }

  /**
   * @param {Boolean} [dms] set true to format in degress, minutes, seconds
   * @returns {string} string containing the latitude and longitude
   */
  getLatLongFormat(dms) {
    if (!dms) return this.getLatLongDecimalFormatted();
    return this.getLatLongDMS();
  }

  /**
   * @returns {Number[]} [latitude, longitude]
   */
  getLatLongDecimal() {
    return [
      this.getDegreesDecimal(this.lat),
      this.getDegreesDecimal(this.long),
    ];
  }

  /**
   * @returns {string} the latitude and longitude in decimal form formatted as a string
   */
  getLatLongDecimalFormatted() {
    // TODO lat and long are no longer strings
    return (
      this.getDegreesDecimal(this.latitude, true).toFixed(4) +
      "\u00b0 " +
      this.latitude.substring(this.latitude.length - 1, this.latitude.length) +
      "/" +
      this.getDegreesDecimal(this.longitude, true).toFixed(4) +
      "\u00b0 " +
      this.longitude.substring(this.longitude.length - 1, this.longitude.length)
    );
  }

  /**
   * @returns {string} the latitude and longitude in degress, minutes, seconds form as a string
   */
  getLatLongDMS() {
    // TODO lat and long are no longer strings
    return (
      this.getDegrees(this.latitude) +
      "\u00b0" +
      this.getMinutes(this.latitude) +
      "'" +
      this.getSeconds(this.latitude) +
      '"' +
      this.latitude.substring(this.latitude.length - 1, this.latitude.length) +
      " " +
      this.getDegrees(this.longitude) +
      "\u00b0" +
      this.getMinutes(this.longitude) +
      "'" +
      this.getSeconds(this.longitude) +
      '"' +
      this.longitude.substring(this.longitude.length - 1, this.longitude.length)
    );
  }
  /**
   * @param {string} coord string containing of the APRS formatted latitude or longitude
   * @param {boolean} [format] set to true to prevent use of negatives for West or South
   * @returns {number} latitude or longitude in the regular format
   */
  getDegreesDecimal(coord, format) {
    // TODO lat and long are no longer strings
    let dir = !format ? coord.substring(coord.length - 1, coord.length) : "";
    if (coord.length > 8) {
      return (
        (parseInt(coord.substring(0, 3)) +
          parseFloat(coord.substring(3, coord.length - 1)) / 60) *
        (dir === "S" || dir === "W" ? -1 : 1)
      );
    }
    return (
      (parseInt(coord.substring(0, 2)) +
        parseFloat(coord.substring(2, coord.length - 1)) / 60) *
      (dir === "S" || dir === "W" ? -1 : 1)
    );
  }

  /**
   * @param {string} coord string containing of the APRS formatted latitude or longitude
   * @returns {string} the degrees part of the coordinate
   */
  getDegrees(coord) {
    if (coord.length > 8) return coord.substring(0, 3);
    return coord.substring(0, 2);
  }

  /**
   * @param {string} coord string containing of the APRS formatted latitude or longitude
   * @returns {string} the minutes part of the coordinate
   */
  getMinutes(coord) {
    if (coord.length > 8) return coord.substring(3, 5);
    return coord.substring(2, 4);
  }

  /**
   * @param {string} coord string containing of the APRS formatted latitude or longitude
   * @returns {string} the seconds part of the coordinate
   */
  getSeconds(coord) {
    if (coord.length > 8) {
      return (parseFloat("0." + coord.substring(6, coord.length - 1)) * 60)
        .toFixed(0)
        .toString();
    }
    return (parseFloat("0." + coord.substring(5, coord.length - 1)) * 60)
      .toFixed(0)
      .toString();
  }

  /**
   * @returns {float} last updated altitude
   */
  getAlt() {
    return parseFloat(this.altitude);
  }

  /**
   * @returns {Number} last updated heading
   */
  getHeading() {
    return parseInt(this.heading);
  }

  /**
   * @returns {Number} last updated speed
   */
  getSpeed() {
    return parseFloat(this.speed);
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
  getT0() {
    return this.t0Date;
  }

  /**
   * @returns {Number} the T0 time in milliseconds
   */
  getT0ms() {
    return this.t0Date.getTime();
  }

  /**
   * @returns {String} High/Medium/Low/None signal strength, rssi range: >-60/-90<x<-60/-120<x<-90/<-120
   */
  getSignalStrength() {
    return this.rssi > -60
      ? "High"
      : this.rssi < -90 && this.rssi > -120
      ? "Low"
      : this.rssi > -90 && this.rssi < -60
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
  dateFromT0(time0) {
    return new Date( // 2
      new Date()
        .toString()
        .match(
          /[A-Z][a-z][a-z] [A-Z][a-z][a-z] [0-9][0-9] [0-9][0-9][0-9][0-9] /g
        )[0] +
        new Date( // 1
          new Date()
            .toISOString()
            .match(
              /^([+-][0-9][0-9])?[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T/g
            )[0] +
            time0 +
            "Z"
        ).toTimeString() // 1 - get local t0
    ); // 2 get local date and combine with local t0
  }

  /**
   * @returns {string} the APRS message object as a string
   */
  toString() {
    return `${this.stream}@${this.deviceId} | Latitude: ${
      this.latitude
    }, Longitude: ${this.longitude}, Altitude: ${this.altitude}, Speed: ${
      this.speed
    }, Heading: ${this.heading}, Orientation: [${this.orientation[0]},${
      this.orientation[1]
    },${this.orientation[2]}], State Flags: ${
      this.stateFlags
    }, T0: ${"T0"}, RSSI: ${this.rssi}\r\n`;
  }

  //convert lat/long to a better format
  toCSV(csvCreated) {
    let csv = "";
    if (!csvCreated) {
      csv =
        "Stream,Device ID,Latitude,Longitude,Altitude,Speed,Heading,OrientationX,OrientationY,OrientationZ,State Flags,T0,RSSI\r\n";
    }
    csv += `${this.stream},${this.deviceId},${this.latitude},${
      this.longitude
    },${this.altitude},${this.speed},${this.heading},${this.orientation[0]},${
      this.orientation[1]
    },${this.orientation[2]},${this.stateFlags},${"T0"},${this.rssi}\r\n`;
    return csv;
  }
}

module.exports = APRSTelem;
