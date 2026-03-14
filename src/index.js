window.onload = () => {
  // "global" vars
  let fullscreened = false;
  let videoControls = {};
  let portInUse = { path: null, idPrefix: null };

  // Camera support
  // Cache camera labels so we can display them later when video-controls arrive.
  let cameraLabelById = {};

  // Best-effort: some platforms only expose device labels after camera permission is granted once.
  const ensureCameraPermissionForLabels = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      // immediately stop so we don't keep the camera on
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore: user may deny permission; dropdown can still show Camera 1/2...
    }
  };

  const getCameraDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];

    let devices = await navigator.mediaDevices.enumerateDevices();
    let cams = devices.filter((d) => d.kind === "videoinput");

    // If labels are empty, try to request permission once then re-enumerate.
    const anyMissingLabels = cams.some((c) => !c.label || c.label.trim().length === 0);
    if (anyMissingLabels) {
      await ensureCameraPermissionForLabels();
      devices = await navigator.mediaDevices.enumerateDevices();
      cams = devices.filter((d) => d.kind === "videoinput");
    }

    cameraLabelById = {};
    cams.forEach((c, i) => {
      const label = c.label && c.label.trim().length > 0 ? c.label : `Camera ${i + 1}`;
      cameraLabelById[c.deviceId] = label;
    });

    return cams;
  };

  // get colors from css
  const t1Color = getComputedStyle(document.body).getPropertyValue("--t1-color"),
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
    document.getElementById(idPrefix + "-drop").addEventListener("click", () => {
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
    const options = document.getElementById(idPrefix + "-options");
    while (options.childElementCount > 0) {
      options.removeChild(options.firstChild);
    }
    const span = document.createElement("SPAN");
    span.className = "serial";
    span.textContent = "Loading...";
    options.appendChild(span);

    api.getPorts().then((ports) => {
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
          if (portInUse.path !== port.path) {
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

  setupDropdown("serial", getAvailPorts, true);
  api
    .getPortStatus()
    .then((status) => {
      if (status.connected && status.path) {
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
    const optionsEl = document.getElementById(idPrefix + "-options");
    const selectedEl = document.getElementById(idPrefix + "-selected");

    while (optionsEl.childElementCount > 0) optionsEl.removeChild(optionsEl.firstChild);

    const loading = document.createElement("SPAN");
    loading.className = idPrefix;
    loading.textContent = "Loading...";
    optionsEl.appendChild(loading);

    getCameraDevices()
      .then((cams) => {
        while (optionsEl.childElementCount > 0) optionsEl.removeChild(optionsEl.firstChild);

        const baseOptions = [
          { label: "Input 0", value: "live-video-0" },
          { label: "Input 1", value: "live-video-1" },
          { label: "Charts", value: "charts" },
          { label: "3D Visualization", value: "3d-visualization" },
          { label: "None", value: "none-0" },
        ];

        const camOptions = cams.map((c, i) => ({
          label: `Camera: ${cameraLabelById[c.deviceId] || `Camera ${i + 1}`}`,
          value: `camera:${c.deviceId}`,
        }));

        const all = [...baseOptions, ...camOptions];

        all.forEach((opt) => {
          const span = document.createElement("SPAN");
          span.className = idPrefix;
          span.textContent = opt.label;
          span.addEventListener("click", () => {
            if (opt.value !== videoControls.video1) {
              videoControls.video0 = opt.value;
              selectedEl.textContent = opt.label;
            }
          });
          optionsEl.appendChild(span);
        });
      })
      .catch(() => {
        while (optionsEl.childElementCount > 0) optionsEl.removeChild(optionsEl.firstChild);
        const span = document.createElement("SPAN");
        span.className = idPrefix;
        span.textContent = "No cameras found";
        span.addEventListener("click", () => {
          selectedEl.textContent = "Select Display";
        });
        optionsEl.appendChild(span);
      });
  };

  const getVideo1Displays = (idPrefix) => {
    const optionsEl = document.getElementById(idPrefix + "-options");
    const selectedEl = document.getElementById(idPrefix + "-selected");

    while (optionsEl.childElementCount > 0) optionsEl.removeChild(optionsEl.firstChild);

    const loading = document.createElement("SPAN");
    loading.className = idPrefix;
    loading.textContent = "Loading...";
    optionsEl.appendChild(loading);

    getCameraDevices()
      .then((cams) => {
        while (optionsEl.childElementCount > 0) optionsEl.removeChild(optionsEl.firstChild);

        const baseOptions = [
          { label: "Input 1", value: "live-video-1" },
          { label: "Input 0", value: "live-video-0" },
          { label: "Charts", value: "charts" },
          { label: "3D Visualization", value: "3d-visualization" },
          { label: "None", value: "none-1" },
        ];

        const camOptions = cams.map((c, i) => ({
          label: `Camera: ${cameraLabelById[c.deviceId] || `Camera ${i + 1}`}`,
          value: `camera:${c.deviceId}`,
        }));

        const all = [...baseOptions, ...camOptions];

        all.forEach((opt) => {
          const span = document.createElement("SPAN");
          span.className = idPrefix;
          span.textContent = opt.label;
          span.addEventListener("click", () => {
            if (opt.value !== videoControls.video0) {
              videoControls.video1 = opt.value;
              selectedEl.textContent = opt.label;
            }
          });
          optionsEl.appendChild(span);
        });
      })
      .catch(() => {
        while (optionsEl.childElementCount > 0) optionsEl.removeChild(optionsEl.firstChild);
        const span = document.createElement("SPAN");
        span.className = idPrefix;
        span.textContent = "No cameras found";
        span.addEventListener("click", () => {
          selectedEl.textContent = "Select Display";
        });
        optionsEl.appendChild(span);
      });
  };

  // ── Video orientation ──────────────────────────────────────────────────────

  const ORIENT_OPTIONS = [
    { label: "↑ 0° — Normal",        value: "0"     },
    { label: "↻ 90° — Clockwise",    value: "90"    },
    { label: "↓ 180° — Flipped",     value: "180"   },
    { label: "↺ 270° — Counter-CW",  value: "270"   },
    { label: "⟷ Horizontal Flip",    value: "hflip" },
    { label: "↕ Vertical Flip",      value: "vflip" },
  ];

  const ORIENT_TRANSFORMS = {
    "0":     "rotate(0deg)",
    "90":    "rotate(90deg)",
    "180":   "rotate(180deg)",
    "270":   "rotate(270deg)",
    "hflip": "scaleX(-1)",
    "vflip": "scaleY(-1)",
  };

  const applyVideoOrientation = (videoIndex, value) => {
    const wrapper = document.getElementById("video-wrapper-" + videoIndex);
    if (!wrapper) return;
    const el = wrapper.querySelector("video, canvas, iframe");
    if (!el) return;
    el.style.transform = ORIENT_TRANSFORMS[value] ?? "rotate(0deg)";
    el.style.transformOrigin = "center center";
    if (value === "90" || value === "270") {
      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      el.style.width      = h + "px";
      el.style.height     = w + "px";
      el.style.marginLeft = (w - h) / 2 + "px";
      el.style.marginTop  = (h - w) / 2 + "px";
    } else {
      el.style.width = el.style.height = el.style.marginLeft = el.style.marginTop = "";
    }
  };

  // Populate orientation dropdowns using setupStaticOptions directly.
  // We do NOT call setupDropdown for orientation — instead we manually wire the
  // click-to-open on the drop div so we can stop propagation on option clicks,
  // preventing the bubble-re-open bug that made selection impossible.
  const setupOrientDropdown = (idPrefix, videoIndex) => {
    const drop    = document.getElementById(idPrefix + "-drop");
    const options = document.getElementById(idPrefix + "-options");
    const arrow   = document.getElementById(idPrefix + "-arrow");
    const selected = document.getElementById(idPrefix + "-selected");

    // Populate options
    while (options.childElementCount > 0) options.removeChild(options.firstChild);
    ORIENT_OPTIONS.forEach((opt) => {
      const span = document.createElement("SPAN");
      span.className = idPrefix;
      span.textContent = opt.label;
      span.addEventListener("click", (e) => {
        // Stop the click reaching the drop div so it doesn't re-toggle open
        e.stopPropagation();
        // Update displayed selection
        selected.textContent = opt.label;
        // Store and apply
        videoControls["orient" + videoIndex] = opt.value;
        applyVideoOrientation(videoIndex, opt.value);
        // Close dropdown
        options.style.display = "none";
        arrow.setAttribute("src", "./images/arrow_right.svg");
        drop.classList.remove("active");
        drop.classList.add("inactive");
        options.classList.remove("active");
      });
      options.appendChild(span);
    });

    // Toggle open/close on the drop div click
    drop.addEventListener("click", () => {
      if (drop.classList.contains("active")) {
        options.style.display = "none";
        arrow.setAttribute("src", "./images/arrow_right.svg");
      } else {
        options.style.display = "block";
        arrow.setAttribute("src", "./images/arrow_down.svg");
      }
      drop.classList.toggle("active");
      drop.classList.toggle("inactive");
      options.classList.toggle("active");
    });
  };

  setupOrientDropdown("video-0-orient", 0);
  setupOrientDropdown("video-1-orient", 1);

  window.applyVideoOrientation = applyVideoOrientation;
  window.getVideoOrientation = (idx) => videoControls["orient" + idx] ?? "0";

  // ── /Video orientation ─────────────────────────────────────────────────────

  setupDropdown("video-layout", getVideoLayouts, false);
  setupDropdown("video-0", getVideo0Displays, true);
  setupDropdown("video-1", getVideo1Displays, true);

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
    document.getElementById("video-layout-selected").textContent = option;

    if (videoControls.video0?.startsWith("camera:")) {
      const id = videoControls.video0.split("camera:")[1];
      option = `Camera: ${cameraLabelById[id] || "Camera"}`;
    } else {
      if (videoControls.video0 === "live-video-0") option = "Input 0";
      if (videoControls.video0 === "live-video-1") option = "Input 1";
      if (videoControls.video0 === "charts") option = "Charts";
      if (videoControls.video0 === "3d-visualization") option = "3D Visualization";
      if (videoControls.video0 === "none-0") option = "None";
    }
    document.getElementById("video-0-selected").textContent = option;

    if (videoControls.video1?.startsWith("camera:")) {
      const id = videoControls.video1.split("camera:")[1];
      option = `Camera: ${cameraLabelById[id] || "Camera"}`;
    } else {
      if (videoControls.video1 === "live-video-1") option = "Input 1";
      if (videoControls.video1 === "live-video-0") option = "Input 0";
      if (videoControls.video1 === "charts") option = "Charts";
      if (videoControls.video1 === "3d-visualization") option = "3D Visualization";
      if (videoControls.video1 === "none-1") option = "None";
    }
    document.getElementById("video-1-selected").textContent = option;

    // Restore orientation dropdowns from saved controls
    if (videoControls.orient0) {
      const match = ORIENT_OPTIONS.find((o) => o.value === videoControls.orient0);
      if (match) document.getElementById("video-0-orient-selected").textContent = match.label;
      applyVideoOrientation(0, videoControls.orient0);
    }
    if (videoControls.orient1) {
      const match = ORIENT_OPTIONS.find((o) => o.value === videoControls.orient1);
      if (match) document.getElementById("video-1-orient-selected").textContent = match.label;
      applyVideoOrientation(1, videoControls.orient1);
    }
  });

  // create the map
  buildMap("map");

  // create the charts
  const chartsConfig = [
    { name: "Avionics", color: t1Color },
    { name: "Airbrake", color: t2Color },
    { name: "Payload", color: t3Color },
  ];
  let altG = createChart("alt-graph", "s", "ft", 1, 1, chartsConfig);
  let spdG = createChart("spd-graph", "s", "ft/s", 1, 1, chartsConfig);

  let altwr = document.getElementById("alt-wrapper");
  let spdwr = document.getElementById("spd-wrapper");

  /// radio/commands

  const commandArgs = document.getElementById("command-args");
  const previousCommands = document.getElementById("previous-commands");

  let commandValid = false;
  let isCommand = true;
  let commandList = [];
  let controlsList = [];

  const getCommands = (idPrefix) => {
    const commandCallback = (option) => {
      let index = commandList.findIndex((command) => {
        return command.name === option;
      });
      document.getElementById("command-syntax").textContent =
        commandList[index].abbrv + ": " + commandList[index].syntax.join(" ");
      document.getElementById("command-args").value = commandList[index].abbrv + ": ";

      commandValid = commandList[index].validator(commandList[index].abbrv + ": ");
      if (commandValid) commandArgs.className = "valid";
      else commandArgs.className = "part-valid";
      return true;
    };

    if (commandList.length > 0) {
      setupStaticOptions(
        idPrefix,
        commandList.map((command) => command.name),
        commandCallback,
      );
    } else {
      setupStaticOptions(idPrefix, ["No commands available"], () => false);
    }
  };

  const getControls = (idPrefix) => {
    const controlCallback = (option) => {
      let index = controlsList.findIndex((command) => {
        return command.name === option;
      });
      document.getElementById("command-syntax").textContent =
        controlsList[index].name + " " + controlsList[index].syntax.join(" ");
      document.getElementById("command-args").value = controlsList[index].name + " ";

      commandValid = controlsList[index].validator(controlsList[index].name + " ");
      if (commandValid) commandArgs.className = "valid";
      else commandArgs.className = "part-valid";
      return true;
    };

    if (controlsList.length > 0) {
      setupStaticOptions(
        idPrefix,
        controlsList.map((command) => command.name),
        controlCallback,
      );
    } else {
      setupStaticOptions(idPrefix, ["No controls available"], () => false);
    }
  };

  api.getCommandList().then((list) => {
    commandList = APRSCmd.createCommandList(list);
    setupDropdown("command", getCommands, false);
  });

  api.getControlsList().then((list) => {
    controlsList = GSControl.createControlList(list);
  });

  commandArgs.addEventListener("input", () => {
    let commandText = commandArgs.value;

    if (commandText.length > 0 && isCommand) {
      let cmdMatch = commandText.match(/[A-Z]+(:( [A-z0-9])*)?/g);
      let foundCommand = false;

      if (cmdMatch) {
        let command = cmdMatch[0];
        let index = -1;
        if ((index = commandText.search(":")) > 0) {
          command = commandText.slice(0, index);
        }

        for (let i = 0; i < commandList.length; i++) {
          let cmdName = commandList[i].abbrv;
          if (cmdName === command) {
            document.getElementById("command-syntax").textContent =
              commandList[i].abbrv + ": " + commandList[i].syntax.join(" ");
            document.getElementById("command-selected").textContent = commandList[i].name;
            commandValid = commandList[i].validator(commandText);
            if (commandValid) commandArgs.className = "valid";
            else commandArgs.className = "part-valid";
            foundCommand = true;
            break;
          }
        }
      }
      if (!foundCommand) {
        document.getElementById("command-selected").textContent = "Select Command";
        document.getElementById("command-syntax").textContent = "No command selected";
        commandValid = false;
        commandArgs.className = "invalid";
      }
    } else if (commandText.length > 0 && !isCommand) {
      let cmdMatch = commandText.match(/[A-Z]+( [A-z0-9])*/g);
      let foundCommand = false;

      if (cmdMatch) {
        let command = cmdMatch[0];
        let index = -1;
        if ((index = commandText.search(" ")) > 0) {
          command = commandText.slice(0, index);
        }

        for (let i = 0; i < controlsList.length; i++) {
          let cmdName = controlsList[i].name;
          if (cmdName === command) {
            document.getElementById("command-syntax").textContent =
              controlsList[i].name + " " + controlsList[i].syntax.join(" ");
            document.getElementById("command-selected").textContent = controlsList[i].name;
            commandValid = controlsList[i].validator(commandText);
            if (commandValid) commandArgs.className = "valid";
            else commandArgs.className = "part-valid";
            foundCommand = true;
            break;
          }
        }
      }
      if (!foundCommand) {
        document.getElementById("command-selected").textContent = "Select Command";
        document.getElementById("command-syntax").textContent = "No command selected";
        commandValid = false;
        commandArgs.className = "invalid";
      }
    } else {
      document.getElementById("command-selected").textContent = "Select Command";
      document.getElementById("command-syntax").textContent = "No command selected";
      commandValid = false;
      commandArgs.className = "empty";
    }
  });

  document.getElementById("command-type").addEventListener("click", () => {
    isCommand = !isCommand;

    if (isCommand) {
      getCommands("command");
      document.getElementById("command-type").textContent = "Command";
    } else {
      getControls("command");
      document.getElementById("command-type").textContent = "Control";
    }

    document.getElementById("command-syntax").textContent = "No command selected";
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
    document.getElementById("command-syntax").textContent = "No command selected";
    commandArgs.value = "";
    document.getElementById("command-selected").textContent = "Select Command";
    commandArgs.className = "empty";

    const span = document.createElement("SPAN");
    span.className = "previous-command";
    span.textContent =
      "[" +
      new Date().toString().match(/[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/g) +
      "] > " +
      command;
    previousCommands.appendChild(span);

    if (isCommand) {
      api.sendCommand(command, 1);
    } else {
      api.sendCommand(command, 0);
    }
  });

  /// middle/data display

  const resizeGauges = () => {
    let gauges = document.getElementsByClassName("gauge");
    let size = document.getElementById("telem-1").offsetHeight * 0.35;
    let numGauges = gauges.length;
    for (let i = 0; i < numGauges; i++) {
      gauges[i].setAttribute("data-width", size);
      gauges[i].setAttribute("data-height", size);
    }
  };

  resizeGauges();
  window.onresize = resizeGauges;

  api.on("fullscreen-change", (res) => {
    if (res.win === "main") {
      fullscreened = res.isFullscreen;
    }
  });

  let lastCoords = [];
  let lastAlt = 0;
  let apogeeTime = 0;
  let loadedApogee = false;
  let apogeeFound = false;
  let t0Set = false;
  let t0 = {};
  let chartState = "seconds";

  {
    let chartDataIds = ["t1", "t2", "t3"];
    chartDataIds.forEach((idPrefix) => {
      let index = parseInt(idPrefix.split("t")[1]) - 1;

      altG.data.datasets[index].data = sessionStorage.getItem(idPrefix + "-altData")
        ? JSON.parse(sessionStorage.getItem(idPrefix + "-altData"))
        : [];
      spdG.data.datasets[index].data = sessionStorage.getItem(idPrefix + "-spdData")
        ? JSON.parse(sessionStorage.getItem(idPrefix + "-spdData"))
        : [];
    });

    altG.update();
    spdG.update();

    if (sessionStorage.getItem("apogee") && parseInt(sessionStorage.getItem("apogee"))) {
      document.getElementById("apogee-value").textContent =
        parseInt(sessionStorage.getItem("apogee")) + " ft";
      loadedApogee = true;
    }

    if (sessionStorage.getItem("t0")) {
      t0 = new Date(parseInt(sessionStorage.getItem("t0")));
      t0Set = true;

      setInterval(() => {
        document.getElementById("t-plus-value").textContent = mstohhmmss(Date.now() - t0);
      }, 10);
    }
  }

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

    document.getElementById(idPrefix + "-strength").textContent = metric.getRSSI() + " dBm";
    document.getElementById(idPrefix + "-bitrate").textContent =
      metric.getBitrate("k").toFixed(2) + " kbps";
  };

  const updateDisplays = (idPrefix, msg, updateFunctions) => {
    updateFunctions.forEach((f) => f(idPrefix, msg));
  };

  const updateGauges = (idPrefix, msg) => {
    let alt = document.getElementById(idPrefix + "-altitude");
    let spd = document.getElementById(idPrefix + "-speed");

    if (msg.getAlt() || msg.getAlt() === 0) {
      const altValue = msg.getAlt();
      alt.setAttribute("data-value-text", altValue);
      alt.setAttribute("data-value", altValue / 1000);

      const altText = document.getElementById(idPrefix + "-alt-text");
      altText.textContent = altValue + " ft";
      altText.setAttribute("data-length", altValue.toString().length);
    } else {
      alt.setAttribute("data-value-text", "\u2014");
    }

    if (msg.getSpeed() || msg.getSpeed() === 0) {
      const spdValue = msg.getSpeed();
      spd.setAttribute("data-value-text", spdValue);
      spd.setAttribute("data-value", spdValue);

      const spdText = document.getElementById(idPrefix + "-spd-text");
      spdText.textContent = spdValue + " ft/s";
      spdText.setAttribute("data-length", spdValue.toString().length);
    } else {
      spd.setAttribute("data-value-text", "\u2014");
    }
  };

  const updateStage = (idPrefix, msg) => {
    let stageEl = document.getElementById(idPrefix + "-stage");
    let stageNum = msg.getStateflag("Stage");

    let stageNames = [
      "Preflight",
      "Powered Flight",
      "Coast",
      "Drogue Deploy",
      "Main Parachute",
      "Landed",
    ];

    if (stageNum !== null && stageNum < stageNames.length) {
      stageEl.textContent = stageNames[stageNum];
    }
  };

  const updateLatLong = (idPrefix, msg) => {
    let fcoords = msg.getLatLongDecimal();
    document.getElementById(idPrefix + "-lat").textContent = fcoords
      ? fcoords.split("/")[0]
      : "00.0000\u00b0N";
    document.getElementById(idPrefix + "-long").textContent = fcoords
      ? fcoords.split("/")[1]
      : "000.0000\u00b0W";
  };

  const updateTemp = (idPrefix, msg) => {
    let tempEl = document.getElementById(idPrefix + "-temp");
    let tempNum = msg.getStateflag("Internal Temp");
    if (tempNum !== null) {
      tempEl.textContent = tempNum;
    }
  };

  const updateFlapAngle = (idPrefix, msg) => {
    let angleEl = document.getElementById(idPrefix + "-flap-angle");
    let angleNum = msg.getStateflag("Flap Angle");
    if (angleNum !== null) {
      angleEl.textContent = angleNum;
    }
  };

  const updatePredApogee = (idPrefix, msg) => {
    let apogeeEl = document.getElementById(idPrefix + "-apogee");
    let apogeeNum = msg.getStateflag("Predicted Apogee");
    if (apogeeNum !== null) {
      apogeeEl.textContent = apogeeNum;
    }
  };

  const updateHeading = (idPrefix, msg) => {
    let hdg = document.getElementById(idPrefix + "-heading");
    if (msg.getHeading() || msg.getHeading() === 0) {
      hdg.textContent = msg.getHeading();
    } else {
      hdg.innerHTML = "&#8212;";
    }
  };

  const updateCharts = (idPrefix, msg) => {
    let index = parseInt(idPrefix.split("t")[1]) - 1;
    if (t0Set) {
      let time = Date.now() - t0;
      let ts = time / 1000;

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
      } else if (ts > 120 * 60 && chartState != "hours") {
        let altData = altG.data.datasets[index].data;
        let spdData = spdG.data.datasets[index].data;
        let altLabels = altG.data.labels;
        let spdLabels = spdG.data.labels;

        altwr.innerHTML = '<canvas id="alt-graph" class="chart"></canvas>';
        spdwr.innerHTML = '<canvas id="spd-graph" class="chart"></canvas>';

        altG = createChart("alt-graph", "hr", "ft", 1 / 3600, 1, chartsConfig);
        spdG = createChart("spd-graph", "hr", "ft/s", 1 / 3600, 1, chartsConfig);
        altG.data.datasets[index].data = altData;
        spdG.data.datasets[index].data = spdData;
        altG.data.labels = altLabels;
        spdG.data.labels = spdLabels;
        chartState = "hours";
      }

      let factor = chartState == "minutes" ? 15 : chartState == "hours" ? 200 : 1;
      let interval = parseInt((ts - altG.data.datasets[index].data[0].x + 5 * factor) / 4);
      let arrL = [];
      for (let i = 0; i < 5; i++) {
        arrL[i] = Math.floor(altG.data.datasets[index].data[0].x) + i * interval;
      }

      altG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      spdG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      altG.options.scales.x.suggestedMax = ts + 10 * factor;
      spdG.options.scales.x.suggestedMax = ts + 10 * factor;

      altG.data.labels = JSON.parse(JSON.stringify(arrL));
      spdG.data.labels = JSON.parse(JSON.stringify(arrL));

      altG.data.datasets[index].data.push({ x: ts, y: msg.getAlt() ? msg.getAlt() : 0 });
      spdG.data.datasets[index].data.push({ x: ts, y: msg.getSpeed() ? msg.getSpeed() : 0 });

      sessionStorage.setItem(idPrefix + "-altData", JSON.stringify(altG.data.datasets[index].data));
      sessionStorage.setItem(idPrefix + "-spdData", JSON.stringify(spdG.data.datasets[index].data));

      altG.update();
      spdG.update();
    }
  };

  const updateMap = (idPrefix, msg) => {
    let coords = msg.getLatLong();
    if (coords[0] !== lastCoords[0] || coords[1] !== lastCoords[1]) {
      updateMarker(
        coords[0],
        coords[1],
        `<div style="display:flex;flex-direction:row;align-items:center;column-gap:1vh;"><img src="images/rocket.svg" alt="Rocket" style="height:min(3.5vh, 35px);margin-left:-1vh;"/><span style="margin-right:-1vh;font-size:min(12px,2.5vh);display:inline-block;">${msg.getLatLongDecimal(true)}</span></div>`,
      );
      lastCoords = coords;
    }
  };

  const updateT0 = (idPrefix, msg) => {
    if (msg.getStateflag("Stage") > 0 && !t0Set) {
      t0 = Date.now();
      sessionStorage.setItem("t0", t0);
      t0Set = true;
      for (let i = 0; i < 3; i++) {
        if (altG.data.datasets[i].data.length === 0) altG.data.datasets[i].data = [{ x: 0, y: null }];
        if (spdG.data.datasets[i].data.length === 0) spdG.data.datasets[i].data = [{ x: 0, y: null }];
      }
      setInterval(() => {
        document.getElementById("t-plus-value").textContent = mstohhmmss(Date.now() - t0);
      }, 10);
    }
  };

  const updateApogee = (idPrefix, msg) => {
    if (!loadedApogee) {
      if (msg.getAlt() >= lastAlt || msg.getStateflag("Stage") == 0) {
        lastAlt = msg.getAlt();
        apogeeTime = Date.now();
      }
      if (!apogeeFound && msg.getStateflag("Stage") > 0 && Date.now() - apogeeTime > 6000) {
        apogeeFound = true;
        document.getElementById("apogee-value").textContent = lastAlt + " ft";
        sessionStorage.setItem("apogee", lastAlt);
      }
    }
  };

  api.on("metrics", (metric) => {
    let m = new Metrics(metric);
    if (m.deviceId === 3) updateRadioStatus("telem", m);
    if (m.deviceId === 2) updateRadioStatus("video0", m);
    if (m.deviceId === 1) updateRadioStatus("video1", m);
  });

  api.on("data", (data) => {
    let msg = new APRSTelem(data);

    if (msg.stream === "telem-avionics") {
      updateDisplays("t1", msg, [
        updateT0,
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
      updateDisplays("t2", msg, [updateGauges, updateFlapAngle, updatePredApogee, updateStage, updateCharts]);
    }
    if (msg.stream === "telem-payload") {
      updateDisplays("t3", msg, [updateGauges, updateLatLong, updateHeading, updateStage, updateCharts]);
    }
  });

  api.on("serial-close", (portPath) => {
    if (portInUse.path === portPath) {
      const img = document.getElementById(portInUse.idPrefix + "-connection");
      img.setAttribute("src", "./images/serial_disconnected.svg");
      img.setAttribute("title", "Connection Error");
      document.getElementById(portInUse.idPrefix + "-selected").textContent = "Select Port";
      portInUse = { path: null, idPrefix: null };
    }
  });
};

const mstohhmmss = (ms) => {
  let seconds = Math.floor((ms / 1000) % 60) > 0 ? Math.floor((ms / 1000) % 60) : 0;
  let minutes = Math.floor((ms / (1000 * 60)) % 60) > 0 ? Math.floor((ms / (1000 * 60)) % 60) : 0;
  let hours = Math.floor((ms / (1000 * 60 * 60)) % 24) > 0 ? Math.floor((ms / (1000 * 60 * 60)) % 24) : 0;

  return `${hours < 10 ? "0" + hours : hours}:${minutes < 10 ? "0" + minutes : minutes}:${
    seconds < 10 ? "0" + seconds : seconds
  }`;
};