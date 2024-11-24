window.onload = () => {
  let config, newConfig;

  // saves the settings when the page is unloaded
  const handleNavigateAway = (showAlert) => {
    if (cacheMaxSize.value != "") {
      newConfig.cacheMaxSize = parseInt(cacheMaxSize.value);
    }
    if (baudRate.value != "") {
      newConfig.baudRate = parseInt(baudRate.value);
    }
    newConfig.scale = parseFloat(scale.textContent);
    if (!configEquals(config, newConfig)) {
      api.setSettings(newConfig);
      if (showAlert)
        alert(
          "Application settings have changed. Please restart for changes to take affect!"
        );
    }
  };

  //app control button listeners
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

  // the main settings inputs
  let scale = document.getElementById("scale-selected"),
    debugToggle = document.getElementById("debug-toggle"),
    videoToggle = document.getElementById("video-toggle"),
    //tileToggle = document.getElementById("tile-toggle"), //added tile toggling here
    cacheMaxSize = document.getElementById("cacheMaxSize-input"),
    baudRate = document.getElementById("baudRate-input");

  // get the current settings from main and set each input accordingly
  api.getSettings().then((c) => {
    config = c;
    newConfig = JSON.parse(JSON.stringify(config));
    scale.textContent = config.scale.toFixed(2);
    setToggle(config.debug, debugToggle);
    setToggle(config.video, videoToggle);
    //setToggle(config.noGUI, tileToggle); //added tile toggling here
    cacheMaxSize.value = config.cacheMaxSize;
    baudRate.value = config.baudRate;
  });

  // click listener for activating the scale dropdown
  document.getElementById("scale-drop").addEventListener("click", () => {
    const drop = document.getElementById("scale-drop");
    const options = document.getElementById("scale-options");
    if (drop.classList.contains("active")) {
      options.style.display = "none";
      document
        .getElementById("scale-arrow")
        .setAttribute("src", "../images/arrow_right.svg");
    } else {
      options.style.display = "block";
      document
        .getElementById("scale-arrow")
        .setAttribute("src", "../images/arrow_down.svg");
    }
    drop.classList.toggle("active");
    drop.classList.toggle("inactive");
    options.classList.toggle("active");
  });

  // click listeners for each scale option
  const scaleOpts = document.getElementsByClassName("scale");
  const scaleSelected = document.getElementById("scale-selected");
  let scaleLen = scaleOpts.length;
  for (let i = 0; i < scaleLen; i++) {
    scaleOpts[i].addEventListener("click", () => {
      scaleSelected.textContent = scaleOpts[i].textContent;
    });
  }

  // click listeners for each debug scale option
  const dScaleOpts = document.getElementsByClassName("debug-scale");
  const dScaleSelected = document.getElementById("debug-scale-selected");
  let dScaleLen = dScaleOpts.length;
  for (let i = 0; i < dScaleLen; i++) {
    dScaleOpts[i].addEventListener("click", () => {
      dScaleSelected.textContent = dScaleOpts[i].textContent;
    });
  }

  // click listeners for the toggles
  debugToggle.addEventListener("click", () => {
    newConfig.debug = !newConfig.debug;
    setToggle(newConfig.debug, debugToggle);
  });

  videoToggle.addEventListener("click", () => {
    newConfig.video = !newConfig.video;
    setToggle(newConfig.video, videoToggle);
  });

  // click listener for the reset settings button
  document.getElementById("reset-settings").addEventListener("click", () => {
    // reset the object (should be the same as the default settings in main.js)
    newConfig = {
      scale: 1,
      debug: false,
      video: false,
      cacheMaxSize: 100000000,
      baudRate: 115200,
    };

    // reset the inputs
    scale.textContent = newConfig.scale.toFixed(2);
    setToggle(newConfig.debug, debugToggle);
    setToggle(newConfig.video, videoToggle);
    cacheMaxSize.value = newConfig.cacheMaxSize;
    baudRate.value = newConfig.baudRate;
  });

  // click listener for the clear map cache button
  document.getElementById("clear-cache").addEventListener("click", () => {
    api.clearTileCache();
  });

  const configEquals = (config1, config2) => {
    console.log(
      config1.scale === config2.scale,
      config1.debug === config2.debug,
      config1.video === config2.video,
      config1.cacheMaxSize === config2.cacheMaxSize,
      config1.baudRate === config2.baudRate
    );
    return (
      config1.scale === config2.scale &&
      config1.debug === config2.debug &&
      config1.video === config2.video &&
      config1.cacheMaxSize === config2.cacheMaxSize &&
      config1.baudRate === config2.baudRate
    );
  };
};
