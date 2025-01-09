/*
format from the Message library
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
        "stateFlags": 0
    }
}
*/

/**
 * A class to handling encoding and decoding of APRS messages
 */
class APRSTelem {
  /**
   * @param {string|object} message the APRS message
   * @param {string} [stream] the name of the stream
   * @param {Array<string>} [stateflagsFormat] the formatting of the state flags
   */
  constructor(message, stream, stateflagsFormat) {
    // log message time
    this.time = new Date();
    // check if stream was specified
    if (stream) {
      // assume the message is in the Message library format
      this.stream = stream;

      if (typeof message === "string") {
        message = JSON.parse(message);
      }

      this.deviceId = parseInt(message.deviceId);
      this.latitude = parseFloat(message.data.lat);
      this.longitude = parseFloat(message.data.lng);
      this.altitude = Math.round(parseFloat(message.data.alt));
      this.speed = Math.round(parseFloat(message.data.spd));
      this.heading = Math.round(parseFloat(message.data.hdg));
      this.orientation = [
        parseFloat(message.data.orient[0]),
        parseFloat(message.data.orient[1]),
        parseFloat(message.data.orient[2]),
      ];
      this.rawStateflags = parseInt(message.data.stateFlags);

      // must find stateflags
      if (stateflagsFormat) {
        this.findStateflags(stateflagsFormat);
      } else {
        this.stateflagsFormat = [];
        this.stateflags = [];
      }
    } else {
      // assume the message is in this object's format
      // basically copy constructor
      this.stream = message.stream;

      this.deviceId = parseInt(message.deviceId);
      this.latitude = parseFloat(message.latitude);
      this.longitude = parseFloat(message.longitude);
      this.altitude = Math.round(parseFloat(message.altitude));
      this.speed = Math.round(parseFloat(message.speed));
      this.heading = Math.round(parseFloat(message.heading));
      this.orientation = [
        parseFloat(message.orientation[0]),
        parseFloat(message.orientation[1]),
        parseFloat(message.orientation[2]),
      ];
      this.rawStateflags = parseInt(message.rawStateflags);
      this.stateflags = message.stateflags;
      this.stateflagsFormat = message.stateflagsFormat;
    }
  }

  findStateflags(stateflagsFormat) {
    this.stateflagsFormat = stateflagsFormat;
    this.stateflags = [];
    // find the encoding
    let encoding = [];
    this.stateflagsFormat.forEach((flag) => {
      let index = APRSTelem.stateflagList.findIndex((globalFlag) => {
        return globalFlag.name === flag;
      });

      if (index >= 0) {
        encoding.push(APRSTelem.stateflagList[index].width);
      } else {
        encoding.push(null);
      }
    });

    // parse each flag
    // find the total length in the encoding
    const totalLength = encoding.reduce((sum, val) => {
      return sum + val;
    }, 0);

    let lengthAdded = 0;
    for (let i = 0; i < encoding.length; i++) {
      // find each value and shift it to the right place
      if (encoding[i]) {
        this.stateflags.push(
          (this.rawStateflags >>> (totalLength - lengthAdded - encoding[i])) &
            ((1 << encoding[i]) - 1)
        );
        lengthAdded += encoding[i];
      } else {
        this.stateflags.push(null);
      }
    }
  }

  /**
   * Creates an APRS telemetry message from a single line of a CSV data file
   * @param {String} csvData a single line from a CSV file produced by APRSTelem.toCSV()
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

  static stateflagList = [];

  static createStateflagList(list) {
    // add each flag
    // don't want to modify the passed array
    APRSTelem.stateflagList = JSON.parse(JSON.stringify(list));
    return APRSTelem.stateflagList;
  }

  /**
   * @returns {Number} the orientation of the device as degrees about the Z axis
   */
  getOrientationZ() {
    return this.orientation[2];
  }

  /**
   * @returns {Number} the orientation of the device as degrees about the Y axis
   * */
  getOrientationY() {
    return this.orientation[1];
  }

  /**
   * @returns {Number} the orientation of the device as degrees about the X axis
   * */
  getOrientationX() {
    return this.orientation[0];
  }

  /**
   * @returns {Number[]} [latitude, longitude]
   */
  getLatLong() {
    return [this.latitude, this.longitude];
  }

  /**
   * @returns {String} the latitude and longitude in decimal form formatted as a string
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
   * @returns {String} the latitude and longitude in degress, minutes, seconds form as a string
   */
  getLatLongDMS() {
    // convert latitude to DMS
    let latDegrees = Math.floor(this.latitude),
      latMinutes = Math.floor(60 * (this.latitude - latDegrees)),
      latSeconds = Math.floor(
        60 * (60 * (this.latitude - latDegrees) - latMinutes)
      );
    // convert longitude to DMS
    let longDegrees = Math.floor(this.longitude),
      longMinutes = Math.floor(60 * (this.longitude - longDegrees)),
      longSeconds = Math.floor(
        60 * (60 * (this.longitude - longDegrees) - longMinutes)
      );
    // put it together
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
   * @returns {Number} the current altitude
   */
  getAlt() {
    return this.altitude;
  }

  /**
   * @returns {Number} the current heading
   */
  getHeading() {
    return this.heading;
  }

  /**
   * @returns {Number} the current speed
   */
  getSpeed() {
    return this.speed;
  }

  /**
   * @returns {Number} the flags of the device
   * */
  getRawFlags() {
    return this.rawStateflags;
  }

  getStateflag(flagName) {
    let index = this.stateflagsFormat.findIndex((name) => {
      return name === flagName;
    });
    if (index >= 0) return this.stateflags[index];
    else return null;
  }

  /**
   * @returns {String} the APRS message object as a string
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
    }`;
  }

  /**
   * @param {Boolean} firstLine whether to write the CSV header
   * @returns {string} the CSV string
   */
  toCSV(firstLine) {
    let csv = "";
    if (firstLine) {
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
