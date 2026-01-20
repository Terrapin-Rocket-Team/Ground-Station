/*
format from the RadioMessage library
{
    "type": "GSControl",
    "deviceId": 3
    "data": {
        "valid": 0,
        "cmd": "",
        "args": ""
    }
}
*/

/**
 * A class to handle encoding and decoding of APRS messages
 */
class GSControl {
  /**
   * @param {string|object} control the Ground Station control command
   */
  constructor(control) {
    // log message time
    this.time = new Date();

    // allow the user to load control data in later using loadCmd()
    if (typeof control === "string") {
      control = JSON.parse(command);
    }

    this.deviceId = parseInt(control.deviceId);
    this.valid = parseInt(control.data.valid);
    this.cmd = control.data.cmd;
    this.args = control.data.args;
  }

  // list of control commands, translations, and parsing functions, stored here for now
  static controlList = [];

  static createControlList(list) {
    // reset control command list
    GSControl.controlList = [];
    // add each control command
    // don't want to modify the passed array
    JSON.parse(JSON.stringify(list)).forEach((control) => {
      control.validator = GSControl.assembleValidator(control);
      GSControl.controlList.push(control);
    });
    return GSControl.controlList;
  }

  static assembleValidator(control) {
    // if no args there is nothing to validate
    if (control.syntax.length === 0)
      return (ctrlText) => {
        return true;
      };
    // otherwise figure out which validator should be used for which arg
    const syntaxValidators = [];
    for (let i = 0; i < control.syntax.length; i++) {
      if (control.values[i].length > 0) {
        // empty string means any arg is valid
        if (control.values[i].length >= 1 && control.values[i][0] === "")
          syntaxValidators.push((arg) => {
            return true;
          });
        // there is a list of valid args we need to validate against
        else
          syntaxValidators.push((arg) => {
            return control.values[i].includes(arg);
          });
      } else {
        // there is an issue with the JSON
        // there is a arg in syntax that doesn't have an array in values
        // this is always invalid
        syntaxValidators.push((arg) => {
          return false;
        });
      }
    }
    return (ctrlText) => {
      let args = ctrlText.trim().split(" ");
      args.shift();
      if (args.length < control.syntax.length) return false;
      for (let i = 0; i < syntaxValidators.length; i++) {
        // call each validator for the corresponding arg
        if (!syntaxValidators[i](args[i])) return false;
      }
      return true;
    };
  }

  /**
   * @returns {Array} the list of available control commands
   */
  static getControlList() {
    return GSControl.controlList;
  }

  /**
   * Creates an GSControl command message from a single line of a CSV data file
   * @param {String} csvData a single line from a CSV file produced by GSControl.toCSV()
   * @returns {GSControl} the GSControl command corresponding to the input line
   */
  static fromCSV(csvData) {
    let csvArr = csvData.split(",");
    return new GSControl({
      deviceId: csvArr[1],
      data: {
        valid: csvArr[2],
        cmd: csvArr[3],
        args: csvArr[4],
      },
    });
  }

  /**
   * Parses a control command from a string and loads it into the object's cmd and args attributes
   * @param {String} str the command as a shortened string
   * @returns whether the command was successfully parsed
   */
  loadCtrl(str) {
    let control = str.trim().split(" ")[0];
    for (let i = 0; i < GSControl.controlList.length; i++) {
      let ctrlName = GSControl.controlList[i].name;
      // check if current abbreviation matches the input
      if (ctrlName === control) {
        // check if syntax is valid
        // if invalid return false
        if (!GSControl.controlList[i].validator(str)) return false;
        this.cmd = GSControl.controlList[i].name;
        let args = str.trim().split(" ");
        args.shift();
        this.args = args.join(" ");
        return true;
      }
    }
  }

  /**
   * @returns {Object} the command object in the RadioMessage library format
   */
  toJSON() {
    return {
      type: "GSControl",
      deviceId: this.deviceId,
      data: {
        valid: this.valid,
        cmd: this.cmd,
        args: this.args,
      },
    };
  }

  /**
   * @returns {String} the control command object as a string
   */
  toString() {
    return `Device ${this.deviceId} | ${this.cmd} ${this.args}`;
  }

  /**
   * @param {Boolean} firstLine whether to write the CSV header
   * @returns {string} the CSV string
   */
  toCSV(firstLine) {
    let csv = "";
    if (firstLine) {
      csv = "Time,Device ID,Valid,Command,Args\n";
    }
    csv += `${this.time.toISOString().split("T")[1]},${this.deviceId},
    ${this.valid},${this.cmd},${this.args}\n`;
    return csv;
  }
}

if (
  typeof window === "undefined" ||
  (typeof exports !== "undefined" && this === exports && exports !== window)
)
  module.exports = GSControl;
