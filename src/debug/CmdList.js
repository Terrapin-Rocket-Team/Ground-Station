class CmdList {
  constructor(commands) {
    this.rootCommands = commands;
  }
  executeCmd(cmd) {
    if (cmd) printC(cmd.join(" "));
    if (cmd && cmd[0]) {
      let cmdFound = false;
      this.rootCommands.forEach((command) => {
        if (command.name === cmd[0]) {
          cmd.shift();
          command.traverse(cmd);
          cmdFound = true;
        }
      });
      if (!cmdFound) printE('Command "' + cmd[0] + '" not found');
    }
  }
}

class CmdNode {
  constructor(name, description, children, action) {
    this.name = name;
    this.description = description;
    this.children = children;
    this.action = action;
  }

  traverse(cmd) {
    if (cmd && cmd[0] && this.children) {
      let cmdFound = false;
      this.children.forEach((child) => {
        if (child.name === 1) {
          child.traverse(cmd);
          cmdFound = true;
        } else if (child.name === cmd[0]) {
          cmd.shift();
          child.traverse(cmd);
          cmdFound = true;
        }
      });
      if (!cmdFound) printE('Command "' + cmd[0] + '" not found');
    } else {
      if (!this.action) {
        this.listChildren();
      } else if (this.name === 1) {
        this.action(cmd[0]);
      } else {
        this.action();
      }
    }
    return;
  }

  listChildren() {
    printM(this.name + " : " + this.description, 1);
    if (this.children) {
      this.children.forEach((child) => {
        if (child.name !== 1) printM(child.name + " : " + child.description, 2);
      });
    }
  }
}

const printC = (message) => {
  printD({ message: "cmd > " + message, level: "debug" });
};

const printM = (message, indentLevel) => {
  if (indentLevel < 1) indentLevel = 1;
  printD({
    message: "      " + "   ".repeat(indentLevel - 1) + message,
    level: "debug",
  });
};

const printE = (message) => {
  printD({ message: "      " + message, level: "error" });
};

let commands = [
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
