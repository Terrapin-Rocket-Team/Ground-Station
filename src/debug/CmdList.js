/**
 * Class that holds a list of console commands
 */
class CmdList {
  /**
   * @param {Array<CmdNode>} commands The basis commands for the console
   */
  constructor(commands) {
    this.rootCommands = commands;
  }

  /**
   * Searches the command list for the specific command and executes that command
   * @param {Array<String>} cmd The command to be executed
   */
  executeCmd(cmd) {
    //print the command to the console
    if (cmd) printC(cmd.join(" "));
    //check if there are child commands to be processed
    if (cmd && cmd[0]) {
      let cmdFound = false;
      //loop through the root commands until one matches the first given command
      this.rootCommands.forEach((command) => {
        if (command.name === cmd[0]) {
          //remove the first command and traverse with the resulting array
          cmd.shift();
          command.traverse(cmd);
          cmdFound = true;
        }
      });
      // if the command cannot be found in the command list print an error
      if (!cmdFound) printE('Command "' + cmd[0] + '" not found');
    }
  }
}

/**
 * Class that represents a single node in the command list tree
 */
class CmdNode {
  /**
   * @param {String} name The name used to call the command
   * @param {String} description A short description of the purpose of the command
   * @param {Array<CmdNode>} children An array containing the child commands
   * @param {Function} action The function to call when the command is used
   */
  constructor(name, description, children, action) {
    this.name = name;
    this.description = description;
    this.children = children;
    this.action = action;
  }

  /**
   * Look through the tree to find and execute the correct string of commands
   * @param {Array<String>} cmd The command to be executed
   */
  traverse(cmd) {
    //check if there are remaining commands and whether this command has child commands
    if (cmd && cmd[0] && this.children) {
      let cmdFound = false;
      // loop through the child commands until one matches the first given command
      this.children.forEach((child) => {
        // if the name of the child is 1, the child command is really an input field, so don't remove the input
        if (child.name === 1) {
          child.traverse(cmd);
          cmdFound = true;
        } else if (child.name === cmd[0]) {
          // otherwise if the name matches remove the first command and continue traversing
          cmd.shift();
          child.traverse(cmd);
          cmdFound = true;
        }
      });
      // if the command cannot be found in the child command list print an error
      if (!cmdFound) printE('Command "' + cmd[0] + '" not found');
    } else {
      if (!this.action) {
        //if the command does not have an action, list its child commands in the console
        this.listChildren();
      } else if (this.name === 1) {
        // if the name of the command is 1 pass the first command (the input) as an argument to the command's action
        this.action(cmd[0]);
      } else {
        //otherwise just carry out the action
        this.action();
      }
    }
    return;
  }

  /**
   * Lists the child commands of the calling command node
   */
  listChildren() {
    printM(this.name + " : " + this.description, 1);
    if (this.children) {
      // loop through the command's children and print their name and description
      this.children.forEach((child) => {
        if (child.name !== 1) printM(child.name + " : " + child.description, 2);
      });
    }
  }
}

/**
 * Prints the command to the console when it is run
 * @param {String} message The command to to printed
 */
const printC = (message) => {
  printD({ message: "cmd > " + message, level: "debug" });
};

/**
 * Prints a message to the console
 * @param {String} message The message to be printed
 * @param {Number} indentLevel The amount of indent for the message
 */
const printM = (message, indentLevel) => {
  if (indentLevel < 1) indentLevel = 1;
  printD({
    message: "      " + "   ".repeat(indentLevel - 1) + message,
    level: "debug",
  });
};

/**
 * Prints an error message to the console
 * @param {String} message The error message to be printed
 */
const printE = (message) => {
  printD({ message: "      " + message, level: "error" });
};

