window.onload = () => {
  let fullscreened = false;
  let streamConfig, newStreamConfig;
  let inputs = [];
  let saveCallbacks = [];

  const mainContainer = document.getElementById("stream-container");

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
    mainContainer.innerHTML += `<div class="stream-box" id="stream-${index}">
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

    const getStreamOptions = (idPrefix) => {
      setupStaticOptions(idPrefix, types, () => {
        return true;
      });
    };

    setupDropdown(`stream-${index}-type`, getStreamOptions, false);

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

    typeVal = classes[types.indexOf(typeVal)];

    if (nameVal) newStreamConfig[i].name = nameVal;
    if (typeVal) {
      newStreamConfig[i].type = typeVal;
    }
    if (idVal && parseInt(idVal)) newStreamConfig[i].id = parseInt(idVal);
  };

  const loadStreamInputs = () => {
    while (mainContainer.childElementCount > 0) {
      mainContainer.removeChild(mainContainer.firstChild);
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

  // compares to given config objects
  const configEquals = (config1, config2) => {
    // objects should always have the same keys
    if (config1.length !== config2.length) return false;
    for (let j = 0; j < config1.length; j++) {
      const keyList = Object.keys(config1[j]);
      const keyListLen = keyList.length;
      for (let i = 0; i < keyListLen; i++) {
        try {
          if (config1[j][keyList[i]] !== config2[j][keyList[i]]) return false;
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
