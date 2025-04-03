window.onload = () => {
  let fullscreened = false;
  let streamConfig, newStreamConfig;
  let commandList, newCommandList;
  let stateflagList, newStateflagList;
  let inputs = [];
  let saveCallbacks = [];

  let activeCommandIndex = null;
  let thisCommandTotalBits = 0;

  let activeStateflagIndex = null;

  let thisStateflagsTotalBits = 0;

  const stateFlagsTotalBits = 32;
  const commandTotalBits = 16;

  const streamWrapper = document.getElementById("streams-wrapper");
  const configWrapper = document.getElementById("commands-stateflags-wrapper");

  const streamContainer = document.getElementById("stream-container");

  const types = ["Telemetry", "Command", "Metrics", "Video"];
  const classes = ["APRSTelem", "APRSCmd", "Metrics", "video"];

  // saves the settings when the page is unloaded
  const handleNavigateAway = () => {
    // get new settings from each input
    saveCallbacks.forEach((c) => c());
    // check if the configs are equal
    if (!configEquals(streamConfig, newStreamConfig)) {
      api.setStreams(newStreamConfig);
    }

    saveCommand(activeCommandIndex);

    if (!configEquals(commandList, newCommandList)) {
      api.setCommandList(newCommandList);
    }

    saveStateflag(activeStateflagIndex);

    if (!configEquals(stateflagList, newStateflagList)) {
      api.setStateflagList(newStateflagList);
    }
  };

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
    handleNavigateAway();
    api.close("main");
  });

  document.getElementById("home").addEventListener("click", () => {
    handleNavigateAway();
  });

  /// update GUI when size changes
  api.on("fullscreen-change", (res) => {
    if (res.win === "main") {
      fullscreened = res.isFullscreen;
    }
  });

  const createStreamBox = (index, stream) => {
    streamContainer.innerHTML += `<div class="stream-box" id="stream-${index}">
        <div id="stream-${index}-toggle" class="toggle" title="Enable stream"></div>
        <div class="stream-box-left">
          <span class="stream-input-label">Stream Name</span>
          <input type="text" class="stream-name" id="stream-${index}-name" />
          <span class="stream-input-label">Stream Type</span>
          <div class="dropdown inactive stream-type" id="stream-${index}-type-drop">
            <span id="stream-${index}-type-selected">Select Type</span>
            <img
              src="../images/arrow_right.svg"
              alt=">"
              id="stream-${index}-type-arrow"
              class="drop-arrow"
            />
            <div class="options" id="stream-${index}-type-options"></div>
          </div>
          <span class="stream-input-label">Stream ID</span>
          <input type="number" class="stream-id" id="stream-${index}-id" />
          <button id="stream-${index}-configure" class="configure-stream">
            <img src="../images/settings.svg" alt="Configure" />
          </button>
        </div>
        <div class="stream-box-right">
          <button id="move-up-${index}" title="Move Up">
            <img
              src="../images/arrow_up.svg"
              alt="Move up"
              class="stream-button-img"
            />
          </button>
          <button id="move-down-${index}" title="Move Down">
            <img
              src="../images/arrow_down.svg"
              alt="Move Down"
              class="stream-button-img"
            />
          </button>
          <button id="remove-${index}">
            <img
              src="../images/close.svg"
              alt="Remove"
              class="stream-button-img"
            />
          </button>
        </div>
      </div>`;

    let typeVal = types[classes.indexOf(stream.type)];

    if (typeVal)
      document.getElementById(`stream-${index}-type-selected`).textContent =
        typeVal;
  };

  const setupStreamBox = (index, stream) => {
    document.getElementById(`stream-${index}-name`).value = stream.name;
    document.getElementById(`stream-${index}-id`).value = stream.id;

    const toggle = document.getElementById(`stream-${index}-toggle`);
    if (stream.enabled) setToggle(stream.enabled, toggle);

    toggle.addEventListener("click", () => {
      toggleToggle(toggle);
    });

    let streamType = types[classes.indexOf(stream.type)];
    const getStreamOptions = (idPrefix) => {
      setupStaticOptions(idPrefix, types, (option) => {
        streamType = option;
        return true;
      });
    };

    setupDropdown(`stream-${index}-type`, getStreamOptions, false);

    let configOpen = false;
    let div;
    document
      .getElementById(`stream-${index}-configure`)
      .addEventListener("click", () => {
        if (!configOpen) {
          if (streamType === "Telemetry") {
            div = document.createElement("DIV");
            div.className = "stateflags-config-box";
            div.innerHTML += `<div id="stateflags-bits-used-container" class="bits-used-container">
            <canvas id="stateflags-bits-used" class="bits-used"></canvas>
          </div>
          <div id="stateflags-selected-container"></div>
          `;
            if (index + 1 < streamContainer.childNodes.length)
              streamContainer.insertBefore(
                div,
                streamContainer.childNodes[index + 1]
              );
            else streamContainer.appendChild(div);

            // setup fill bar
            let stateFlagsBar = {
              canvas: document.getElementById("stateflags-bits-used"),
              ctx: document
                .getElementById("stateflags-bits-used")
                .getContext("2d"),
              cont: document.getElementById("stateflags-bits-used-container"),
            };

            thisStateflagsTotalBits = 0;

            resizeFillBar(
              stateFlagsBar,
              stateFlagsTotalBits,
              thisStateflagsTotalBits
            );

            // setup buttons
            const sfSeletedCont = document.getElementById(
              "stateflags-selected-container"
            );

            // make sure the right object structure exists
            if (!newStreamConfig[index].settings)
              newStreamConfig[index].settings = { stateflags: [] };
            if (!newStreamConfig[index].settings.stateflags)
              newStreamConfig[index].settings.stateflags = [];

            newStateflagList.forEach((sf) => {
              const button = document.createElement("button");
              button.textContent = sf.name + "\t"; // the \t is invisible
              button.className = "sf-button";
              const span = document.createElement("span");
              span.textContent = sf.width; // but it allows us to separate the name and width later
              span.className = "sf-width";
              button.appendChild(span);

              let isSelected = false;
              for (
                let i = 0;
                i < newStreamConfig[index].settings.stateflags.length;
                i++
              ) {
                if (sf.name === newStreamConfig[index].settings.stateflags[i]) {
                  isSelected = true;
                  button.classList.add("selected");
                  thisStateflagsTotalBits += sf.width;
                }
              }

              button.addEventListener("click", () => {
                if (!isSelected) {
                  if (
                    thisStateflagsTotalBits + sf.width <
                    stateFlagsTotalBits
                  ) {
                    button.classList.toggle("selected");
                    thisStateflagsTotalBits += sf.width;
                    setFillBarState(
                      stateFlagsBar,
                      stateFlagsTotalBits,
                      thisStateflagsTotalBits,
                      "#ca0000",
                      "lightgray"
                    );
                    isSelected = true;
                  }
                } else {
                  button.classList.toggle("selected");
                  thisStateflagsTotalBits -= sf.width;
                  setFillBarState(
                    stateFlagsBar,
                    stateFlagsTotalBits,
                    thisStateflagsTotalBits,
                    "#ca0000",
                    "lightgray"
                  );
                  isSelected = false;
                }
              });

              sfSeletedCont.appendChild(button);
            });

            // setup initial fill bar state
            setFillBarState(
              stateFlagsBar,
              stateFlagsTotalBits,
              thisStateflagsTotalBits,
              "#ca0000",
              "lightgray"
            );
            configOpen = true;
          }
        } else if (div) {
          // save settings
          const selectedEls = div.getElementsByClassName("selected");
          newStreamConfig[index].settings.stateflags = [];
          for (let i = 0; i < selectedEls.length; i++) {
            newStreamConfig[index].settings.stateflags.push(
              selectedEls[i].textContent.split("\t")[0]
            );
          }
          streamContainer.removeChild(div);
          configOpen = false;
        }
      });

    document
      .getElementById(`move-up-${index}`)
      .addEventListener("click", () => {
        if (index > 0) {
          // need to preserve settings before moving streams around
          for (let i = 0; i < newStreamConfig.length; i++) {
            getStreamSettings(i);
          }
          [newStreamConfig[index - 1], newStreamConfig[index]] = [
            newStreamConfig[index],
            newStreamConfig[index - 1],
          ];
          loadStreamInputs();
        }
      });
    document
      .getElementById(`move-down-${index}`)
      .addEventListener("click", () => {
        if (index < newStreamConfig.length - 1) {
          // need to preserve settings before moving streams around
          for (let i = 0; i < newStreamConfig.length; i++) {
            getStreamSettings(i);
          }
          [newStreamConfig[index + 1], newStreamConfig[index]] = [
            newStreamConfig[index],
            newStreamConfig[index + 1],
          ];
          loadStreamInputs();
        }
      });
    document.getElementById(`remove-${index}`).addEventListener("click", () => {
      // need to preserve settings before moving streams around
      for (let i = 0; i < newStreamConfig.length; i++) {
        // skip the one we're removing
        if (i !== index) getStreamSettings(i);
      }
      newStreamConfig.splice(index, 1);
      saveCallbacks.splice(index, 1);
      loadStreamInputs();
    });
  };

  /**
   * Sets the state of a custom toggle
   * @param {Boolean} state The on or off state of the toggle
   * @param {HTMLDivElement} toggle The toggle to be modified
   */
  const setToggle = (state, toggle) => {
    // get the style (including that from external css sheets)
    let style = getComputedStyle(toggle);
    // convert the width in pixels to vw
    let width = (parseInt(style.width) * 100) / window.innerWidth;
    // get the current left offset (in vw)
    let pos = parseFloat(style.getPropertyValue("--toggle-pos"));
    // set the toggle to the right if it is not already there and desired state is true
    if (state && pos < width / 2) {
      toggle.style.setProperty("--toggle-pos", width * 0.5 + pos + 0.05 + "vw");
      toggle.style.setProperty("background-color", "#ca0000");
    }
    // set the toggle to the left if it is not already there and desired state is false
    if (!state && pos > width / 2) {
      toggle.style.setProperty("--toggle-pos", pos - 0.5 * width - 0.05 + "vw");
      toggle.style.setProperty("background-color", "lightgray");
    }
  };

  // toggle the state of the current toggle, rather than setting it to a particular state
  const toggleToggle = (toggle) => {
    // get the style (including that from external css sheets)
    let style = getComputedStyle(toggle);
    // convert the width in pixels to vw
    let width = (parseInt(style.width) * 100) / window.innerWidth;
    // get the current left offset (in vw)
    let pos = parseFloat(style.getPropertyValue("--toggle-pos"));
    // set the toggle to the right if it is not already there and desired state is true
    if (pos < width / 2) {
      toggle.style.setProperty("--toggle-pos", width * 0.5 + pos + 0.05 + "vw");
      toggle.style.setProperty("background-color", "#ca0000");
    }
    // set the toggle to the left if it is not already there and desired state is false
    if (pos > width / 2) {
      toggle.style.setProperty("--toggle-pos", pos - 0.5 * width - 0.05 + "vw");
      toggle.style.setProperty("background-color", "lightgray");
    }
  };

  // get the current state of the given toggle
  const getToggleState = (toggle) => {
    // get the style (including that from external css sheets)
    let style = getComputedStyle(toggle);
    // convert the width in pixels to vw
    let width = (parseInt(style.width) * 100) / window.innerWidth;
    // get the current left offset (in vw)
    let pos = parseFloat(style.getPropertyValue("--toggle-pos"));
    return !(pos < width / 2);
  };

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
            .setAttribute("src", "../images/arrow_right.svg");
        } else {
          options.style.display = "block";
          // if we want to reload the dropdown every time
          if (reload) callback(idPrefix); // call callback if we're opening the dropdown
          document
            .getElementById(idPrefix + "-arrow")
            .setAttribute("src", "../images/arrow_down.svg");
        }
        drop.classList.toggle("active");
        drop.classList.toggle("inactive");
        options.classList.toggle("active");
      });
  };

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

  const getStreamSettings = (i) => {
    const nameVal = document.getElementById(`stream-${i}-name`).value; // TODO: input validation
    let typeVal = document.getElementById(
      `stream-${i}-type-selected`
    ).textContent;
    const idVal = document.getElementById(`stream-${i}-id`).value;

    if (idVal && parseInt(idVal)) newStreamConfig[i].id = parseInt(idVal);

    typeVal = classes[types.indexOf(typeVal)];

    if (nameVal) newStreamConfig[i].name = nameVal;
    if (typeVal) {
      newStreamConfig[i].type = typeVal;
    }

    newStreamConfig[i].enabled = getToggleState(
      document.getElementById(`stream-${i}-toggle`)
    );
  };

  const loadStreamInputs = () => {
    while (streamContainer.childElementCount > 0) {
      streamContainer.removeChild(streamContainer.firstChild);
    }

    inputs = [];
    saveCallbacks = [];

    // generate html for each input
    for (let i = 0; i < newStreamConfig.length; i++) {
      inputs.push(createStreamBox(i, newStreamConfig[i]));
    }

    // setup each input
    // for why this needs to be a different loop see:
    // https://stackoverflow.com/questions/36946159/adding-addeventlistener-in-loop-only-works-for-last-button
    for (let i = 0; i < newStreamConfig.length; i++) {
      setupStreamBox(i, newStreamConfig[i]);
      // callback for saving settings
      saveCallbacks.push(() => {
        getStreamSettings(i);

        // TODO: better input validation here
        if (
          newStreamConfig[i].name === null ||
          newStreamConfig[i].type === null ||
          newStreamConfig[i].id === null
        ) {
          newStreamConfig.splice(i, 1);
        }
      });
    }
  };

  // get the current settings from main and setup each input accordingly
  api.getStreams().then((c) => {
    streamConfig = c;
    // need to copy the config otherwise config and newConfig will always be the same
    newStreamConfig = JSON.parse(JSON.stringify(streamConfig));

    loadStreamInputs();
  });

  document.getElementById("export-config").addEventListener("click", () => {
    api.exportStreamConfig();
  });

  document.getElementById("new-stream").addEventListener("click", () => {
    // need to preserve settings before moving streams around
    for (let i = 0; i < newStreamConfig.length; i++) {
      getStreamSettings(i);
    }
    let stream = {
      name: null,
      type: null,
      id: null,
    };
    newStreamConfig.push(stream);
    loadStreamInputs();
  });

  document.getElementById("edit-config").addEventListener("click", () => {
    streamWrapper.classList.toggle("active");
    configWrapper.classList.toggle("active");
  });

  document.getElementById("go-back").addEventListener("click", () => {
    streamWrapper.classList.toggle("active");
    configWrapper.classList.toggle("active");
  });

  // edit commands section

  let commandBar = {
    canvas: document.getElementById("command-bits-used"),
    ctx: document.getElementById("command-bits-used").getContext("2d"),
    cont: document.getElementById("command-bits-used-container"),
  };

  let commandNumSlots = commandTotalBits;

  const resizeFillBar = (bar, numSlots, filled) => {
    bar.ctx.clearRect(0, 0, bar.canvas.width, bar.canvas.height);
    bar.canvas.width = bar.cont.offsetWidth;
    bar.canvas.height = bar.cont.offsetHeight;

    setFillBarState(bar, numSlots, filled, "#ca0000", "lightgray");
  };

  const setFillBarState = (bar, numSlots, filled, onColor, offColor) => {
    let verticalBuffer = bar.cont.offsetHeight * 0.1;
    let slotWidth = bar.cont.offsetWidth / (2 * numSlots + 1);
    let slotHeight = bar.cont.offsetHeight - 2 * verticalBuffer;
    bar.ctx.clearRect(0, 0, bar.canvas.width, bar.canvas.height);

    for (let i = 0; i < numSlots; i++) {
      if (i < filled) {
        bar.ctx.fillStyle = onColor;
        bar.ctx.fillRect(
          slotWidth + 2 * i * slotWidth,
          verticalBuffer,
          slotWidth,
          slotHeight
        );
      } else {
        bar.ctx.fillStyle = offColor;
        bar.ctx.fillRect(
          slotWidth + 2 * i * slotWidth,
          verticalBuffer,
          slotWidth,
          slotHeight
        );
      }
    }
  };

  const handleResize = () => {
    resizeFillBar(commandBar, commandNumSlots, thisCommandTotalBits);
  };

  handleResize();

  window.onresize = handleResize;

  // command handling variables and functions

  const commandName = document.getElementById("command-name");
  const commandFunctionName = document.getElementById("command-function-name");
  const commandSyntaxArgs = [];
  const commandWidthArgs = [];
  const commandTypeArgs = [];
  const commandConversionListArgs = [];

  const createArgConfig = (container, index) => {
    container.innerHTML += `<div id="arg-${index}-wrapper" class="arg-wrapper">
            <span class="arg-title">Argument ${index}</span>
            <input
              type="text"
              id="arg-${index}-syntax"
              class="arg-syntax"
              placeholder="Syntax"
            />
            <input
              type="number"
              id="arg-${index}-width"
              class="arg-width"
              placeholder="Width"
            />
            <input
              type="text"
              id="arg-${index}-type"
              class="arg-type"
              placeholder="Type"
            />
            <input
              type="text"
              id="arg-${index}-conversion-list"
              class="arg-conversion-list"
              placeholder="Conversion List (string type only)"
              disabled
            />
          </div>`;
  };

  const setupArgConfig = (index) => {
    // event listeners
    commandWidthArgs[index].addEventListener("input", () => {
      let newWidth = commandWidthArgs[index].value;
      if (newWidth) {
        thisCommandTotalBits = parseInt(newWidth);
        for (
          let i = 0;
          i < newCommandList[activeCommandIndex].encoding.length;
          i++
        ) {
          if (i !== index)
            thisCommandTotalBits +=
              newCommandList[activeCommandIndex].encoding[i];
        }

        setFillBarState(
          commandBar,
          commandNumSlots,
          thisCommandTotalBits,
          "#ca0000",
          "lightgray"
        );
      }
    });

    commandTypeArgs[index].addEventListener("input", () => {
      let newType = commandTypeArgs[index].value;
      if (newType === "string") {
        commandConversionListArgs[index].disabled = false;
      } else {
        commandConversionListArgs[index].disabled = true;
      }
    });
  };

  const saveCommand = (commandIndex) => {
    if (commandIndex !== null) {
      let name = commandName.value;
      // cannot save if no name or encoding too long
      if (!name) {
        // removing the name will delete the command
        newCommandList.splice(commandIndex, 1);
        // otherwise we just won't save it
      } else if (thisCommandTotalBits <= commandTotalBits) {
        // otherwise can save
        // TODO: better input validation here
        newCommandList[commandIndex].name = name;
        newCommandList[commandIndex].functionName = commandFunctionName.value;

        for (let i = 0; i < commandTotalBits; i++) {
          let syntax = commandSyntaxArgs[i].value;
          let width = commandWidthArgs[i].value;
          let type = commandTypeArgs[i].value;
          if (type === "string") {
            let conversionListStr = commandConversionListArgs[i].value;
            if (syntax && width && type && conversionListStr) {
              // then this is a valid arg
              // trim whitespace from each arg
              let newConversionList = conversionListStr.split(",");
              for (let i = 0; i < newConversionList.length; i++) {
                newConversionList[i] = newConversionList[i].trim();
              }
              // filter out empty strings
              newConversionList = newConversionList.filter((entry) => {
                return entry != "";
              });
              if (i < newCommandList[commandIndex].syntax.length) {
                // we are updating and existing arg, so just set
                newCommandList[commandIndex].syntax[i] = syntax;
                newCommandList[commandIndex].encoding[i] = parseInt(width);
                newCommandList[commandIndex].type[i] = type;
                newCommandList[commandIndex].conversionList[i] =
                  newConversionList;
              } else {
                // we are adding a new arg so we need to push
                newCommandList[commandIndex].syntax.push(syntax);
                newCommandList[commandIndex].encoding.push(parseInt(width));
                newCommandList[commandIndex].type.push(type);
                // create new array as necessary
                if (!newCommandList[commandIndex].conversionList)
                  newCommandList[commandIndex].conversionList = [];
                newCommandList[commandIndex].conversionList.push(
                  newConversionList
                );
              }
            }
          } else {
            if (syntax && width && type) {
              // then this is a valid arg
              if (i < newCommandList[commandIndex].syntax.length) {
                // we are updating and existing arg, so just set
                newCommandList[commandIndex].syntax[i] = syntax;
                newCommandList[commandIndex].encoding[i] = parseInt(width);
                newCommandList[commandIndex].type[i] = type;
                // don't need a conversion list
              } else {
                // we are adding a new arg so we need to push
                newCommandList[commandIndex].syntax.push(syntax);
                newCommandList[commandIndex].encoding.push(parseInt(width));
                newCommandList[commandIndex].type.push(type);
                // don't need a conversion list
              }
            }
          }
        }

        // set non manually input settings
        let abbreviation = "";
        name.split(" ").forEach((word) => {
          abbreviation += word.toUpperCase()[0];
        });
        newCommandList[commandIndex].abbrv = abbreviation;
        newCommandList[commandIndex].num = commandIndex;
      }
    }
  };

  const loadCommand = (commandIndex) => {
    // always everything to empty string
    commandName.value = "";
    commandFunctionName.value = "";
    commandSyntaxArgs.forEach((el) => {
      el.value = "";
    });
    commandWidthArgs.forEach((el) => {
      el.value = "";
    });
    commandTypeArgs.forEach((el) => {
      el.value = "";
    });
    commandConversionListArgs.forEach((el) => {
      el.value = "";
    });

    if (commandIndex === null) {
      // update active command and add new command to array
      activeCommandIndex = newCommandList.length;
      newCommandList.push({
        name: "",
        abbrv: "",
        num: null,
        syntax: [],
        encoding: [],
        type: [],
        functionName: "",
      });

      // update fill bar
      thisCommandTotalBits = 0;
      setFillBarState(
        commandBar,
        commandNumSlots,
        thisCommandTotalBits,
        "#ca0000",
        "lightgray"
      );
    } else if (commandIndex < newCommandList.length) {
      // load normally
      // reset total bits to 0
      thisCommandTotalBits = 0;

      // set name and function name
      commandName.value = newCommandList[commandIndex].name;
      commandFunctionName.value = newCommandList[commandIndex].functionName;

      // set all args
      for (let i = 0; i < newCommandList[commandIndex].syntax.length; i++) {
        commandSyntaxArgs[i].value = newCommandList[commandIndex].syntax[i];
      }
      for (let i = 0; i < newCommandList[commandIndex].encoding.length; i++) {
        commandWidthArgs[i].value = newCommandList[commandIndex].encoding[i];
        thisCommandTotalBits += newCommandList[commandIndex].encoding[i];
      }
      for (let i = 0; i < newCommandList[commandIndex].type.length; i++) {
        commandTypeArgs[i].value = newCommandList[commandIndex].type[i];
        if (newCommandList[commandIndex].type[i] === "string")
          commandConversionListArgs[i].disabled = false;
        else commandConversionListArgs[i].disabled = true;
      }
      // make sure the conversion list exists
      if (newCommandList[commandIndex].conversionList) {
        for (
          let i = 0;
          i < newCommandList[commandIndex].conversionList.length;
          i++
        ) {
          commandConversionListArgs[i].value =
            newCommandList[commandIndex].conversionList[i].join(", ");
        }
      }

      // set the fill bar to represent total number of bits
      setFillBarState(
        commandBar,
        commandNumSlots,
        thisCommandTotalBits,
        "#ca0000",
        "lightgray"
      );

      activeCommandIndex = commandIndex;
    } else {
      console.warn(
        "Developer warning: tried to load command at " +
          commandIndex +
          " that doesn't exist. Max is " +
          (newCommandList.length - 1) +
          "."
      );
    }
  };

  const loadCommands = () => {
    const commandContainer = document.getElementById(
      "command-configuration-wrapper"
    );

    // remove all elements
    while (commandContainer.childElementCount > 0) {
      commandContainer.removeChild(commandContainer.firstChild);
    }

    for (let i = 0; i < commandTotalBits; i++) {
      createArgConfig(commandContainer, i);
    }

    for (let i = 0; i < commandTotalBits; i++) {
      commandSyntaxArgs.push(document.getElementById(`arg-${i}-syntax`));
      commandWidthArgs.push(document.getElementById(`arg-${i}-width`));
      commandTypeArgs.push(document.getElementById(`arg-${i}-type`));
      commandConversionListArgs.push(
        document.getElementById(`arg-${i}-conversion-list`)
      );
      setupArgConfig(i);
    }

    const getAvailCommands = (idPrefix) => {
      // remove existing elements
      const options = document.getElementById(idPrefix + "-options");
      while (options.childElementCount > 0) {
        options.removeChild(options.firstChild);
      }

      const selected = document.getElementById(idPrefix + "-selected");
      // add option to create new command
      const span = document.createElement("SPAN");
      span.className = idPrefix;
      span.textContent = "Create new command";
      span.addEventListener("click", () => {
        selected.textContent = "New Command";
        // save existing settings
        saveCommand(activeCommandIndex);
        // set all values to empty
        loadCommand(null);
      });
      options.appendChild(span);
      // add existing commands
      for (let i = 0; i < newCommandList.length; i++) {
        // create a new option in the dropdown for this port
        const span = document.createElement("SPAN");
        span.className = idPrefix;
        span.textContent = i + ": " + newCommandList[i].name;
        span.addEventListener("click", () => {
          selected.textContent = i + ": " + newCommandList[i].name;
          // save existing settings
          saveCommand(activeCommandIndex);
          // put current settings in
          loadCommand(i);
        });
        options.appendChild(span);
      }
    };

    setupDropdown("command-create", getAvailCommands, true);
  };

  // load commands
  api.getCommandList().then((list) => {
    commandList = list;
    // need to copy the config otherwise config and newConfig will always be the same
    newCommandList = JSON.parse(JSON.stringify(commandList));

    loadCommands();
  });

  // stateflags

  const sfName = document.getElementById("stateflag-name");
  const sfWidth = document.getElementById("stateflag-width");
  const sfFunctionName = document.getElementById("stateflag-function-name");

  const saveStateflag = (index) => {
    if (index !== null) {
      // get all settings
      let name = sfName.value;
      let width = sfWidth.value;
      let functionName = sfFunctionName.value;

      if (name && width && functionName) {
        // save the settings
        newStateflagList[index].name = name;
        newStateflagList[index].width = parseInt(width);
        newStateflagList[index].functionName = functionName;
      } else {
        // otherwise remove the state valid (invalid input)
        newStateflagList.splice(index, 1);
      }
    }
  };

  const loadStateflag = (index) => {
    sfName.value = "";
    sfWidth.value = "";
    sfFunctionName.value = "";
    if (index === null) {
      activeStateflagIndex = newStateflagList.length;
      newStateflagList.push({
        name: "",
        width: null,
        functionName: "",
      });
    } else {
      sfName.value = newStateflagList[index].name;
      sfWidth.value = newStateflagList[index].width;
      sfFunctionName.value = newStateflagList[index].functionName;

      activeStateflagIndex = index;
    }
  };

  const loadStateflags = () => {
    const getAvailStateflags = (idPrefix) => {
      // remove existing elements
      const options = document.getElementById(idPrefix + "-options");
      while (options.childElementCount > 0) {
        options.removeChild(options.firstChild);
      }

      const selected = document.getElementById(idPrefix + "-selected");
      // add option to create new command
      const span = document.createElement("SPAN");
      span.className = idPrefix;
      span.textContent = "Create new stateflag";
      span.addEventListener("click", () => {
        selected.textContent = "New Stateflag";
        // save existing settings
        saveStateflag(activeStateflagIndex);
        // set all values to empty
        loadStateflag(null);
      });
      options.appendChild(span);
      // add existing commands
      for (let i = 0; i < newStateflagList.length; i++) {
        // create a new option in the dropdown for this port
        const span = document.createElement("SPAN");
        span.className = idPrefix;
        span.textContent = i + ": " + newStateflagList[i].name;
        span.addEventListener("click", () => {
          selected.textContent = i + ": " + newStateflagList[i].name;
          // save existing settings
          saveStateflag(activeStateflagIndex);
          // put current settings in
          loadStateflag(i);
        });
        options.appendChild(span);
      }
    };

    setupDropdown("stateflag-create", getAvailStateflags, true);
  };

  api.getStateflagList().then((list) => {
    stateflagList = list;
    // need to copy the config otherwise config and newConfig will always be the same
    newStateflagList = JSON.parse(JSON.stringify(stateflagList));

    loadStateflags();
  });

  // compares to given config objects
  const configEquals = (config1, config2) => {
    // objects should always have the same keys
    if (config1.length !== config2.length) return false;
    for (let j = 0; j < config1.length; j++) {
      const keyList = Object.keys(config1[j]);
      const keyListLen = keyList.length;
      for (let i = 0; i < keyListLen; i++) {
        try {
          if (
            // without this check this function returns false every time
            // typeof config1[j][keyList[i]] !== "object" &&
            JSON.stringify(config1[j][keyList[i]]) !==
            JSON.stringify(config2[j][keyList[i]])
          )
            return false;
        } catch (err) {
          // should really only happen if somehow one config has an attribute another doesn't
          console.error("Failed to compare configs: " + err.message);
          return false;
        }
      }
    }
    return true;
  };
};
