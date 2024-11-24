window.onload = () => {
  // "global" vars
  let fullscreened = false;
  let videoControls = {};
  let portInUse;

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

  // adds available ports to the custom dropdown
  const getAvailPorts = (idPrefix) => {
    // loading
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
          if (portInUse !== port.path) {
            const span = document.createElement("SPAN");
            span.className = "serial";
            span.textContent = port.path;
            span.addEventListener("click", () => {
              const img = document.getElementById(idPrefix + "-connection");
              selected.textContent = "Connecting...";
              img.setAttribute("src", "./images/serial_disconnected.svg");
              img.setAttribute("title", "Connecting...");

              api.setPort({ idPrefix, path: port.path }).then((success) => {
                if (success) {
                  portInUse.path = port.path;
                  portInUse.idPrefix = idPrefix;
                  selected.textContent = port.path;
                  img.setAttribute("src", "./images/serial_connected.svg");
                  img.setAttribute("title", "Serial Connected");
                } else {
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

  /// visuals

  // adds options that are static once loaded to a dropdown
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
        if (clickCallback) {
          if (clickCallback(option)) {
            selected.textContent = option;
          }
        } else {
          selected.textContent = option;
        }
      });
      options.appendChild(span);
    });
  };

  // video control setup dropdown options
  const getVideoLayouts = (idPrefix) => {
    const layoutOptions = ["Full", "Partial", "Telemetry Only"];

    setupStaticOptions(idPrefix, layoutOptions, (option) => {
      if (option == "Full") videoControls.layout = "two-video";
      if (option == "Partial") videoControls.layout = "one-video";
      if (option == "Telemetry Only") videoControls.layout = "telemetry-only";
      return true;
    });
  };
  const getVideo0Displays = (idPrefix) => {
    const video0Options = ["Input 0", "Input 1", "Charts", "None"];

    setupStaticOptions(idPrefix, video0Options, (option) => {
      if (option !== videoControls.video1) {
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
      if (option !== videoControls.video0) {
        if (option == "Input 1") videoControls.video1 = "live-video-1";
        if (option == "Input 0") videoControls.video1 = "live-video-0";
        if (option == "Charts") videoControls.video1 = "charts";
        if (option == "None") videoControls.video1 = "none-0";
        return true;
      }
      return false;
    });
  };

  setupDropdown("video-layout", getVideoLayouts, false);
  setupDropdown("video-0", getVideo0Displays, false);
  setupDropdown("video-1", getVideo1Displays, false);

  document.getElementById("reload-video").addEventListener("click", () => {
    api.reload("video", true);
  });

  document.getElementById("control-update").addEventListener("click", () => {
    api.updateVideoControls(videoControls);
  });

  api.on("video-controls", (controls) => {
    videoControls = controls;
    let option = "";
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

  // map
  buildMap("map");

  // charts
  let altG = createChart("alt-graph", "s", "ft", 1, 1, [
    { name: "Avionics Altitude", color: t1Color },
    { name: "Airbrake Altitude", color: t2Color },
    { name: "Payload Altitude", color: t3Color },
  ]);
  let spdG = createChart("spd-graph", "s", "ft/s", 1, 1, [
    { name: "Avionics Speed", color: t1Color },
    { name: "Airbrake Speed", color: t2Color },
    { name: "Payload Speed", color: t3Color },
  ]);

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
      // if invalid but valid command show partially valid
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

  setupDropdown("command", getCommands, false);

  commandArgs.addEventListener("input", () => {
    let commandText = commandArgs.value;

    if (commandText.length > 0) {
      let cmdMatch = commandText.match(/[A-Z][A-Z][A-Z]?:( [A-z0-9])*/g);

      if (cmdMatch) {
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
        commandValid = false;
        commandArgs.className = "invalid";
      }
    } else {
      commandValid = false;
      commandArgs.className = "empty";
    }
  });

  document.getElementById("reset-command").addEventListener("click", () => {
    document.getElementById("command-syntax").textContent =
      "No command selected";
    commandArgs.value = "";
    document.getElementById("command-selected").textContent = "Select Command";
    commandArgs.className = "empty";
  });

  document.addEventListener("click", () => {
    document.getElementById("confirm-send").classList.add("inactive");
  });

  document.getElementById("send-command").addEventListener("click", (e) => {
    if (commandValid) {
      e.stopPropagation();
      document.getElementById("confirm-send").classList.toggle("inactive");
    }
  });

  document.getElementById("confirm-send").addEventListener("click", () => {
    let command = commandArgs.value;
    document.getElementById("command-syntax").textContent =
      "No command selected";
    commandArgs.value = "";
    document.getElementById("command-selected").textContent = "Select Command";
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

  /// update GUI when size changes
  api.on("fullscreen-change", (res) => {
    if (res.win === "main") {
      fullscreened = res.isFullscreen;
      setTimeout(() => {
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
    let chartDataIds = ["t1", "t2", "t3"];
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

    if (
      sessionStorage.getItem("apogee") &&
      parseInt(sessionStorage.getItem("apogee"))
    ) {
      document.getElementById("apogee-value").textContent =
        parseInt(sessionStorage.getItem("apogee")) + " ft";
      loadedApogee = true;
    }

    if (sessionStorage.getItem("t0")) {
      t0 = new Date(parseInt(sessionStorage.getItem("t0")));
      t0Set = true;

      setInterval(() => {
        document.getElementById("t-plus-value").textContent = mstohhmmss(
          Date.now() - t0
        );
      }, 10);
    }
  }

  /// radio panel updates
  const updateRadioStatus = (idPrefix, metric) => {
    let ss = metric.getSignalStrength();
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

    document.getElementById(idPrefix + "-strength").textContent =
      metric.getRSSI() + " dBm";
    document.getElementById(idPrefix + "-bitrate").textContent =
      metric.getBitrate("k").toFixed(3) + " kbps"; // bitrate
  };

  /// individual telemetry panel updates
  const updateDisplays = (idPrefix, msg, updateFunctions) => {
    updateFunctions.forEach((f) => f(idPrefix, msg));
  };

  /// update functions that are global across all telemetry streams
  const updateGauges = (idPrefix, msg) => {
    let alt = document.getElementById(idPrefix + "-altitude");
    let spd = document.getElementById(idPrefix + "-speed");

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
    let stageEl = document.getElementById(idPrefix + "-stage");
    stageEl.textContent = msg.getStage();
  };

  /// update functions that are specific to different streams
  const updateLatLong = (idPrefix, msg) => {
    let fcoords = msg.getLatLongDecimal();
    document.getElementById(idPrefix + "-lat").textContent = fcoords
      ? fcoords.split("/")[0]
      : "00.0000\u00b0N";
    document.getElementById(idPrefix + "-long").textContent = fcoords
      ? fcoords.split("/")[1]
      : "000.0000\u00b0W";
  };
  const updateTemp = (idPrefix, msg) => {};
  const updateFlapAngle = (idPrefix, msg) => {};
  const updatePredApogee = (idPrefix, msg) => {};
  const updateHeading = (idPrefix, msg) => {
    let hdg = document.getElementById(idPrefix + "-heading");
    if (msg.getHeading() || msg.getHeading() === 0) {
      hdg.textContent = msg.getHeading();
    } else {
      hdg.innerHTML = "&#8212;";
    }
  };

  /// updates for visuals (can be passed to updateDisplays)
  const updateCharts = (idPrefix, msg) => {
    let index = parseInt(idPrefix.split("t")[1]) - 1;
    if (t0Set) {
      //update charts
      let time = Date.now() - t0;
      let ts = time / 1000;

      if (ts > 120 && ts < 120 * 60 && chartState != "minutes") {
        let altData = altG.data.datasets[index].data;
        let spdData = spdG.data.datasets[index].data;
        let altLabels = altG.data.labels;
        let spdLabels = spdG.data.labels;

        altwr.innerHTML = '<canvas id="alt-graph" class="chart"></canvas>';
        spdwr.innerHTML = '<canvas id="spd-graph" class="chart"></canvas>';

        altG = createChart("alt-graph", "min", "ft", 1 / 60, 1, [
          { name: "Avionics Altitude", color: t1Color },
          { name: "Airbrake Altitude", color: t2Color },
          { name: "Payload Altitude", color: t3Color },
        ]);
        spdG = createChart("spd-graph", "min", "ft/s", 1 / 60, 1, [
          { name: "Avionics Speed", color: t1Color },
          { name: "Airbrake Speed", color: t2Color },
          { name: "Payload Speed", color: t3Color },
        ]);
        altG.data.datasets[index].data = altData;
        spdG.data.datasets[index].data = spdData;
        altG.data.labels = altLabels;
        spdG.data.labels = spdLabels;
        chartState = "minutes";
      } else if (ts > 120 * 60 && chartState != "hours") {
        let altData = altG.data.datasets[index].data;
        let spdData = spdG.data.datasets[index].data;
        let altLabels = altG.data.labels;
        let spdLabels = spdG.data.labels;

        altwr.innerHTML = '<canvas id="alt-graph" class="chart"></canvas>';
        spdwr.innerHTML = '<canvas id="spd-graph" class="chart"></canvas>';

        altG = createChart("alt-graph", "hr", "ft", 1 / 3600, 1, [
          { name: "Avionics Altitude", color: t1Color },
          { name: "Airbrake Altitude", color: t2Color },
          { name: "Payload Altitude", color: t3Color },
        ]);
        spdG = createChart("spd-graph", "hr", "ft/s", 1 / 3600, 1, [
          { name: "Avionics Speed", color: t1Color },
          { name: "Airbrake Speed", color: t2Color },
          { name: "Payload Speed", color: t3Color },
        ]);
        altG.data.datasets[index].data = altData;
        spdG.data.datasets[index].data = spdData;
        altG.data.labels = altLabels;
        spdG.data.labels = spdLabels;
        chartState = "hours";
      }

      let factor =
        chartState == "minutes" ? 15 : chartState == "hours" ? 200 : 1;

      let interval = parseInt(
        (ts - altG.data.datasets[index].data[0].x + 5 * factor) / 4
      );

      let arrL = [];
      for (let i = 0; i < 5; i++) {
        arrL[i] =
          Math.floor(altG.data.datasets[index].data[0].x) + i * interval;
      }

      altG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      spdG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      altG.options.scales.x.suggestedMax = ts + 10 * factor;
      spdG.options.scales.x.suggestedMax = ts + 10 * factor;

      altG.data.labels = JSON.parse(JSON.stringify(arrL));
      spdG.data.labels = JSON.parse(JSON.stringify(arrL));

      altG.data.datasets[index].data.push({
        x: ts,
        y: msg.getAlt() ? msg.getAlt() : 0,
      });
      spdG.data.datasets[index].data.push({
        x: ts,
        y: msg.getSpeed() ? msg.getSpeed() : 0,
      });

      sessionStorage.setItem(
        idPrefix + "-altData",
        JSON.stringify(altG.data.datasets[index].data)
      );
      sessionStorage.setItem(
        idPrefix + "-spdData",
        JSON.stringify(spdG.data.datasets[index].data)
      );

      altG.update();
      spdG.update();
    }
  };
  const updateMap = (idPrefix, msg) => {
    // update map
    let coords = msg.getLatLong();
    if (coords[0] !== lastCoords[0] || coords[1] !== lastCoords[1]) {
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

  /// updates for status bar
  const updateT0 = (idPrefix, msg) => {
    if (msg.getStageNumber() > 0 && !t0Set) {
      // temporary t0 hardcode
      t0 = Date.now();
      sessionStorage.setItem("t0", t0);
      t0Set = true;
      for (let i = 0; i < 3; i++) {
        if (altG.data.datasets[i].data.length === 0)
          altG.data.datasets[i].data = [{ x: 0, y: null }];
        if (spdG.data.datasets[i].data.length === 0)
          spdG.data.datasets[i].data = [{ x: 0, y: null }];
      }

      setInterval(() => {
        document.getElementById("t-plus-value").textContent = mstohhmmss(
          Date.now() - t0
        );
      }, 10);
    }
  };
  const updateApogee = (idPrefix, msg) => {
    // apogee check
    if (!loadedApogee) {
      if (msg.getAlt() >= lastAlt || msg.getStageNumber() == 0) {
        lastAlt = msg.getAlt();
        apogeeTime = Date.now();
      }
      if (
        !apogeeFound &&
        msg.getStageNumber() > 0 &&
        Date.now() - apogeeTime > 6000
      ) {
        apogeeFound = true;
        document.getElementById("apogee-value").textContent = lastAlt + " ft";
        sessionStorage.setItem("apogee", lastAlt);
      }
    }
  };

  api.on("metrics", (metric) => {
    // update signal strength and bitrate
    let m = new Metrics(metric);
    if (m.deviceId === "3") {
      updateRadioStatus("telem", m);
    }
  });

  api.on("data", (data) => {
    let msg = new APRSTelem(data);

    if (msg.stream === "telem-avionics") {
      updateDisplays("t1", msg, [
        updateT0, // order matters, update t0 first
        updateGauges,
        updateLatLong,
        updateTemp,
        updateStage,
        // updateCharts,
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
