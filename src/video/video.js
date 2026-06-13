// import * as BABYLON from "@babylonjs/core";
// TODO: when the video window gets overhauled fix all the copy and pasted code from index.js
window.onload = () => {
  let frameQueue = [];
  let fullscreen = false;

  //get a bunch of DOM elements here that will be used alot
  const main = document.getElementById("main"),
    telemetry = document.getElementById("telemetry"),
    videoSources = document.getElementById("video-sources");

  const video0 = document.getElementById("video-0"),
    video1 = document.getElementById("video-1");

  // Camera support
  const cameraState = {
    video0: { stream: null, deviceId: null, use480p: null, el: null },
    video1: { stream: null, deviceId: null, use480p: null, el: null },
  };

  const stopCamera = (slot) => {
    const s = cameraState[slot];
    if (!s) return;

    if (s.stream) {
      const stream = s.stream;
      s.stream = null;
      stream.getTracks().forEach((t) => t.stop());
    }
    s.deviceId = null;
    s.use480p = null;

    // remove element from pool
    if (s.el && s.el.parentNode) s.el.parentNode.removeChild(s.el);
    s.el = null;
  };

  const ensureCameraElement = (slot) => {
    const s = cameraState[slot];
    if (s.el) return s.el;

    const v = document.createElement("video");
    v.autoplay = true;
    v.muted = true; // avoid autoplay restrictions
    v.playsInline = true;
    v.setAttribute("playsinline", "");

    v.style.width = "100%";
    v.style.height = "100%";
    v.style.objectFit = "cover";

    // stable ids
    v.id = slot === "video0" ? "camera-video-0" : "camera-video-1";

    s.el = v;

    // keep it in the same "pool" as other sources
    videoSources.appendChild(v);

    return v;
  };

  const setCamera = async (slot, deviceId, use480p = false) => {
    const s = cameraState[slot];

    if (s.stream && s.deviceId === deviceId && s.use480p === use480p)
      return ensureCameraElement(slot);

    stopCamera(slot);

    const v = ensureCameraElement(slot);
    let videoConstraints =
      deviceId === "default" ? {} : { deviceId: { exact: deviceId } };
    if (use480p) {
      videoConstraints = {
        ...videoConstraints,
        width: { ideal: 854 },
        height: { ideal: 480 },
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: Object.keys(videoConstraints).length ? videoConstraints : true,
      audio: false,
    });

    s.stream = stream;
    s.deviceId = deviceId;
    s.use480p = use480p;

    v.srcObject = stream;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener(
        "ended",
        () => {
          if (cameraState[slot]?.stream === stream) showCameraFallback(slot);
        },
        { once: true },
      );
    });
    v.addEventListener(
      "error",
      () => {
        if (cameraState[slot]?.stream === stream) showCameraFallback(slot);
      },
      { once: true },
    );

    try {
      await v.play();
    } catch (e) {
      console.warn("video.play() failed:", e);
    }

    return v;
  };

  const isCameraControl = (value) =>
    typeof value === "string" && value.startsWith("camera:");

  const getCameraDeviceId = (value) => value.slice("camera:".length);

  const moveSlotChildBackToPool = (slotEl) => {
    // move only the first direct child that is the video/canvas source
    // (skip the decoration divs and HUD which are always present)
    const child = Array.from(slotEl.children).find(
      (c) =>
        c.tagName === "CANVAS" ||
        c.tagName === "VIDEO" ||
        c.classList.contains("no-signal") ||
        c.id === "charts",
    );
    if (child) videoSources.appendChild(child);
  };

  function showCameraFallback(slot) {
    const slotEl = slot === "video0" ? video0 : video1;
    const fallback = slot === "video0" ? none0 : none1;
    if (!slotEl || !fallback) return;

    moveSlotChildBackToPool(slotEl);
    stopCamera(slot);
    slotEl.appendChild(fallback);
  }

  // ── Video orientation ────────────────────────────────────────────────────────
  // Maps the orient value from videoControls to a CSS transform string.
  const ORIENT_TRANSFORMS = {
    0: "",
    90: "rotate(90deg)",
    180: "rotate(180deg)",
    270: "rotate(270deg)",
    hflip: "scaleX(-1)",
    vflip: "scaleY(-1)",
  };

  /**
   * Apply an orientation transform to the active source element inside a slot.
   * Source elements use position:absolute + inset:0, so we only set the CSS
   * transform and let object-fit:contain handle letterboxing naturally.
   */
  const applyOrientation = (slotEl, value) => {
    const transform = ORIENT_TRANSFORMS[value] ?? "";
    // Only target real media elements — never .no-signal placeholders.
    // updateLayout() appends none0/none1 to the slot before the actual source
    // is mounted, so they appear first in children order and would be found
    // first if we included .no-signal in the search.
    const el = Array.from(slotEl.children).find(
      (c) =>
        c.tagName === "CANVAS" || c.tagName === "VIDEO" || c.id === "charts",
    );
    if (!el) {
      console.warn(
        "[orient] no media element found in",
        slotEl.id,
        "— children:",
        Array.from(slotEl.children).map(
          (c) => c.id || c.tagName + "." + c.className,
        ),
      );
      return;
    }
    console.log(
      "[orient]",
      slotEl.id,
      "→",
      el.id || el.tagName,
      "transform:",
      transform,
    );
    el.style.transform = transform;
    el.style.transformOrigin = "center center";
  };
  // ── /Video orientation ───────────────────────────────────────────────────────

  // get colors from css
  const t1Color = getComputedStyle(document.body).getPropertyValue(
      "--t1",
    ),
    t2Color = getComputedStyle(document.body).getPropertyValue("--t2"),
    t3Color = getComputedStyle(document.body).getPropertyValue("--t3");

  const chartsConfig = [
    { name: "Avionics", color: t1Color },
    { name: "Airbrake", color: t2Color },
    { name: "Payload", color: t3Color },
  ];

  //app control button listeners
  document.getElementById("reload").addEventListener("click", () => {
    api.reload("video");
  });
  document.getElementById("minimize").addEventListener("click", () => {
    api.minimize("video");
  });
  document.getElementById("close").addEventListener("click", () => {
    api.close("video");
  });
  document.getElementById("fullscreen").addEventListener("click", () => {
    fullscreen = !fullscreen;
    api.fullscreen("video", fullscreen);
  });

  //handle changes in fullscreen state
  api.on("fullscreen-change", (change) => {
    if (change.win === "video") {
      fullscreen = change.isFullscreen;
      document.getElementById("top-bar").className = fullscreen ? "hidden" : ""; // change whether top bar is hidden
    }
  });

  //set up a canvas for use with the yuv-canvas library
  const setupVideoCanvas = (id) => {
    const LVCanvas = document.getElementById(id),
      LV = YUVCanvas.attach(LVCanvas);
    let format = YUVBuffer.format({
      width: 640,
      height: 832,
      chromaWidth: 640 / 2,
      chromaHeight: 832 / 2,
    });
    frame = YUVBuffer.frame(format);

    return { canvas: LVCanvas, ctx: LV, frame };
  };

  //setup for video sources
  const LV0 = setupVideoCanvas("live-video-0"),
    LV1 = setupVideoCanvas("live-video-1"),
    charts = document.getElementById("charts"),
    none0 = document.getElementById("none-0"),
    none1 = document.getElementById("none-1"),
    viz3d = document.getElementById("3d-visualization");

  let altG = createChart("alt-graph", "min", "ft", 1, 1, chartsConfig),
    spdG = createChart("spd-graph", "min", "Mach", 1, 1, chartsConfig),
    flapG = createChart("flap-graph", "s", "deg", 1, 1, [
      { name: "Flap Angle", color: t2Color },
    ]),
    altwr = document.getElementById("alt-wrapper"),
    spdwr = document.getElementById("spd-wrapper");

  const MACH_1_FTPS = 1125.33;
  const toMach = (speedFtPerSec) =>
    Math.max(speedFtPerSec || 0, 0) / MACH_1_FTPS;
  const formatMach = (speedFtPerSec) => "Mach " + toMach(speedFtPerSec).toFixed(2);

  //refresh canvases at ~50hz
  setInterval(() => {
    //get a new video frame, if available (should only be available at the video framerate)
    api.getVideo().then((f) => {
      if (f && f.length > 0) frameQueue.push(f);
    });

    //handle the next frame in the queue
    if (frameQueue.length > 0) {
      thisFrame = frameQueue.shift();
      thisFrame.forEach((video) => {
        if (video) {
          //temporary name
          if (video.name === "video1") {
            LV1.frame.y.bytes = video.data.y;
            LV1.frame.u.bytes = video.data.u;
            LV1.frame.v.bytes = video.data.v;
            LV1.ctx.drawFrame(LV1.frame);
          }
          //temporary name
          else if (video.name === "video0") {
            LV0.frame.y.bytes = video.data.y;
            LV0.frame.u.bytes = video.data.u;
            LV0.frame.v.bytes = video.data.v;
            LV0.ctx.drawFrame(LV0.frame);
          } else {
            console.warn(
              "Unrecognized video name " + video.name + ", ignoring",
            );
          }
        }
      });
    }
  }, 20);

  // gauges
  let alt = document.getElementById("altitude");
  let spd = document.getElementById("speed");
  const predApogeeNotch = document.getElementById("pred-apogee-notch");
  const ALT_GAUGE_MAX_KFT = 36;
  let predApogeeRadius = 86;
  let lastPredApogeeFt = null;

  const positionPredictedApogeeNotch = (apogeeFt) => {
    if (!predApogeeNotch) return;
    const ratio = Math.min(
      Math.max(apogeeFt / 1000 / ALT_GAUGE_MAX_KFT, 0),
      1,
    );
    const angle = -135 + ratio * 270;
    const angleRad = (angle * Math.PI) / 180;
    const x = Math.sin(angleRad) * predApogeeRadius;
    const y = -Math.cos(angleRad) * predApogeeRadius;
    predApogeeNotch.style.setProperty("--pred-apogee-x", x + "px");
    predApogeeNotch.style.setProperty("--pred-apogee-y", y + "px");
    predApogeeNotch.style.setProperty(
      "--pred-apogee-angle",
      angle + "deg",
    );
  };

  // set the gauges to the correct size (this needs to be done manually)
  const sizeGauges = () => {
    let size =
      telemetry.offsetWidth *
      0.9 *
      (!main.classList.contains("two-video") ? 0.5 : 1);

    alt.setAttribute("data-width", size);
    alt.setAttribute("data-height", size);
    spd.setAttribute("data-width", size);
    spd.setAttribute("data-height", size);
    predApogeeRadius = size * 0.34;
    if (lastPredApogeeFt !== null)
      positionPredictedApogeeNotch(lastPredApogeeFt);
  };

  sizeGauges();
  //add as event handler so the gauges stay the correct size
  window.onresize = sizeGauges;

  //updates the layout switching between two-video, one-video, wide-video, and telemetry-only based on the class of main
  const updateLayout = () => {
    let layout;
    if (main.classList.contains("two-video")) layout = "two-video";
    else if (main.classList.contains("one-video")) layout = "one-video";
    else if (main.classList.contains("wide-video")) layout = "wide-video";
    else if (main.classList.contains("telemetry-only"))
      layout = "telemetry-only";

    if (layout === "two-video") {
      // need to move speed gauge to the bottom of the telemetry div for this layout
      telemetry.appendChild(document.getElementById("spd-gauge-container"));
      video0.appendChild(none0);
      videoSources.appendChild(LV0.canvas);
      videoSources.appendChild(LV1.canvas);
      videoSources.appendChild(charts);
      videoSources.appendChild(viz3d);
    }
    if (layout === "one-video") {
      // need to move max alt and speed text to bottom of telemetry div for this layout
      telemetry.appendChild(document.getElementById("small-text-container"));
      video0.appendChild(none0);
      videoSources.appendChild(LV0.canvas);
      videoSources.appendChild(LV1.canvas);
      videoSources.appendChild(charts);
      videoSources.appendChild(viz3d);
    }
    if (layout === "wide-video") {
      telemetry.appendChild(document.getElementById("small-text-container"));
      video0.appendChild(none0);
      videoSources.appendChild(LV0.canvas);
      videoSources.appendChild(LV1.canvas);
      videoSources.appendChild(charts);
      videoSources.appendChild(viz3d);
    }
    if (layout === "telemetry-only") {
      // need to move max alt and speed text to bottom of telemetry div for this layout
      telemetry.appendChild(document.getElementById("small-text-container"));
      video0.appendChild(charts);
      videoSources.appendChild(LV0.canvas);
      videoSources.appendChild(LV1.canvas);
      videoSources.appendChild(none0);
      videoSources.appendChild(none1);
    }
  };

  updateLayout();

  const maxAltEl = document.getElementById("max-alt"),
    maxSpdEl = document.getElementById("max-spd"),
    tPlusEl = document.getElementById("t-plus");

  let maxAlt = 0,
    maxSpd = 0,
    lastStage = 0,
    stageOverlayRevealTimeout = null,
    stageOverlayTimeout = null,
    stageFillStage = null,
    t0 = null,
    tPlusInterval = null,
    t0Set = false,
    chartState = "seconds";

  const stageDurations = [45000, 5000, 43000, 165000, 50000, 10000];
  const stageCount = 6;
  const stageFill = document.getElementById("stage-fill");

  const setStageFillWidth = (percent, duration = 0) => {
    if (!stageFill) return;
    stageFill.style.transitionDuration = duration + "ms";
    stageFill.style.width = percent + "%";
  };

  const animateStageFill = (stageNum) => {
    const startPercent = (stageNum / stageCount) * 100;
    const endPercent = ((stageNum + 1) / stageCount) * 100;
    const duration = stageDurations[stageNum] || 10000;

    setStageFillWidth(startPercent, 0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStageFillWidth(endPercent, duration);
      });
    });
  };

  const updateStageClasses = (stageNum) => {
    for (let i = 0; i < stageCount; i++) {
      const stageEl = document.getElementById("s" + i);
      if (!stageEl) continue;
      if (i < stageNum) stageEl.className = "stage complete";
      else if (i === stageNum) stageEl.className = "stage current";
      else stageEl.className = "stage";
    }
  };

  // load previous data if it exists
  {
    let chartDataIds = ["t1", "t2", "t3"];
    // get chart data for each stream
    chartDataIds.forEach((idPrefix) => {
      let index = parseInt(idPrefix.split("t")[1]) - 1;

      altG.data.datasets[index].data = sessionStorage.getItem(
        idPrefix + "-altData",
      )
        ? JSON.parse(sessionStorage.getItem(idPrefix + "-altData"))
        : [];
      spdG.data.datasets[index].data = sessionStorage.getItem(
        idPrefix + "-machData",
      )
        ? JSON.parse(sessionStorage.getItem(idPrefix + "-machData"))
        : [];
    });

    altG.update();
    spdG.update();

    if (
      sessionStorage.getItem("max-alt") &&
      parseInt(sessionStorage.getItem("max-alt"))
    ) {
      maxAlt = parseInt(sessionStorage.getItem("max-alt"));
      maxAltEl.textContent =
        maxAlt + " ft";
    }

    if (
      sessionStorage.getItem("max-spd") &&
      parseInt(sessionStorage.getItem("max-spd"))
    ) {
      maxSpd = parseInt(sessionStorage.getItem("max-spd"));
      maxSpdEl.textContent = formatMach(maxSpd);
    }

    if (sessionStorage.getItem("t0")) {
      t0 = parseInt(sessionStorage.getItem("t0"));
      t0Set = true;
      startTPlusCounter();
    }
  }

  function startTPlusCounter() {
    if (!tPlusEl || !t0) return;
    const update = () => {
      tPlusEl.textContent = Math.floor((Date.now() - t0) / 1000) + "s";
    };
    update();
    if (tPlusInterval) clearInterval(tPlusInterval);
    tPlusInterval = setInterval(update, 250);
  }

  const updateT0 = (idPrefix, msg) => {
    // wait until the flight computer reports the stage is >0 (out of preflight)
    if (msg.getStateflag("Stage") > 0 && !t0Set) {
      // get the t0
      t0 = Date.now();
      // save the t0 for later
      sessionStorage.setItem("t0", t0);
      t0Set = true;
      startTPlusCounter();
      // need to add empty element so the chart scale doesn't look weird
      // hardcoded for 3 streams for now
      for (let i = 0; i < 3; i++) {
        if (altG.data.datasets[i].data.length === 0)
          altG.data.datasets[i].data = [{ x: 0, y: null }];
        if (spdG.data.datasets[i].data.length === 0)
          spdG.data.datasets[i].data = [{ x: 0, y: null }];
      }
    }
  };

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
        spdG = createChart("spd-graph", "min", "Mach", 1 / 60, 1, chartsConfig);
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
          "Mach",
          1 / 3600,
          1,
          chartsConfig,
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
        (ts - altG.data.datasets[index].data[0].x + 5 * factor) / 4,
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
        y: toMach(msg.getSpeed()),
      });

      // store new data to be retreived later
      sessionStorage.setItem(
        idPrefix + "-altData",
        JSON.stringify(altG.data.datasets[index].data),
      );
      sessionStorage.setItem(
        idPrefix + "-machData",
        JSON.stringify(spdG.data.datasets[index].data),
      );

      // force update of the charts
      altG.update();
      spdG.update();
    }
  };

  const updateFlapChart = (flapAngle) => {
    if (!t0Set || !Number.isFinite(flapAngle)) return;
    let ts = (Date.now() - t0) / 1000;
    flapG.data.datasets[0].data.push({ x: ts, y: flapAngle });
    flapG.options.scales.x.min = Math.max(0, ts - 60);
    flapG.options.scales.x.suggestedMax = ts + 5;
    flapG.data.labels = [0, 15, 30, 45, 60].map((offset) =>
      Math.max(0, ts - 60 + offset),
    );
    sessionStorage.setItem(
      "flap-angle-data",
      JSON.stringify(flapG.data.datasets[0].data),
    );
    flapG.update();
  };

  const updatePredictedApogeeNotch = (predApogeeFt) => {
    if (!predApogeeNotch) return;
    if (
      predApogeeFt === undefined ||
      predApogeeFt === null ||
      predApogeeFt === ""
    ) {
      lastPredApogeeFt = null;
      predApogeeNotch.classList.remove("visible");
      return;
    }
    const apogeeFt = Number(predApogeeFt);
    if (!Number.isFinite(apogeeFt)) {
      lastPredApogeeFt = null;
      predApogeeNotch.classList.remove("visible");
      return;
    }

    lastPredApogeeFt = apogeeFt;
    positionPredictedApogeeNotch(apogeeFt);
    predApogeeNotch.title =
      "Predicted apogee: " + Math.round(apogeeFt) + " ft";
    predApogeeNotch.classList.add("visible");
  };

  api.on("data", (data) => {
    let msg = new APRSTelem(data);

    if (msg.cameraAngle) {
      document.getElementById("camera-angle-value").textContent =
        msg.cameraAngle;
    }

    if (msg.stream === "telem-avionics") {
      //set T+
      //TODO: display T+?
      updateT0("t1", msg);
      updateCharts("t1", msg);

      //update gauges
      if (msg.getAlt() || msg.getAlt() === 0) {
        const altValue = Math.max(msg.getAlt() || 0, 0);
        alt.setAttribute("data-value-text", altValue);
        alt.setAttribute("data-value", altValue / 1000);

        // Set the altitude text and track digit length for responsive font sizing
        const altText = document.getElementById("alt-text");
        altText.textContent = altValue + " ft";

        // Add a data attribute to track the number of digits for CSS responsive font sizing
        const digitLength = altValue.toString().length;
        altText.setAttribute("data-length", digitLength);
      } else {
        alt.setAttribute("data-value-text", "\u2014");
      }

      if (msg.getSpeed() || msg.getSpeed() === 0) {
        const spdValue = Math.max(msg.getSpeed() || 0, 0);
        const machValue = toMach(spdValue);
        const machText = formatMach(spdValue);
        spd.setAttribute("data-value-text", machText);
        spd.setAttribute("data-value", machValue);

        // Set the speed text and track digit length for responsive font sizing
        const spdText = document.getElementById("spd-text");
        spdText.textContent = machText;

        // Add a data attribute to track the number of digits for CSS responsive font sizing
        const digitLength = machText.length;
        spdText.setAttribute("data-length", digitLength);
      } else {
        spd.setAttribute("data-value-text", "\u2014");
      }

      //update max altitude and speed
      if (msg.getAlt() > maxAlt) {
        maxAlt = Math.max(msg.getAlt() || 0, 0);
        maxAltEl.textContent = maxAlt + " ft";
        sessionStorage.setItem("max-alt", maxAlt);
      }

      if (msg.getSpeed() > maxSpd) {
        maxSpd = Math.max(msg.getSpeed() || 0, 0);
        maxSpdEl.textContent = formatMach(maxSpd);
        sessionStorage.setItem("max-spd", maxSpd);
      }

      //update stage
      let prog = document.getElementById("stage");
      let ff = document.getElementById("fun-facts-container");
      let ffTitle = document.getElementById("fun-fact-title");
      let ffText = document.getElementById("fun-fact-text");
      // Try to get stage number using the updated getStateflag method that handles both "Stage" and "State Flags"
      let sn = msg.getStateflag("Stage");
      let stageNames = [
        "On the Pad",
        "Powered Flight",
        "Coast",
        "Drogue Descent",
        "Main Parachute",
        "Landed",
      ];
      let stageFunFacts = [
        "The rocket is on the pad with all systems ready for flight.",
        "Liftoff! The rocket's motor ignites accelerating it to nearly the speed of sound in just a few seconds.",
        "After the motor burns out, the rocket's airbrake deploys to slow the rocket down and target a maximum altitude of 30,000ft.",
        "At the highest point during the rocket's flight, it separates and a drogue parachute deploys to slow the rocket's descent.",
        "The main parachute deploys near 1,000ft to slow the rocket down to a safe velocity for landing.",
        "The rocket lands back on the ground, completing its flight.",
      ];
      // Check if we have a valid stage number and it's within our array bounds
      if (sn !== null && sn >= 0 && sn < stageNames.length) {
        // Update progress bar
        const stagePercent = ((sn + 1) / stageNames.length) * 100;
        prog.textContent = stagePercent + "%";
        prog.setAttribute("value", stagePercent);

        updateStageClasses(sn);
        if (sn !== stageFillStage) {
          animateStageFill(sn);
          stageFillStage = sn;
        }

        // Show fun facts if we've moved to a new stage
        if (sn > lastStage) {
          ff.className = "hide";
          ffTitle.textContent = stageNames[sn];
          ffText.textContent = stageFunFacts[sn];
          if (stageOverlayRevealTimeout)
            clearTimeout(stageOverlayRevealTimeout);
          if (stageOverlayTimeout) clearTimeout(stageOverlayTimeout);
          stageOverlayRevealTimeout = setTimeout(() => {
            ff.className = "";
            stageOverlayRevealTimeout = null;
            stageOverlayTimeout = setTimeout(() => {
              ff.className = "hide";
              stageOverlayTimeout = null;
            }, 10000);
          }, 500);
          lastStage = sn;
        }
      }

      let pitch = document.getElementById("v-pitch");
      let roll = document.getElementById("v-roll");
      let yaw = document.getElementById("v-yaw");

      pitch.textContent = msg.orientation[0];
      roll.textContent = msg.orientation[1];
      yaw.textContent = msg.orientation[2];
    }
    if (msg.stream === "telem-airbrake") {
      updateCharts("t2", msg);

      let predApogee =
        msg.predictedApogee !== undefined
          ? msg.predictedApogee
          : msg.getStateflag("Predicted Apogee");
      updatePredictedApogeeNotch(predApogee);
      let flapAngle =
        msg.flapAngle !== undefined ? msg.flapAngle : msg.getStateflag("Flap Angle");
      const flapAngleValue = Number(flapAngle);
      if (Number.isFinite(flapAngleValue)) {
        document.getElementById("v-flap").textContent =
          flapAngleValue.toFixed(1);
        updateFlapChart(flapAngleValue);
      }
    }
    if (msg.stream === "telem-payload") {
      updateCharts("t3", msg);
    }
  });

  //should be called when switching between different layouts
  const changeLayout = (c) => {
    main.className = c;
    updateLayout();
    sizeGauges();
  };

  //reconfigure layout when we get a new set of video controls
  api.on("video-controls", async (controls) => {
    changeLayout(controls.layout);

    // Move whatever was mounted back into the pool before swapping
    moveSlotChildBackToPool(video0);
    moveSlotChildBackToPool(video1);

    // VIDEO 0
    if (isCameraControl(controls.video0)) {
      const deviceId = getCameraDeviceId(controls.video0);
      try {
        const camEl = await setCamera(
          "video0",
          deviceId,
          !!controls.webcam480p,
        );
        video0.appendChild(camEl);
      } catch (e) {
        console.error("Failed to start camera for video0:", e);
        stopCamera("video0");
        video0.appendChild(none0);
      }
    } else {
      // turning camera off if we leave camera mode
      stopCamera("video0");

      const el0 = document.getElementById(controls.video0);
      video0.appendChild(el0 ? el0 : none0);
    }

    stopCamera("video1");

    // ── Apply orientation transforms ─────────────────────────────────────────
    // Must run after the source elements have been appended above so the child
    // element exists when applyOrientation searches for it.
    if (controls.orient0) applyOrientation(video0, controls.orient0);
    // ── /orientation ─────────────────────────────────────────────────────────
  });

  console.log("Babylon.js core modules and OBJ loader imported successfully.");
  canvas = document.getElementById("3d-visualization");
  babylonEngine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  console.log("Babylon.js Engine created.");
  console.log(BABYLON.Engine.isSupported());

  const createScene = async () => {
    const scene = new BABYLON.Scene(babylonEngine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // Transparent background

    const camera = new BABYLON.ArcRotateCamera(
      "cam",
      BABYLON.Tools.ToRadians(0), // α = 0° → side-on
      BABYLON.Tools.ToRadians(100), // β = 90° → horizontal
      1000,
      new BABYLON.Vector3(0, 255, 0),
      scene,
    );
    // camera.attachControl(canvas, true);

    new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0.5, 1, 0.5),
      scene,
    );

    BABYLON.SceneLoader.ImportMesh(
      null, // import all meshes
      "../models/",
      "rocket.obj",
      scene,
      function (meshes) {
        console.log("Imported OBJ:", meshes);

        // Grab your rocket (e.g. the first mesh)
        const rocket = meshes[0];

        // Now it's safe to set properties on it:
        rocket.position = new BABYLON.Vector3(0, -40, 0);
        rocket.scaling.setAll(2);

        const MAX_DEG_PER_SEC = 10; //  ⟵ tweak
        const maxRadPerMs = (MAX_DEG_PER_SEC * Math.PI) / 180 / 1000;

        rocket.rotationQuaternion = new BABYLON.Quaternion(); // start clean
        let targetQuat = rocket.rotationQuaternion.clone(); // current goal

        // update target (NOTE: api.on("data") gives raw data; parse it like above)
        api.on("data", (data) => {
          const msg = new APRSTelem(data);
          if (msg.stream !== "telem-avionics") return;

          // If msg.orientation is present and is [roll,pitch,yaw] in degrees:
          if (!msg.orientation || msg.orientation.length < 3) return;

          targetQuat = BABYLON.Quaternion.FromEulerAngles(
            BABYLON.Angle.FromDegrees(msg.orientation[0]).radians(),
            BABYLON.Angle.FromDegrees(msg.orientation[1]).radians(),
            BABYLON.Angle.FromDegrees(msg.orientation[2]).radians(),
          );
        });

        // blend
        scene.onBeforeRenderObservable.add(() => {
          const dt = babylonEngine.getDeltaTime(); // ms since last frame
          const step = maxRadPerMs * dt; // max radians this frame

          const current = rocket.rotationQuaternion;
          const dot = BABYLON.Quaternion.Dot(current, targetQuat);

          // theta = 2·acos(|dot|)  → full angle between quaternions
          const angle = 2 * Math.acos(Math.min(1, Math.abs(dot)));

          if (angle < 1e-6) return; // already there

          const t = Math.min(1, step / angle); // blend fraction
          BABYLON.Quaternion.SlerpToRef(current, targetQuat, t, current);
        });
      },
    );
    return scene;
  };

  createScene().then((scene) => {
    babylonEngine.runRenderLoop(() => scene.render());
  });
  window.addEventListener("resize", () => babylonEngine.resize());

  console.log("Babylon.js initialization complete. Render loop started.");
};
