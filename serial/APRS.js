class APRSMessage {
  constructor(message) {
    this.src = message.match(/(?<=Source: )[^,]+(?=,)/g)[0];
    this.dest = message.match(/(?<=Destination: )[^,]+(?=,)/g)[0];
    this.path = message.match(/(?<=Path: )[^,]+(?=,)/g)[0];
    this.type = message.match(/(?<=Type: )[^,]+(?=,)/g)[0];
    this.rawBody = message.match(/(?<=Data: ).+(?=LoRa)/g)[0];
    this.body = new APRSBody(this.rawBody);
  }

  getLatLong() {
    return this.body.getLatLongDecimal();
  }

  getLatLongFormat(dms) {
    if (!dms) return this.body.getLatLongDecimalFormatted();
    return this.body.getLatLongDMS();
  }

  toString() {
    return `Source: ${this.src}, Dest: ${this.dest}, Path: ${
      this.path
    }, Type: ${this.type}, Body: ${this.body.toString()}`;
  }
}

class APRSBody {
  constructor(rawBody) {
    this.lat = rawBody.match(/(?<=!)[^\/]+(?=\/)/g)[0];
    this.long = rawBody.match(/(?<=\/)[^\[]+(?=\[)/g)[0];
    this.heading = rawBody.match(/(?<=\[)[^\/]+(?=\/)/g)[0];
    this.speed = rawBody.match(/(?<=\/)[^\/\[]+(?=\/)/g)[0];
    this.alt = rawBody.match(/(?<=A=).+$/g)[0];
  }
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
  toString() {
    return `${this.getLatLongDecimalFormatted().replace(" ", "/")} and ${
      this.alt
    } at ${this.heading}\u00b0 ${this.speed} ft/s`;
  }
  getLatLongDecimal() {
    return [
      this.getDegreesDecimal(this.lat),
      this.getDegreesDecimal(this.long),
    ];
  }
  getLatLongDecimalFormatted() {
    return (
      this.getDegreesDecimal(this.lat, true).toFixed(4) +
      "\u00b0" +
      this.lat.substring(this.lat.length - 1, this.lat.length) +
      " " +
      this.getDegreesDecimal(this.long, true).toFixed(4) +
      "\u00b0" +
      this.long.substring(this.long.length - 1, this.long.length)
    );
  }
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
  getDegrees(coord) {
    if (coord.length > 8) return coord.substring(0, 3);
    return coord.substring(0, 2);
  }
  getMinutes(coord) {
    if (coord.length > 8) return coord.substring(3, 5);
    return coord.substring(2, 4);
  }
  getSeconds(coord) {
    if (coord.length > 8) {
      return (
        parseFloat("0." + coord.substring(6, coord.length - 1)) * 60
      ).toFixed(0);
    }
    return (
      parseFloat("0." + coord.substring(5, coord.length - 1)) * 60
    ).toFixed(0);
  }
}

module.exports = { APRSMessage, APRSBody };
