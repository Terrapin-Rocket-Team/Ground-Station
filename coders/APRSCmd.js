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
  static commandList = [
    {
      name: "Pi Power On",
      abbrv: "PPO",
      syntax: "<time> <H/M/S>",
      num: 1,
      validator: (cmd) => {
        let args = cmd.trim().split(" ");
        if (args.length < 2) return false;
        try {
          let time = parseInt(args[1]);
          // use != to check if the user entered a float rather than an int
          if (time > 16383 || time != args[1]) return false;
        } catch (err) {
          return false;
        }
        if (args.length > 2) {
          let chr = args[2].toUpperCase();
          if (chr !== "H" && chr !== "M" && chr !== "S") return false;
        }
        return true;
      },
      parser: (cmd) => {
        // assume valid
        let args = cmd.trim().split(" ");
        // args structure:
        // 00 -> units (H=10,M=01,S=00)
        // 00000000000000 -> time value (max 16383)
        let unit = 0; // if only first arg given default to seconds
        if (args.length > 2) {
          let chr = args[2].toUpperCase();
          if (chr === "H") unit = 2;
          if (chr === "M") unit = 1;
          if (chr === "S") unit = 0;
        }

        let time = parseInt(args[1]);
        if (time > 16383) time = 16383;
        let argsVal = (unit << 14) + time;
        return argsVal;
      },
    },
    {
      name: "Pi Start Video",
      abbrv: "PSV",
      syntax: "<time> <H/M/S>",
      num: 2,
      validator: (cmd) => {
        let args = cmd.trim().split(" ");
        if (args.length < 2) return false;
        try {
          let time = parseInt(args[1]);
          if (time > 16383 || time != args[1]) return false;
        } catch (err) {
          return false;
        }
        if (args.length > 2) {
          let chr = args[2].toUpperCase();
          if (chr !== "H" && chr !== "M" && chr !== "S") return false;
        }
        return true;
      },
      parser: (cmd) => {
        // assume valid
        let args = cmd.trim().split(" ");
        // args structure:
        // 00 -> units (H=10,M=01,S=00)
        // 00000000000000 -> time value (max 16383)
        let unit = 0; // if only first arg given default to seconds
        if (args.length > 2) {
          let chr = args[2].toUpperCase();
          if (chr === "H") unit = 2;
          if (chr === "M") unit = 1;
          if (chr === "S") unit = 0;
        }

        let time = parseInt(args[1]);
        if (time > 16383) time = 16383;
        let argsVal = (unit << 14) + time;
        return argsVal;
      },
    },
    {
      name: "Record Launch Data",
      abbrv: "RLD",
      syntax: "<record?>",
      num: 3,
      validator: (cmd) => {
        let args = cmd.trim().split(" ");
        if (args.length < 2) return false;
        let str = args[1].toUpperCase();
        if (str !== "1" && str !== "TRUE" && str !== "0" && str !== "FALSE")
          return false;
        return true;
      },
      parser: (cmd) => {
        // assume valid
        let args = cmd.trim().split(" ");
        // args structure:
        // 000000000000000 -> not used
        // 0 -> whether data should be recorded (1=record, 0=don't record)
        let argsVal = 0;
        let str = args[1].toUpperCase();
        if (str === "1" || str === "TRUE") argsVal = 1;
        return argsVal;
      },
    },
    {
      name: "Restart Pi",
      abbrv: "RP",
      syntax: "N/A",
      num: 4,
      validator: (cmd) => {
        return true;
      },
      parser: (cmd) => {
        return 0;
      },
    },
    {
      name: "Frequency Hop",
      abbrv: "FH",
      syntax: "<frequency change (kHz)> <radio>",
      num: 5,
      validator: (cmd) => {
        let args = cmd.trim().split(" ");
        if (args.length < 2) return false;
        try {
          let dFreq = parseInt(args[1]);
          if (dFreq > 16383 || dFreq != args[1]) return false;
        } catch (err) {
          return false;
        }
        if (args.length > 2) {
          try {
            let id = parseInt(args[2]);
            if (id > 3 || id != args[2]) return false;
          } catch (err) {
            console.error(err);
            return false;
          }
        }
        return true;
      },
      parser: (cmd) => {
        // assume valid
        let args = cmd.trim().split(" ");
        // args structure:
        // 00 -> radio id [0-3]
        // 00000000000000 -> frequency change in kHz (max 16383)
        let id = 0; // if only first arg given default id of 0
        if (args.length > 2) {
          id = parseInt(args[2]);
          if (id > 3) id = 0; // if id is too high set to default
        }

        let dFreq = parseInt(args[1]);
        if (dFreq > 16383) dFreq = 16383;
        let argsVal = (unit << 14) + dFreq;
        return argsVal;
      },
    },
  ];

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
