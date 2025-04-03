/*
format from the Message library
{
    "type": "APRSCmd",
    "deviceId": 3
    "data": {
        "cmd": 0,
        "args": 0
    }
}
*/

/**
 * A class to handling encoding and decoding of APRS messages
 */
class APRSCmd {
  /**
   * @param {string|object} command the APRS command
   */
  constructor(command) {
    // log message time
    this.time = new Date();

    // allow the user to load command data in later using loadCmd()
    if (typeof command === "string") {
      command = JSON.parse(command);
    }

    this.deviceId = parseInt(command.deviceId);
    this.cmd = parseInt(command.data.cmd);
    this.args = parseInt(command.data.args);
  }

  // list of commands, translations, and parsing functions, stored here for now
  static commandList = [];

  static createCommandList(list) {
    // reset command list
    APRSCmd.commandList = [];
    // add each command
    // don't want to modify the passed array
    JSON.parse(JSON.stringify(list)).forEach((command) => {
      command.validator = APRSCmd.assembleValidator(command);
      command.parser = APRSCmd.assembleParser(command);
      APRSCmd.commandList.push(command);
    });
    return APRSCmd.commandList;
  }

  static assembleValidator(command) {
    // if no args there is nothing to validate
    if (command.syntax.length === 0)
      return (cmdText) => {
        return true;
      };
    // otherwise figure out which validator should be used for which arg
    const syntaxValidators = [];
    for (let i = 0; i < command.syntax.length; i++) {
      if (command.type[i] === "bool") {
        syntaxValidators.push((arg) => {
          let str = arg.toUpperCase();
          if (str !== "1" && str !== "TRUE" && str !== "0" && str !== "FALSE")
            return false;
          return true;
        });
      } else if (command.type[i] === "num") {
        syntaxValidators.push((arg) => {
          try {
            let num = parseInt(arg);
            // purposeful use of != instead of !== to compare the arg string to the num
            if (num > Math.pow(2, command.encoding[i]) - 1 || num != arg)
              return false;
          } catch (err) {
            return false;
          }
          return true;
        });
      } else if (command.type[i] === "string") {
        syntaxValidators.push((arg) => {
          for (let j = 0; j < command.conversionList[i].length; j++) {
            if (arg === command.conversionList[i][j]) return true;
          }
          return false;
        });
      } else {
        // could not find the proper validator type
        syntaxValidators.push((arg) => {
          return false;
        });
      }
    }
    return (cmdText) => {
      let args = cmdText.trim().split(" ");
      args.shift();
      if (args.length < command.syntax.length) return false;
      for (let i = 0; i < syntaxValidators.length; i++) {
        // call each validator for the corresponding arg
        if (!syntaxValidators[i](args[i])) return false;
      }
      return true;
    };
  }

  static assembleParser(command) {
    // if no args there is nothing to parse
    if (command.syntax.length === 0)
      return (cmdText) => {
        return 0;
      };
    // otherwise figure out which parser should be used for which arg
    const syntaxParsers = [];
    for (let i = 0; i < command.syntax.length; i++) {
      if (command.type[i] === "bool") {
        syntaxParsers.push((arg) => {
          let argVal = 0;
          let str = arg.toUpperCase();
          if (str === "1" || str === "TRUE") argVal = 1;
          return argVal;
        });
      }
      if (command.type[i] === "num") {
        syntaxParsers.push((arg) => {
          try {
            let num = parseInt(arg);
            if (num > Math.pow(2, command.encoding[i]) - 1)
              num = Math.pow(2, command.encoding[i]) - 1;
            return num;
          } catch (err) {
            return 0;
          }
        });
      }
      if (command.type[i] === "string") {
        syntaxParsers.push((arg) => {
          for (let j = 0; j < command.conversionList[i].length; j++) {
            if (arg === command.conversionList[i][j]) return j + 1; // avoid sending args = 0
          }
          return 0;
        });
      }
    }
    // find the total length in the encoding
    const totalLength = command.encoding.reduce((sum, val) => {
      return sum + val;
    }, 0);
    return (cmdText) => {
      // assume valid
      let args = cmdText.trim().split(" ");
      args.shift();

      let argNum = 0;

      let lengthAdded = 0;
      for (let i = 0; i < syntaxParsers.length; i++) {
        // find each value and shift it to the right place
        argNum +=
          syntaxParsers[i](args[i]) <<
          (totalLength - lengthAdded - command.encoding[i]);
        lengthAdded += command.encoding[i];
      }
      return argNum;
    };
  }

  /**
   * @returns {Array} the list of available commands
   */
  static getCommandList() {
    return APRSCmd.commandList;
  }

  /**
   * Creates an APRS command message from a single line of a CSV data file
   * @param {String} csvData a single line from a CSV file produced by APRSCmd.toCSV()
   * @returns {APRSCmd} the APRS command corresponding to the input line
   */
  static fromCSV(csvData) {
    let csvArr = csvData.split(",");
    return new APRSCmd({
      deviceId: csvArr[1],
      data: {
        cmd: csvArr[2],
        args: csvArr[3],
      },
    });
  }

  /**
   * Parses a command from a string and loads it into the object's cmd and args attributes
   * @param {String} str the command as a shortened string
   * @returns whether the command was successfully parsed
   */
  loadCmd(str) {
    let cmdAbbrv = str.trim().split(" ")[0];
    for (let i = 0; i < APRSCmd.commandList.length; i++) {
      let cmdName = APRSCmd.commandList[i].abbrv + ":";
      // check if current abbreviation matches the input
      if (cmdName === cmdAbbrv) {
        // check if syntax is valid
        // if invalid return false
        if (!APRSCmd.commandList[i].validator(str)) return false;
        this.cmd = APRSCmd.commandList[i].num;
        this.args = APRSCmd.commandList[i].parser(str);
        return true;
      }
    }
  }

  /**
   * @returns {Object} the command object in the Message library format
   */
  toJSON() {
    return {
      deviceId: this.deviceId,
      data: {
        cmd: this.cmd.toString(16),
        args: this.args.toString(16),
      },
    };
  }

  /**
   * @returns {String} the command object as a string
   */
  toString() {
    let c = APRSCmd.commandList.find((command) => {
      return this.cmd === command.num;
    });
    return `Device ${this.deviceId} | ${c.name}: 0x${this.args.toString(16)}`;
  }

  /**
   * @param {Boolean} firstLine whether to write the CSV header
   * @returns {string} the CSV string
   */
  toCSV(firstLine) {
    let csv = "";
    if (firstLine) {
      csv = "Time,Device ID,Cmd,Args\n";
    }
    csv += `${this.time.toISOString().split("T")[1]},${this.deviceId},${
      this.cmd
    },${this.args}\n`;
    return csv;
  }
}

if (
  typeof window === "undefined" ||
  (typeof exports !== "undefined" && this === exports && exports !== window)
)
  module.exports = APRSCmd;