//decide where to put this
let commands = [
  new CmdNode("help", "Lists possible commands", null, () => {
    printM("Available command types:", 1);
    printM("Type the name of a command for more information", 1);
    let length = commands.length;
    for (let i = 1; i < length; i++) {
      printM(commands[i].name + " - " + commands[i].description, 2);
    }
  }),
  new CmdNode("window", "Provides general app and window controls", [
    new CmdNode(
      "-reload",
      "Reloads debug window and closes serial port connections",
      null,
      () => {
        api.reload();
      }
    ),
    new CmdNode(
      "-clear",
      "Clears all messages from the console window",
      null,
      () => {
        let con = document.getElementById("debug-console");
        let len = con.childNodes.length;
        for (let i = 0; i < len - 2; i++) {
          con.removeChild(con.firstChild);
        }
      }
    ),
    new CmdNode("-devtools", "Opens the chromium devtools", null, () => {
      api.devTools();
    }),
    new CmdNode("-opengui", "Opens the ground station GUI", null, () => {
      api.openGUI();
    }),
  ]),
  new CmdNode("settings", "Change various app settings", [
    new CmdNode("-set", "Changes the settings specified by the next argument", [
      //need to sanitize inputs better
      new CmdNode("-scale", "Change the scale of the GUI window", [
        new CmdNode(1, 0, null, (cmd) => {
          config.scale = parseFloat(cmd);
        }),
      ]),
      new CmdNode("-debugScale", "The scale of the debug window", [
        new CmdNode(1, 0, null, (cmd) => {
          config.debugScale = parseFloat(cmd);
        }),
      ]),
      new CmdNode("-debug", "Turn debug mode on or off", [
        new CmdNode(1, 0, null, (cmd) => {
          if (cmd === "false" || cmd === "False") config.debug = false;
          if (cmd === "true" || cmd === "True") config.debug = true;
        }),
      ]),
      new CmdNode("-noGUI", "Turn the GUI window on or off", [
        new CmdNode(1, 0, null, (cmd) => {
          if (cmd === "false" || cmd === "False") config.noGUI = false;
          if (cmd === "true" || cmd === "True") config.noGUI = true;
        }),
      ]),
      new CmdNode("-maxCacheSize", "The maximum size of the map tile cache", [
        new CmdNode(1, 0, null, (cmd) => {
          config.maxCacheSize = parseInt(cmd);
        }),
      ]),
      new CmdNode("-baudRate", "The baud rate used for connecting via serial", [
        new CmdNode(1, 0, null, (cmd) => {
          config.baudRate = parseInt(cmd);
        }),
      ]),
    ]),
    new CmdNode("-save", "Save the current settings", null, () => {
      api.setSettings(config);
    }),
    new CmdNode("-scale", "The scale of the GUI window", null, () => {
      printM(String(config.scale), 1);
    }),
    new CmdNode("-debugScale", "The scale of the debug window", null, () => {
      printM(String(config.debugScale), 1);
    }),
    new CmdNode("-debug", "Turn debug mode on or off", null, () => {
      printM(String(config.debug), 1);
    }),
    new CmdNode("-noGUI", "Turn the GUI window on or off", null, () => {
      printM(String(config.noGUI), 1);
    }),
    new CmdNode(
      "-cacheMaxSize",
      "The maximum size of the map tile cache",
      null,
      () => {
        printM(String(config.cacheMaxSize), 1);
      }
    ),
    new CmdNode(
      "-baudRate",
      "The baud rate used for connecting via serial",
      null,
      () => {
        printM(String(config.baudRate), 1);
      }
    ),
  ]),
  new CmdNode("serial", "Controls the serial port connections", [
    new CmdNode(
      "-connect",
      "Connect to the serial port specified by the next argument",
      [
        new CmdNode(1, 0, null, (cmd) => {
          api.setPort(cmd);
        }),
      ]
    ),
    new CmdNode(
      "-disconnect",
      "Disconnect from the current serial port",
      null,
      () => {
        api.closePort();
      }
    ),
    new CmdNode("-status", "Status of the serial connection", null, () => {
      api.getPortStatus().then((status) => {
        if (status.connected) {
          printM('Serial is connected on port "' + status.port + '"', 1);
        } else {
          printM("Serial is disconnected", 1);
        }
      });
    }),
    new CmdNode("-list", "Lists available serial connections", null, () => {
      api.getPorts().then((ports) => {
        printM("Available ports: ", 1);
        if (ports.length > 0) {
          ports.forEach((port) => {
            printM(port.path, 2);
          });
        } else {
          printM("None", 2);
        }
      });
    }),
  ]),
];

const CMDS = new CmdList(commands);
