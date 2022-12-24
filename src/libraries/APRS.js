/**
 * A class to convert APRS message output from the LoRa APRS library to a JSON object
 */
class APRSMessage {
  /**
   *
   * @param {string|APRSMessage} message the APRS message
   *
   */
  constructor(message) {
    if (typeof message === "object") {
      this.src = message.src;
      this.dest = message.dest;
      this.path = message.path;
      this.type = message.type;
      this.rawBody = message.rawBody;
      this.body = new APRSBody(message.body);
    }
    if (typeof message === "string") {
      this.src = message.match(/(?<=Source: )[^,]+(?=,)/g)[0];
      this.dest = message.match(/(?<=Destination: )[^,]+(?=,)/g)[0];
      this.path = message.match(/(?<=Path: )[^,]+(?=,)/g)[0];
      this.type = message.match(/(?<=Type: )[^,]+(?=,)/g)[0];
      this.rawBody = message.match(/(?<=Data: ).+(?=LoRa)/g)[0];
      this.body = new APRSBody(this.rawBody);
    }
  }

  /**
   *
   * @returns {number[]} [latitude, longitude]
   */
  getLatLong() {
    return this.body.getLatLongDecimal();
  }

  /**
   *
   * @param {Boolean} [dms] set true to format in degress, minutes, seconds
   * @returns {string} string containing the latitude and longitude
   */
  getLatLongFormat(dms) {
    if (!dms) return this.body.getLatLongDecimalFormatted();
    return this.body.getLatLongDMS();
  }

  /**
   * @returns {float} last updated altitude
   */
  getAlt() {
    return parseFloat(this.body.alt);
  }

  /**
   * @returns {Number} last updated heading
   */
  getHeading() {
    return parseInt(this.body.heading);
  }

  /**
   * @returns {Number} last updated speed
   */
  getSpeed() {
    return parseFloat(this.body.speed);
  }

  /**
   *
   * @returns {string} the APRS message object as a string
   */
  toString() {
    return `Source: ${this.src}, Dest: ${this.dest}, Path: ${
      this.path
    }, Type: ${this.type}, Body: ${this.body.toString()}`;
  }
}

/**
 * A class to convert the body of the APRS message
 */
class APRSBody {
  /**
   *
   * @param {APRSBody|string} body the APRS body
   */
  constructor(body) {
    if (typeof body === "object") {
      this.lat = body.lat;
      this.long = body.long;
      this.heading = body.heading;
      this.speed = body.speed;
      this.alt = body.alt;
    }
    if (typeof body === "string") {
      this.lat = body.match(/(?<=!)[^\/]+(?=\/)/g)[0];
      this.long = body.match(/(?<=\/)[^\[]+(?=\[)/g)[0];
      this.heading = body.match(/(?<=\[)[^\/]+(?=\/)/g)[0];
      this.speed = body.match(/(?<=\/)[^\/\[]+(?=\/)/g)[0];
      this.alt = body.match(/(?<=A=).+$/g)[0];
    }
  }
  /**
   *
   * @param {string} rawBody
   * @returns {object} object with the same structure as an APRS body
   */
  decodeBody(rawBody) {
    //based on a specific radio module library, will not work with other libraries
    return {
      lat: rawBody.match(/(?<=!)[^\/]+(?=\/)/g)[0],
      long: rawBody.match(/(?<=\/)[^\[]+(?=\[)/g)[0],
      heading: rawBody.match(/(?<=\[)[^\/]+(?=\/)/g)[0],
      speed: rawBody.match(/(?<=\/)[^\/\[]+(?=\/)/g)[0],
      alt: rawBody.match(/(?<=A=).+$/g)[0],
    };
  }
  /**
   *
   * @returns {string} the APRS body object as a string
   */
  toString() {
    return `${this.getLatLongDecimalFormatted().replace(" ", "/")} and ${
      this.alt
    } at ${this.heading}\u00b0 ${this.speed} ft/s`;
  }

  /**
   *
   * @returns {Number[]} [latitude, longitude]
   */
  getLatLongDecimal() {
    return [
      this.getDegreesDecimal(this.lat),
      this.getDegreesDecimal(this.long),
    ];
  }

  /**
   *
   * @returns {string} the latitude and longitude in decimal form formatted as a string
   */
  getLatLongDecimalFormatted() {
    return (
      this.getDegreesDecimal(this.lat, true).toFixed(4) +
      "\u00b0 " +
      this.lat.substring(this.lat.length - 1, this.lat.length) +
      "/" +
      this.getDegreesDecimal(this.long, true).toFixed(4) +
      "\u00b0 " +
      this.long.substring(this.long.length - 1, this.long.length)
    );
  }

  /**
   *
   * @returns {string} the latitude and longitude in degress, minutes, seconds form as a string
   */
  getLatLongDMS() {
    return (
      this.getDegrees(this.lat) +
      "\u00b0" +
      this.getMinutes(this.lat) +
      "'" +
      this.getSeconds(this.lat) +
      '"' +
      this.lat.substring(this.lat.length - 1, this.lat.length) +
      " " +
      this.getDegrees(this.long) +
      "\u00b0" +
      this.getMinutes(this.long) +
      "'" +
      this.getSeconds(this.long) +
      '"' +
      this.long.substring(this.long.length - 1, this.long.length)
    );
  }
  /**
   *
   * @param {string} coord string containing of the APRS formatted latitude or longitude
   * @param {boolean} [format] set to true to prevent use of negatives for West or South
   * @returns {number} latitude or longitude in the regular format
   */
  getDegreesDecimal(coord, format) {
    let dir = !format ? coord.substring(coord.length - 1, coord.length) : "";
    if (coord.length > 8) {
      return (
        (parseInt(coord.substring(0, 3)) +
          parseInt(coord.substring(3, coord.length - 1)) / 60) *
        (dir === "S" || dir === "W" ? -1 : 1)
      );
    }
    return (
      (parseInt(coord.substring(0, 2)) +
        parseInt(coord.substring(2, coord.length - 1)) / 60) *
      (dir === "S" || dir === "W" ? -1 : 1)
    );
  }

  /**
   *
   * @param {string} coord string containing of the APRS formatted latitude or longitude
   * @returns {string} the degrees part of the coordinate
   */
  getDegrees(coord) {
    if (coord.length > 8) return coord.substring(0, 3);
    return coord.substring(0, 2);
  }

  /**
   *
   * @param {string} coord string containing of the APRS formatted latitude or longitude
   * @returns {string} the minutes part of the coordinate
   */
  getMinutes(coord) {
    if (coord.length > 8) return coord.substring(3, 5);
    return coord.substring(2, 4);
  }

  /**
   *
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
}
