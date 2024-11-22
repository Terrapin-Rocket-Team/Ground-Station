window.onload = () => {
  // "global" vars
  let fullscreened = false;
  let portsInUse = [];

  /// top bar

  //app control button listeners
  document.getElementById("fullscreen").addEventListener("click", () => {
    fullscreened = !fullscreened;
    api.fullscreen("main", fullscreened);
  });
  document.getElementById("reload").addEventListener("click", () => {
    api.reload("main");
  });
  document.getElementById("minimize").addEventListener("click", () => {
    api.minimize("main");
  });
  document.getElementById("close").addEventListener("click", () => {
    api.close("main");
  });

  //custom dropdown setup
  const setupDropdown = (idPrefix, callback, reload) => {
    const drop = document.getElementById(idPrefix + "-drop");
    const options = document.getElementById(idPrefix + "-options");
    if (!reload) callback(idPrefix);
    document
      .getElementById(idPrefix + "-drop")
      .addEventListener("click", () => {
        if (drop.classList.contains("active")) {
          options.style.display = "none";
          document
            .getElementById(idPrefix + "-arrow")
            .setAttribute("src", "./images/arrow_right.svg");
        } else {
          options.style.display = "block";
          if (reload) callback(idPrefix);
          document
            .getElementById(idPrefix + "-arrow")
            .setAttribute("src", "./images/arrow_down.svg");
        }
        drop.classList.toggle("active");
        drop.classList.toggle("inactive");
        options.classList.toggle("active");
      });
  };

  //adds available ports to the custom dropdown
  const getAvailPorts = (idPrefix) => {
    api.getPorts().then((ports) => {
      const options = document.getElementById(idPrefix + "-options");
      while (options.childElementCount > 0) {
        options.removeChild(options.firstChild);
      }
      const selected = document.getElementById(idPrefix + "-selected");
      if (ports.length === 0) {
        const span = document.createElement("SPAN");
        span.className = "serial";
        span.textContent = "No available ports";
        span.addEventListener("click", () => {
          selected.textContent = "Select Port";
        });
        options.appendChild(span);
      } else {
        ports.forEach((port) => {
          if (!portsInUse.some((el) => el.path === port.path)) {
            const span = document.createElement("SPAN");
            span.className = "serial";
            span.textContent = port.path;
            span.addEventListener("click", () => {
              api.setPort({ idPrefix, path: port.path }).then((success) => {
                const img = document.getElementById(idPrefix + "-connection");
                if (success) {
                  portsInUse.push({ idPrefix, path: port.path });
                  selected.textContent = port.path;
                  img.setAttribute("src", "./images/serial_connected.svg");
                  img.setAttribute("title", "Serial Connected");
                } else {
                  img.setAttribute("src", "./images/serial_disconnected.svg");
                  img.setAttribute("title", "Connection Error");
                }
              });
            });
            options.appendChild(span);
          }
        });
      }
    });
  };

  setupDropdown("serial", getAvailPorts, true);

  /// sidebar

  const setupSidebar = (buttons, visualContainer) => {
    let visuals = visualContainer.querySelectorAll("div.visual");
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", () => {
        for (let j = 0; j < visuals.length; j++) {
          visuals[j].classList.remove("active");
        }
        for (let j = 0; j < buttons.length; j++) {
          buttons[j].classList.remove("active");
        }
        let visualId = buttons[i].id.split("-")[0] + "-wrapper";
        document.getElementById(visualId).classList.add("active");
        buttons[i].classList.add("active");
      });
    }
  };

  const visButtonsTop = document.getElementsByClassName("vis-button-top");
  const visButtonsBottom = document.getElementsByClassName("vis-button-bottom");
  const topVisual = document.getElementById("visual-top");
  const bottomVisual = document.getElementById("visual-bottom");

  setupSidebar(visButtonsTop, topVisual);
  setupSidebar(visButtonsBottom, bottomVisual);

  const setupStaticOptions = (idPrefix, optionsList, clickCallback) => {
    const options = document.getElementById(idPrefix + "-options");
    while (options.childElementCount > 0) {
      options.removeChild(options.firstChild);
    }
    const selected = document.getElementById(idPrefix + "-selected");

    optionsList.forEach((option) => {
      const span = document.createElement("SPAN");
      span.className = idPrefix;
      span.textContent = option;
      span.addEventListener("click", () => {
        selected.textContent = option;
        if (clickCallback) clickCallback(option);
      });
      options.appendChild(span);
    });
  };

  const getVideoLayouts = (idPrefix) => {
    const layoutOptions = ["Full", "Partial", "Telemetry Only"];

    setupStaticOptions(idPrefix, layoutOptions);
  };

  const getVideo0Displays = (idPrefix) => {
    const video0Options = ["Input 0", "Input 1", "Charts", "None"];

    setupStaticOptions(idPrefix, video0Options);
  };
  const getVideo1Displays = (idPrefix) => {
    const video1Options = ["Input 0", "Input 1", "Charts", "None"];

    setupStaticOptions(idPrefix, video1Options);
  };

  setupDropdown("video-layout", getVideoLayouts, false);
  setupDropdown("video-0", getVideo0Displays, false);
  setupDropdown("video-1", getVideo1Displays, false);

  /// radio/commands

  //adds commands to custom dropdown
  const getCommands = (idPrefix) => {
    const commandList = [
      "Pi Power On",
      "Pi Start Video",
      "Record Launch Data",
      "Restart Pi",
    ];

    const commandSyntax = [
      "PPO: <time> <H/M/S>",
      "PSV: <time> <H/M/S>",
      "RLD: <record?>",
      "RP: N/A",
    ];

    const commandCallback = (option) => {
      let index = commandList.findIndex((command) => {
        return command === option;
      });
      document.getElementById("command-syntax").textContent =
        commandSyntax[index];
      document.getElementById("command-args").value =
        commandSyntax[index].split(" ")[0] + " ";
    };

    setupStaticOptions(idPrefix, commandList, commandCallback);
  };

  setupDropdown("command", getCommands, false);

  const commandArgs = document.getElementById("command-args");
  const previousCommands = document.getElementById("previous-commands");

  document.getElementById("reset-command").addEventListener("click", () => {
    document.getElementById("command-syntax").textContent =
      "No command selected";
    commandArgs.value = "";
    document.getElementById("command-selected").textContent = "Select Command";
  });

  document.addEventListener("click", () => {
    document.getElementById("confirm-send").classList.add("inactive");
  });

  document.getElementById("send-command").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("confirm-send").classList.toggle("inactive");
  });

  document.getElementById("confirm-send").addEventListener("click", () => {
    let command = commandArgs.value;
    document.getElementById("command-syntax").textContent =
      "No command selected";
    commandArgs.value = "";
    document.getElementById("command-selected").textContent = "Select Command";
    const span = document.createElement("SPAN");
    span.className = "previous-command";
    span.textContent = command;
    previousCommands.appendChild(span);
    // add code to send command to backend here
  });

  /// middle/data display

  const resizeGauges = () => {
    //set gauge.js gauge sizing
    let gauges = document.getElementsByClassName("gauge");

    let size = document.getElementById("telem-1").offsetHeight * 0.35;

    let numGauges = gauges.length;
    for (let i = 0; i < numGauges; i++) {
      gauges[i].setAttribute("data-width", size);
      gauges[i].setAttribute("data-height", size);
    }
  };

  resizeGauges();
  api.on("fullscreen-change", (res) => {
    if (res.win === "main") {
      setTimeout(() => {
        resizeGauges();
      }, 10);
    }
  });

  // map
  buildMap("map");

  // charts
  let altG = createChart("alt-graph", "Altitude", "s", "ft", 1, 1);
  let spdG = createChart("spd-graph", "Speed", "s", "ft/s", 1, 1);
};
