window.onload = () => {
  // "global" vars
  let fullscreened = false;
  let videoControls = {};
  let portInUse = { path: null, idPrefix: null };

  // get colors from css
  const t1Color = getComputedStyle(document.body).getPropertyValue(
      "--t1-color"
    ),
    t2Color = getComputedStyle(document.body).getPropertyValue("--t2-color"),
    t3Color = getComputedStyle(document.body).getPropertyValue("--t3-color");

  /// top bar

  // app control button listeners
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

  // custom dropdown setup
  const setupDropdown = (idPrefix, callback, reload) => {
    // get required elements from DOM
    const drop = document.getElementById(idPrefix + "-drop");
    const options = document.getElementById(idPrefix + "-options");
    // call the callback if we're not going to call it every time the dropdown is clicked
    if (!reload) callback(idPrefix);
    // listener to activate the dropdown
    document
      .getElementById(idPrefix + "-drop")
      .addEventListener("click", () => {
        // activate/deactivate dropdown
        if (drop.classList.contains("active")) {
          options.style.display = "none";
          document
            .getElementById(idPrefix + "-arrow")
            .setAttribute("src", "./images/arrow_right.svg");
        } else {
          options.style.display = "block";
          // if we want to reload the dropdown every time
          if (reload) callback(idPrefix); // call callback if we're opening the dropdown
          document
            .getElementById(idPrefix + "-arrow")
            .setAttribute("src", "./images/arrow_down.svg");
        }
        drop.classList.toggle("active");
        drop.classList.toggle("inactive");
        options.classList.toggle("active");
      });
  };

  // adds available ports to the custom dropdown
  const getAvailPorts = (idPrefix) => {
    // show loading
    const options = document.getElementById(idPrefix + "-options");
    while (options.childElementCount > 0) {
      options.removeChild(options.firstChild);
    }
    const span = document.createElement("SPAN");
    span.className = "serial";
    span.textContent = "Loading...";
    options.appendChild(span);

    // when we have a response
    api.getPorts().then((ports) => {
      // remove loading components
      while (options.childElementCount > 0) {
        options.removeChild(options.firstChild);
      }
      const selected = document.getElementById(idPrefix + "-selected");
      // if there's no available ports, just put an element that says so in the dropdown
      if (ports.length === 0) {
        const span = document.createElement("SPAN");
        span.className = "serial";
        span.textContent = "No available ports";
        span.addEventListener("click", () => {
          selected.textContent = "Select Port";
        });
        options.appendChild(span);
      } else {
        // otherwise, for each port
        ports.forEach((port) => {
          // if the port is not currently in use
          if (portInUse.path !== port.path) {
            // create a new option in the dropdown for this port
            const span = document.createElement("SPAN");
            span.className = "serial";
            span.textContent = port.path;
            span.addEventListener("click", () => {
              // show "connecting" until we know whether the connection succeeded
              const img = document.getElementById(idPrefix + "-connection");
              selected.textContent = "Connecting...";
              img.setAttribute("src", "./images/serial_disconnected.svg");
              img.setAttribute("title", "Connecting...");

              // try to connect to the port
              api.setPort({ idPrefix, path: port.path }).then((success) => {
                // set dropdown depending on whether we successfully connected
                if (success) {
                  portInUse.path = port.path;
                  portInUse.idPrefix = idPrefix;
                  selected.textContent = port.path;
                  img.setAttribute("src", "./images/serial_connected.svg");
                  img.setAttribute("title", "Serial Connected");
                } else {
                  portInUse.path = null;
                  portInUse.idPrefix = null;
                  selected.textContent = "Select Port";
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

  // setup the serial port dropdown
  setupDropdown("serial", getAvailPorts, true);
  api
    .getPortStatus()
    .then((status) => {
      if (status.connected) {
        portInUse.path = status.path;
        portInUse.idPrefix = "serial";
        const selected = document.getElementById("serial-selected");
        const img = document.getElementById("serial-connection");
        selected.textContent = status.path;
        img.setAttribute("src", "./images/serial_connected.svg");
        img.setAttribute("title", "Serial Connected");
      }
    })
    .catch((err) => {
      console.error(err);
    });

  /// sidebar

  const setupSidebar = (buttons, visualContainer) => {
    // get all the elements that are visuals in this container
    let visuals = visualContainer.querySelectorAll("div.visual");
    // add buttons for each
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

  // need to setup top and botton sidebars
  const visButtonsTop = document.getElementsByClassName("vis-button-top");
  const visButtonsBottom = document.getElementsByClassName("vis-button-bottom");
  const topVisual = document.getElementById("visual-top");
  const bottomVisual = document.getElementById("visual-bottom");

  setupSidebar(visButtonsTop, topVisual);
  setupSidebar(visButtonsBottom, bottomVisual);

  /// visuals

  // adds options that are static once loaded to a dropdown
  const setupStaticOptions = (idPrefix, optionsList, clickCallback) => {
    const options = document.getElementById(idPrefix + "-options");
    // make sure there's nothing in the dropdown
    while (options.childElementCount > 0) {
      options.removeChild(options.firstChild);
    }
    const selected = document.getElementById(idPrefix + "-selected");

    // add an element for each option
    optionsList.forEach((option) => {
      const span = document.createElement("SPAN");
      span.className = idPrefix;
      span.textContent = option;
      span.addEventListener("click", () => {
        if (clickCallback) {
          // call the given callback, it must return true if the selected option is valid
          if (clickCallback(option)) {
            // only set the value of the dropdown if the selected option is valid
            selected.textContent = option;
          }
        } else {
          selected.textContent = option;
        }
      });
      options.appendChild(span);
    });
  };

  // video control dropdown options
  const getVideoLayouts = (idPrefix) => {
    const layoutOptions = ["Full", "Partial", "Telemetry Only"];

    setupStaticOptions(idPrefix, layoutOptions, (option) => {
      // figure out what value the option text corresponds to
      if (option == "Full") videoControls.layout = "two-video";
      if (option == "Partial") videoControls.layout = "one-video";
      if (option == "Telemetry Only") videoControls.layout = "telemetry-only";
      return true;
    });
  };
  const getVideo0Displays = (idPrefix) => {
    const video0Options = ["Input 0", "Input 1", "Charts", "None"];

    setupStaticOptions(idPrefix, video0Options, (option) => {
      // video0 and video1 can't be set to the same thing
      if (option !== videoControls.video1) {
        // figure out what value the option text corresponds to
        if (option == "Input 0") videoControls.video0 = "live-video-0";
        if (option == "Input 1") videoControls.video0 = "live-video-1";
        if (option == "Charts") videoControls.video0 = "charts";
        if (option == "None") videoControls.video0 = "none-0";
        return true;
      }
      return false;
    });
  };
  const getVideo1Displays = (idPrefix) => {
    const video1Options = ["Input 1", "Input 0", "Charts", "None"];

    setupStaticOptions(idPrefix, video1Options, (option) => {
      // video1 and video0 can't be set to the same thing
      if (option !== videoControls.video0) {
        // figure out what value the option text corresponds to
        if (option == "Input 1") videoControls.video1 = "live-video-1";
        if (option == "Input 0") videoControls.video1 = "live-video-0";
        if (option == "Charts") videoControls.video1 = "charts";
        if (option == "None") videoControls.video1 = "none-0";
        return true;
      }
      return false;
    });
  };

  // setup each dropdown with their callbacks
  setupDropdown("video-layout", getVideoLayouts, false);
  setupDropdown("video-0", getVideo0Displays, false);
  setupDropdown("video-1", getVideo1Displays, false);

  // listeners for buttons in the video panel controls section
  document.getElementById("reload-video").addEventListener("click", () => {
    api.reload("video", true); // specify true so that the setting are kept for the video window
  });

  document.getElementById("control-update").addEventListener("click", () => {
    api.updateVideoControls(videoControls);
  });

  api.on("video-controls", (controls) => {
    videoControls = controls;
    let option = "";
    // set each video control dropdown based on controls
    // there's probably a better way to write this
    if (videoControls.layout === "two-video") option = "Full";
    if (videoControls.layout === "one-video") option = "Partial";
    if (videoControls.layout === "telemetry-only") option = "Telemetry Only";
    document.getElementById("video-layout-selected").textContent;
    if (videoControls.video0 === "live-video-0") option = "Input 0";
    if (videoControls.video0 === "live-video-1") option = "Input 1";
    if (videoControls.video0 === "charts") option = "Charts";
    if (videoControls.video0 === "none-0") option = "None";
    document.getElementById("video-0-selected").textContent = option;
    if (videoControls.video1 === "live-video-1") option = "Input 1";
    if (videoControls.video1 === "live-video-0") option = "Input 0";
    if (videoControls.video1 === "charts") option = "Charts";
    if (videoControls.video1 === "none-0") option = "None";
    document.getElementById("video-1-selected").textContent = option;
  });

  // create the map
  buildMap("map");

  // create the charts
  const chartsConfig = [
    { name: "Avionics Altitude", color: t1Color },
    { name: "Airbrake Altitude", color: t2Color },
    { name: "Payload Altitude", color: t3Color },
  ];
  let altG = createChart("alt-graph", "s", "ft", 1, 1, chartsConfig);
  let spdG = createChart("spd-graph", "s", "ft/s", 1, 1, chartsConfig);

  let altwr = document.getElementById("alt-wrapper");
  let spdwr = document.getElementById("spd-wrapper");

  // rocket orientation
  // TODO

  /// radio/commands

  const commandList = APRSCmd.getCommandList();

  const commandArgs = document.getElementById("command-args");
  const previousCommands = document.getElementById("previous-commands");

  let commandValid = false;

  //adds commands to custom dropdown
  const getCommands = (idPrefix) => {
    const commandCallback = (option) => {
      // figure out what index in the list was selected
      let index = commandList.findIndex((command) => {
        return command.name === option;
      });
      document.getElementById("command-syntax").textContent =
        commandList[index].abbrv + ": " + commandList[index].syntax;
      document.getElementById("command-args").value =
        commandList[index].abbrv + ": ";

      // check if syntax is valid (in case there are no args)
      commandValid = commandList[index].validator(
        commandList[index].abbrv + ": "
      );
      // if valid change color
      if (commandValid) commandArgs.className = "valid";
      // if invalid but valid command, show partially valid
      else commandArgs.className = "part-valid";
      return true;
    };

    setupStaticOptions(
      idPrefix,
      commandList.map((command) => {
        return command.name;
      }),
      commandCallback
    );
  };

  // setup the commands dropdown
  setupDropdown("command", getCommands, false);

  // validation for the command text input
  commandArgs.addEventListener("input", () => {
    let commandText = commandArgs.value;

    if (commandText.length > 0) {
      // see if text matches the command format
      let cmdMatch = commandText.match(/[A-Z][A-Z][A-Z]?:( [A-z0-9])*/g);

      if (cmdMatch) {
        // if we fouond a match, figure out where the command abbreviation is
        let command = cmdMatch[0];
        let index = -1;
        if ((index = commandText.search(":")) > 0) {
          command = commandText.slice(0, index);
        }

        for (let i = 0; i < commandList.length; i++) {
          let cmdName = commandList[i].abbrv;
          // check if current abbreviation matches the input
          if (cmdName === command) {
            // update syntax and dropdown
            document.getElementById("command-syntax").textContent =
              commandList[i].abbrv + ": " + commandList[i].syntax;
            document.getElementById("command-selected").textContent =
              commandList[i].name;
            // check if syntax is valid
            commandValid = commandList[i].validator(commandText);
            // if valid change color
            if (commandValid) commandArgs.className = "valid";
            // if invalid but valid command show partially valid
            else commandArgs.className = "part-valid";
            break;
          }
        }
      } else {
        // if no match the command is invalid
        commandValid = false;
        commandArgs.className = "invalid";
      }
    } else {
      // otherwise text box is empty
      commandValid = false;
      commandArgs.className = "empty";
    }
  });

  // reset the dropdown, syntax display, and text box
  document.getElementById("reset-command").addEventListener("click", () => {
    document.getElementById("command-syntax").textContent =
      "No command selected";
    commandArgs.value = "";
    document.getElementById("command-selected").textContent = "Select Command";
    commandArgs.className = "empty";
  });

  // make the confirm button disappear if we click away
  document.addEventListener("click", () => {
    document.getElementById("confirm-send").classList.add("inactive");
  });

  // if we have a valid command, show the confirm button
  document.getElementById("send-command").addEventListener("click", (e) => {
    if (commandValid) {
      e.stopPropagation();
      document.getElementById("confirm-send").classList.toggle("inactive");
    }
  });

  // if the user confirms sending the command, reset the inputs and hand command off to the backend
  document.getElementById("confirm-send").addEventListener("click", () => {
    let command = commandArgs.value;
    document.getElementById("command-syntax").textContent =
      "No command selected";
    commandArgs.value = "";
    document.getElementById("command-selected").textContent = "Select Command";
    // add command to previous commands window
    const span = document.createElement("SPAN");
    span.className = "previous-command";
    span.textContent =
      "[" +
      new Date().toString().match(/[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/g) +
      "] > " +
      command;
    previousCommands.appendChild(span);

    // send command to backend
    api.sendCommand(command);
  });

  /// middle/data display

  const resizeGauges = () => {
    //set canvas gauges sizing
    let gauges = document.getElementsByClassName("gauge");

    let size = document.getElementById("telem-1").offsetHeight * 0.35;

    let numGauges = gauges.length;
    for (let i = 0; i < numGauges; i++) {
      gauges[i].setAttribute("data-width", size);
      gauges[i].setAttribute("data-height", size);
    }
  };

  resizeGauges();

  /// update GUI when size changes
  api.on("fullscreen-change", (res) => {
    if (res.win === "main") {
      fullscreened = res.isFullscreen;
      setTimeout(() => {
        // need to resize gauges every time window size changes
        resizeGauges();
      }, 10);
    }
  });

  // persistent variables for handling received telemetry
  let lastCoords = [];
  let lastAlt = 0;
  let apogeeTime = 0;
  let loadedApogee = false;
  let apogeeFound = false;
  let t0Set = false;
  let t0 = {};
  let chartState = "seconds";

  // load previous data if it exists
  {
    // eventually this array will be part of the config
    // so the user can choose how many streams they want
    let chartDataIds = ["t1", "t2", "t3"];
    // get chart data for each stream
    chartDataIds.forEach((idPrefix) => {
      let index = parseInt(idPrefix.split("t")[1]) - 1;

      altG.data.datasets[index].data = sessionStorage.getItem(
        idPrefix + "-altData"
      )
        ? JSON.parse(sessionStorage.getItem(idPrefix + "-altData"))
        : [];
      spdG.data.datasets[index].data = sessionStorage.getItem(
        idPrefix + "-spdData"
      )
        ? JSON.parse(sessionStorage.getItem(idPrefix + "-spdData"))
        : [];
    });

    altG.update();
    spdG.update();

    // check for stored apogee in case of reload during flight
    if (
      sessionStorage.getItem("apogee") &&
      parseInt(sessionStorage.getItem("apogee"))
    ) {
      document.getElementById("apogee-value").textContent =
        parseInt(sessionStorage.getItem("apogee")) + " ft";
      loadedApogee = true;
    }

    // check for stored t0 in case of reload during flight
    if (sessionStorage.getItem("t0")) {
      t0 = new Date(parseInt(sessionStorage.getItem("t0")));
      t0Set = true;

      setInterval(() => {
        document.getElementById("t-plus-value").textContent = mstohhmmss(
          Date.now() - t0
        );
      }, 10);
    }

    // TODO: load map data so it's not lost during reload
  }

  /// radio panel updates
  const updateRadioStatus = (idPrefix, metric) => {
    // set the signal strength for the given stream
    let ss = metric.getSignalStrength();
    // set correct image
    const signalEl = document.getElementById(idPrefix + "-signal");
    if (ss === "High") {
      signalEl.setAttribute("src", "./images/signal_strong.svg");
      signalEl.setAttribute("alt", "Signal Strong");
      signalEl.title = "Signal Strong";
    }
    if (ss === "Med") {
      signalEl.setAttribute("src", "./images/signal_mid.svg");
      signalEl.setAttribute("alt", "Signal Medium");
      signalEl.title = "Signal Medium";
    }
    if (ss === "Low") {
      signalEl.setAttribute("src", "./images/signal_weak.svg");
      signalEl.setAttribute("alt", "Signal Weak");
      signalEl.title = "Signal Weak";
    }
    if (ss === "None") {
      signalEl.setAttribute("src", "./images/no_signal.svg");
      signalEl.setAttribute("alt", "No Signal");
      signalEl.title = "No Signal";
    }

    // set text displays
    document.getElementById(idPrefix + "-strength").textContent =
      metric.getRSSI() + " dBm";
    document.getElementById(idPrefix + "-bitrate").textContent =
      metric.getBitrate("k").toFixed(3) + " kbps"; // bitrate
  };

  /// individual telemetry panel updates
  const updateDisplays = (idPrefix, msg, updateFunctions) => {
    // calls each of the given update functions
    updateFunctions.forEach((f) => f(idPrefix, msg));
  };

  /// update functions that are global across all telemetry streams (can be passed to updateDisplays)
  const updateGauges = (idPrefix, msg) => {
    // get the given gauges elements
    let alt = document.getElementById(idPrefix + "-altitude");
    let spd = document.getElementById(idPrefix + "-speed");

    // update altitude and speed if given in the message
    if (msg.getAlt() || msg.getAlt() === 0) {
      alt.setAttribute("data-value-text", msg.getAlt());
      alt.setAttribute("data-value", msg.getAlt() / 1000);
      document.getElementById(idPrefix + "-alt-text").textContent =
        msg.getAlt() + " ft";
    } else {
      alt.setAttribute("data-value-text", "\u2014");
    }
    if (msg.getSpeed() || msg.getSpeed() === 0) {
      spd.setAttribute("data-value-text", msg.getSpeed());
      spd.setAttribute("data-value", msg.getSpeed());
      document.getElementById(idPrefix + "-spd-text").textContent =
        msg.getSpeed() + " ft/s";
    } else {
      spd.setAttribute("data-value-text", "\u2014");
    }
  };
  const updateStage = (idPrefix, msg) => {
    // update the given stage element
    let stageEl = document.getElementById(idPrefix + "-stage");
    stageEl.textContent = msg.getStage();
  };

  /// update functions that are specific to different streams (can be passed to updateDisplays)
  const updateLatLong = (idPrefix, msg) => {
    // update the given lat/long element
    let fcoords = msg.getLatLongDecimal();
    document.getElementById(idPrefix + "-lat").textContent = fcoords
      ? fcoords.split("/")[0]
      : "00.0000\u00b0N";
    document.getElementById(idPrefix + "-long").textContent = fcoords
      ? fcoords.split("/")[1]
      : "000.0000\u00b0W";
  };
  const updateTemp = (idPrefix, msg) => {
    // TODO: implement updating temperature elements
    // depends on parsing temp data from state flags in APRSTelem
  };
  const updateFlapAngle = (idPrefix, msg) => {
    // TODO: implement updating flap angle elements
    // depends on parsing flap angle data from state flags in APRSTelem
  };
  const updatePredApogee = (idPrefix, msg) => {
    // TODO: implement updating predicted apogee elements
    // depends on parsing predicted apogee data from state flags in APRSTelem
  };
  const updateHeading = (idPrefix, msg) => {
    // update given heading element from message
    let hdg = document.getElementById(idPrefix + "-heading");
    if (msg.getHeading() || msg.getHeading() === 0) {
      hdg.textContent = msg.getHeading();
    } else {
      hdg.innerHTML = "&#8212;";
    }
  };

  /// updates for visuals (can be passed to updateDisplays)
  const updateCharts = (idPrefix, msg) => {
    // get the index in the charts dataset
    let index = parseInt(idPrefix.split("t")[1]) - 1;
    // wait to put data on the chart until t0
    if (t0Set) {
      //update charts
      let time = Date.now() - t0;
      let ts = time / 1000;

      // if more than 120 seconds have passed, change the chart scale to minutes
      if (ts > 120 && ts < 120 * 60 && chartState != "minutes") {
        let altData = altG.data.datasets[index].data;
        let spdData = spdG.data.datasets[index].data;
        let altLabels = altG.data.labels;
        let spdLabels = spdG.data.labels;

        altwr.innerHTML = '<canvas id="alt-graph" class="chart"></canvas>';
        spdwr.innerHTML = '<canvas id="spd-graph" class="chart"></canvas>';

        altG = createChart("alt-graph", "min", "ft", 1 / 60, 1, chartsConfig);
        spdG = createChart("spd-graph", "min", "ft/s", 1 / 60, 1, chartsConfig);
        altG.data.datasets[index].data = altData;
        spdG.data.datasets[index].data = spdData;
        altG.data.labels = altLabels;
        spdG.data.labels = spdLabels;
        chartState = "minutes";

        // if more than 120 minutes have passed, change the chart scale to hours
      } else if (ts > 120 * 60 && chartState != "hours") {
        let altData = altG.data.datasets[index].data;
        let spdData = spdG.data.datasets[index].data;
        let altLabels = altG.data.labels;
        let spdLabels = spdG.data.labels;

        altwr.innerHTML = '<canvas id="alt-graph" class="chart"></canvas>';
        spdwr.innerHTML = '<canvas id="spd-graph" class="chart"></canvas>';

        altG = createChart("alt-graph", "hr", "ft", 1 / 3600, 1, chartsConfig);
        spdG = createChart(
          "spd-graph",
          "hr",
          "ft/s",
          1 / 3600,
          1,
          chartsConfig
        );
        altG.data.datasets[index].data = altData;
        spdG.data.datasets[index].data = spdData;
        altG.data.labels = altLabels;
        spdG.data.labels = spdLabels;
        chartState = "hours";
      }

      // time is store in seconds, so need to multiply by a factor based on the scale
      let factor =
        chartState == "minutes" ? 15 : chartState == "hours" ? 200 : 1;

      // interval between grid lines
      let interval = parseInt(
        (ts - altG.data.datasets[index].data[0].x + 5 * factor) / 4
      );

      // get each grid line
      let arrL = [];
      for (let i = 0; i < 5; i++) {
        arrL[i] =
          Math.floor(altG.data.datasets[index].data[0].x) + i * interval;
      }

      // set min and max for x scale
      altG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      spdG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      altG.options.scales.x.suggestedMax = ts + 10 * factor;
      spdG.options.scales.x.suggestedMax = ts + 10 * factor;

      // set labels of x axis (grid lines)
      altG.data.labels = JSON.parse(JSON.stringify(arrL));
      spdG.data.labels = JSON.parse(JSON.stringify(arrL));

      // add new data to the graph
      altG.data.datasets[index].data.push({
        x: ts,
        y: msg.getAlt() ? msg.getAlt() : 0,
      });
      spdG.data.datasets[index].data.push({
        x: ts,
        y: msg.getSpeed() ? msg.getSpeed() : 0,
      });

      // store new data to be retreived later
      sessionStorage.setItem(
        idPrefix + "-altData",
        JSON.stringify(altG.data.datasets[index].data)
      );
      sessionStorage.setItem(
        idPrefix + "-spdData",
        JSON.stringify(spdG.data.datasets[index].data)
      );

      // force update of the charts
      altG.update();
      spdG.update();
    }
  };
  const updateMap = (idPrefix, msg) => {
    // update map
    let coords = msg.getLatLong();
    if (coords[0] !== lastCoords[0] || coords[1] !== lastCoords[1]) {
      // move the marker to the new lat/long
      updateMarker(
        coords[0],
        coords[1],
        `<div style="display:flex;flex-direction:row;align-items:center;column-gap:1vh;"><img src="images/rocket.svg" alt="Rocket" style="height:min(3.5vh, 35px);margin-left:-1vh;"/><span style="margin-right:-1vh;font-size:min(12px,2.5vh);display:inline-block;">${msg.getLatLongDecimal(
          true
        )}</span></div>`
      );
      lastCoords = coords;
    }
  };

  /// updates for status bar (can be passed to updateDisplays)
  const updateT0 = (idPrefix, msg) => {
    // wait until the flight computer reports the stage is >0 (out of preflight)
    if (msg.getStageNumber() > 0 && !t0Set) {
      // get the t0
      t0 = Date.now();
      // save the t0 for later
      sessionStorage.setItem("t0", t0);
      t0Set = true;
      // need to add empty element so the chart scale doesn't look weird
      // hardcoded for 3 streams for now
      for (let i = 0; i < 3; i++) {
        if (altG.data.datasets[i].data.length === 0)
          altG.data.datasets[i].data = [{ x: 0, y: null }];
        if (spdG.data.datasets[i].data.length === 0)
          spdG.data.datasets[i].data = [{ x: 0, y: null }];
      }

      // update the t0 display
      setInterval(() => {
        document.getElementById("t-plus-value").textContent = mstohhmmss(
          Date.now() - t0
        );
      }, 10);
    }
  };
  const updateApogee = (idPrefix, msg) => {
    // apogee check
    // don't need to find apogee if it was loaded
    if (!loadedApogee) {
      // TODO: this can get messed up if the app is reloaded near apogee
      // if the current altitude is greater than the previous, and we're actually in the air (stage > 0)
      if (msg.getAlt() >= lastAlt || msg.getStageNumber() == 0) {
        lastAlt = msg.getAlt();
        // update the timer
        apogeeTime = Date.now();
      }
      // if the apogee hasn't yet been found, we're actually in the air, and the timer expires, we've found apogee
      if (
        !apogeeFound &&
        msg.getStageNumber() > 0 &&
        Date.now() - apogeeTime > 6000
      ) {
        apogeeFound = true;
        // update the displays
        document.getElementById("apogee-value").textContent = lastAlt + " ft";
        sessionStorage.setItem("apogee", lastAlt);
      }
    }
  };

  api.on("metrics", (metric) => {
    // update signal strength and bitrate
    let m = new Metrics(metric);
    // TODO: need to update these values based on actual device ids
    if (m.deviceId === "3") {
      updateRadioStatus("telem", m);
    }
    if (m.deviceId === "2") {
      updateRadioStatus("video0", m);
    }
    if (m.deviceId === "1") {
      updateRadioStatus("video1", m);
    }
  });

  api.on("data", (data) => {
    let msg = new APRSTelem(data);

    // update the proper telemetry display with new data
    if (msg.stream === "telem-avionics") {
      updateDisplays("t1", msg, [
        updateT0, // order matters, update t0 first since other things (charts) depend on it
        updateGauges,
        updateLatLong,
        updateTemp,
        updateStage,
        updateCharts,
        updateMap,
        updateApogee,
      ]);
    }
    if (msg.stream === "telem-airbrake") {
      updateDisplays("t2", msg, [
        updateGauges,
        updateFlapAngle,
        updatePredApogee,
        updateStage,
        updateCharts,
      ]);
    }
    if (msg.stream === "telem-payload") {
      updateDisplays("t3", msg, [
        updateGauges,
        updateLatLong,
        updateHeading,
        updateStage,
        updateCharts,
      ]);
    }
  });

  //update UI if serial connection is lost
  api.on("serial-close", (portPath) => {
    if (portInUse.path === portPath) {
      const img = document.getElementById(portInUse.idPrefix + "-connection");
      img.setAttribute("src", "./images/serial_disconnected.svg");
      img.setAttribute("title", "Connection Error");
    }
  });
};

// convert milliseconds to HH:MM:SS format
const mstohhmmss = (ms) => {
  let seconds =
    Math.floor((ms / 1000) % 60) > 0 ? Math.floor((ms / 1000) % 60) : 0;
  let minutes =
    Math.floor((ms / (1000 * 60)) % 60) > 0
      ? Math.floor((ms / (1000 * 60)) % 60)
      : 0;
  let hours =
    Math.floor((ms / (1000 * 60 * 60)) % 24) > 0
      ? Math.floor((ms / (1000 * 60 * 60)) % 24)
      : 0;

  return `${hours < 10 ? "0" + hours : hours}:${
    minutes < 10 ? "0" + minutes : minutes
  }:${seconds < 10 ? "0" + seconds : seconds}`;
};
