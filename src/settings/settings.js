window.onload = () => {
  let fullscreened = false;
  let config, newConfig;
  let inputs = {};
  let saveCallbacks = [];

  const settingsContainer = document.getElementById("main-settings");

  // saves the settings when the page is unloaded
  const handleNavigateAway = (showAlert) => {
    // get new settings from each input
    saveCallbacks.forEach((c) => c());
    // check if the configs are equal
    if (!configEquals(config, newConfig)) {
      api.setSettings(newConfig);
      if (showAlert)
        alert(
          "Application settings have changed. Please restart for changes to take affect!"
        );
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
    handleNavigateAway(false);
    api.close("main");
  });

  document.getElementById("home").addEventListener("click", () => {
    handleNavigateAway(true);
  });

  /// update GUI when size changes
  api.on("fullscreen-change", (res) => {
    if (res.win === "main") {
      fullscreened = res.isFullscreen;
    }
  });

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

  const createDropdown = (key, name, description, value) => {
    // creates the html for a new dropdown input
    settingsContainer.innerHTML += `<div
        id="${key}-box"
        class="settings-box"
        title="${description}"
      >
        <span id="${key}-label" class="settings-label"></span>
        <div class="dropdown inactive settings-selector" id="${key}-drop">
          <span id="${key}-selected"></span>
          <img src="../images/arrow_right.svg" alt=">" id="${key}-arrow" class="drop-arrow"/>
          <div class="options" id="${key}-options">
          </div>
        </div>
      </div>`;
    document.getElementById(`${key}-label`).textContent = name + ":";
    document.getElementById(`${key}-selected`).textContent = value;
    // returns the outermost container
    return document.getElementById(`${key}-box`);
  };

  const createToggle = (key, name, description) => {
    // creates the html for a new toggle input
    settingsContainer.innerHTML += `<div
        id="${key}-box"
        class="settings-box"
        title="${description}"
      >
        <span id="${key}-label" class="settings-label"></span>
        <div id="${key}-toggle" class="toggle settings-selector"></div>
      </div>`;

    document.getElementById(`${key}-label`).textContent = name + ":";
    // returns the outermost container
    return document.getElementById(`${key}-box`);
  };

  const createNumber = (key, name, description, range) => {
    // create the html for a new number input
    settingsContainer.innerHTML += `<div
        id="${key}-box"
        class="settings-box"
        title="${description}"
      >
        <span id="${key}-label" class="settings-label"></span>
        <input
          type="number"
          name="${key}"
          id="${key}-input"
          ${range[0] == -1 ? "" : `min=${range[0]}`}
          ${range[1] == -1 ? "" : `max=${range[1]}`}
          class="settings-selector"
        />
      </div>`;
    document.getElementById(`${key}-label`).textContent = name + ":";
    // returns the outermost container
    return document.getElementById(`${key}-box`);
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

  const loadSettingsInputs = () => {
    // generate html for each input
    Object.keys(newConfig).forEach((key) => {
      if (newConfig[key].type === "dropdown") {
        inputs[key] = createDropdown(
          key,
          newConfig[key].name,
          newConfig[key].description,
          newConfig[key].value
        );
      }
      if (config[key].type === "toggle") {
        inputs[key] = createToggle(
          key,
          newConfig[key].name,
          newConfig[key].description
        );
      }
      if (config[key].type === "number") {
        inputs[key] = createNumber(
          key,
          newConfig[key].name,
          newConfig[key].description,
          newConfig[key].range
        );
      }
    });

    // setup each input
    // for why this needs to be a different loop see:
    // https://stackoverflow.com/questions/36946159/adding-addeventlistener-in-loop-only-works-for-last-button
    Object.keys(newConfig).forEach((key) => {
      if (newConfig[key].type === "dropdown") {
        // setup event listeners and options
        let callback = (idPrefix) => {
          setupStaticOptions(idPrefix, newConfig[key].range, (option) => {
            return true;
          });
        };
        setupDropdown(key, callback, false);

        // callback for saving settings
        saveCallbacks.push(() => {
          newConfig[key].value = parseFloat(
            document.getElementById(`${key}-selected`).textContent
          );
        });
      }
      if (newConfig[key].type === "toggle") {
        // setup current state and click listener
        const toggle = document.getElementById(`${key}-toggle`);
        setToggle(newConfig[key].value, toggle);
        toggle.addEventListener("click", () => {
          toggleToggle(toggle);
        });

        // callback for saving settings
        saveCallbacks.push(() => {
          newConfig[key].value = getToggleState(toggle);
        });
      }
      if (newConfig[key].type === "number") {
        // set current value
        const input = document.getElementById(`${key}-input`);
        input.value = newConfig[key].value;

        // callback for saving settings
        saveCallbacks.push(() => {
          if (input.value !== "") {
            newConfig[key].value = parseInt(input.value);
          }
        });
      }
    });
  };

  // get the current settings from main and setup each input accordingly
  api.getSettings().then((c) => {
    config = c;
    // need to copy the config otherwise config and newConfig will always be the same
    newConfig = JSON.parse(JSON.stringify(config));

    loadSettingsInputs();
  });

  // click listener for the reset settings button
  document.getElementById("reset-settings").addEventListener("click", () => {
    // get defaults from main
    api.resetSettings().then((defaultSettings) => {
      newConfig = defaultSettings;

      // get rid of everything in the container for settings inputs
      while (settingsContainer.childElementCount > 0) {
        settingsContainer.removeChild(settingsContainer.firstChild);
      }

      // need to reset the state of all the inputs
      loadSettingsInputs();
    });
  });

  // click listener for the clear map cache button
  document.getElementById("clear-cache").addEventListener("click", () => {
    api.clearTileCache();
  });

  // compares to given config objects
  const configEquals = (config1, config2) => {
    // objects should always have the same keys
    const keyList = Object.keys(config1);
    const keyListLen = keyList.length;
    for (let i = 0; i < keyListLen; i++) {
      try {
        if (config1[keyList[i]].value !== config2[keyList[i]].value)
          return false;
      } catch (err) {
        // should really only happen if somehow one config has an attribute another doesn't
        console.error("Failed to compare configs: " + err.message);
        return false;
      }
    }
    return true;
  };
};
