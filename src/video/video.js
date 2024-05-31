window.onload = () => {
  let frameQueue = [];
  let fullscreen = false;

  //get a bunch of DOM elements here that will be used alot
  const main = document.getElementById("main"),
    telemetry = document.getElementById("telemetry"),
    videoSources = document.getElementById("video-sources");

  const video0 = document.getElementById("video-0"),
    video1 = document.getElementById("video-1");

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
    none1 = document.getElementById("none-1");

  let altG = createChart("alt-graph", "Altitude", "s", "ft", 1, 1),
    spdG = createChart("spd-graph", "Speed", "s", "ft/s", 1, 1),
    altwr = document.getElementById("alt-wrapper"),
    spdwr = document.getElementById("spd-wrapper");

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
          if (video.name === "video0.av1") {
            LV0.frame.y.bytes = video.data.y;
            LV0.frame.u.bytes = video.data.u;
            LV0.frame.v.bytes = video.data.v;
            LV0.ctx.drawFrame(LV0.frame);
          }
          //temporary name
          if (video.name === "video1.av1") {
            LV1.frame.y.bytes = video.data.y;
            LV1.frame.u.bytes = video.data.u;
            LV1.frame.v.bytes = video.data.v;
            LV1.ctx.drawFrame(LV1.frame);
          }
        }
      });
    }
  }, 20);

  // gauges
  let alt = document.getElementById("altitude");
  let spd = document.getElementById("speed");

  // set the gauges to the correct size (this needs to be done manually)
  const sizeGauges = () => {
    let size =
      telemetry.offsetWidth *
      0.75 *
      (!main.classList.contains("two-video") ? 0.5 : 1);

    alt.setAttribute("data-width", size);
    alt.setAttribute("data-height", size);
    spd.setAttribute("data-width", size);
    spd.setAttribute("data-height", size);
  };

  sizeGauges();
  //add as event handler so the gauges stay the correct size
  window.onresize = sizeGauges;

  //updates the layout switching between two-video, one-video, and telemetry-only based on the class of main
  const updateLayout = () => {
    let layout;
    if (main.classList.contains("two-video")) layout = "two-video";
    else if (main.classList.contains("one-video")) layout = "one-video";
    else if (main.classList.contains("telemetry-only"))
      layout = "telemetry-only";

    if (layout === "two-video") {
      telemetry.appendChild(document.getElementById("spd-gauge-container"));
      video0.appendChild(none0);
      video1.appendChild(none1);
      videoSources.appendChild(LV0.canvas);
      videoSources.appendChild(LV1.canvas);
      videoSources.appendChild(charts);
    }
    if (layout === "one-video") {
      telemetry.appendChild(document.getElementById("small-text-container"));
      video0.appendChild(none0);
      videoSources.appendChild(LV0, canvas);
      videoSources.appendChild(LV1.canvas);
      videoSources.appendChild(charts);
    }
    if (layout === "telemetry-only") {
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
    maxSpdEl = document.getElementById("max-spd");

  let maxAlt = 0,
    maxSpd = 0,
    lastStage = 0,
    tPlusSet = false,
    chartState = "seconds";

  // load previous data if it exists
  {
    altG.data.datasets[0].data = sessionStorage.getItem("altData")
      ? JSON.parse(sessionStorage.getItem("altData"))
      : [];
    spdG.data.datasets[0].data = sessionStorage.getItem("spdData")
      ? JSON.parse(sessionStorage.getItem("spdData"))
      : [];

    if (
      sessionStorage.getItem("max-alt") &&
      parseInt(sessionStorage.getItem("max-alt"))
    )
      maxAltEl.textContent =
        parseInt(sessionStorage.getItem("max-alt")) + " ft";

    if (
      sessionStorage.getItem("max-spd") &&
      parseInt(sessionStorage.getItem("max-spd"))
    )
      maxSpdEl.textContent =
        parseInt(sessionStorage.getItem("max-spd")) + " ft/s";
  }

  api.on("data", (data) => {
    let msg = new APRSMessage(data);

    //set T+
    //TODO: display T+?
    if (!tPlusSet && msg.getStageNumber() > 0) {
      let time = Date.now() - msg.getT0ms();

      tPlusSet = true;
      let ts = time / 1000;

      if (altG.data.datasets[0].data.length === 0)
        altG.data.datasets[0].data = [{ x: ts, y: null }];
      if (spdG.data.datasets[0].data.length === 0)
        spdG.data.datasets[0].data = [{ x: ts, y: null }];
    }
    if (tPlusSet) {
      //update charts
      let time = Date.now() - msg.getT0ms();
      let ts = time / 1000;

      if (ts > 120 && ts < 120 * 60 && chartState != "minutes") {
        let altData = altG.data.datasets[0].data;
        let spdData = spdG.data.datasets[0].data;
        let altLabels = altG.data.labels;
        let spdLabels = spdG.data.labels;

        altwr.innerHTML = '<canvas id="alt-graph" class="chart"></canvas>';
        spdwr.innerHTML = '<canvas id="spd-graph" class="chart"></canvas>';

        altG = createChart("alt-graph", "Altitude", "min", "ft", 1 / 60, 1);
        spdG = createChart("spd-graph", "Speed", "min", "ft/s", 1 / 60, 1);
        altG.data.datasets[0].data = altData;
        spdG.data.datasets[0].data = spdData;
        altG.data.labels = altLabels;
        spdG.data.labels = spdLabels;
        chartState = "minutes";
      } else if (ts > 120 * 60 && chartState != "hours") {
        let altData = altG.data.datasets[0].data;
        let spdData = spdG.data.datasets[0].data;
        let altLabels = altG.data.labels;
        let spdLabels = spdG.data.labels;

        altwr.innerHTML = '<canvas id="alt-graph" class="chart"></canvas>';
        spdwr.innerHTML = '<canvas id="spd-graph" class="chart"></canvas>';

        altG = createChart("alt-graph", "Altitude", "hrs", "ft", 1 / 3600, 1);
        spdG = createChart("spd-graph", "Speed", "hrs", "ft/s", 1 / 3600, 1);
        altG.data.datasets[0].data = altData;
        spdG.data.datasets[0].data = spdData;
        altG.data.labels = altLabels;
        spdG.data.labels = spdLabels;
        chartState = "hours";
      }

      let factor =
        chartState == "minutes" ? 30 : chartState == "hours" ? 320 : 1;

      let interval = parseInt(
        (ts - altG.data.datasets[0].data[0].x + 5 * factor) / 4
      );

      let arrL = [];
      for (let i = 0; i < 5; i++) {
        arrL[i] = Math.floor(altG.data.datasets[0].data[0].x) + i * interval;
      }

      altG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      spdG.options.scales.x.min = arrL[0] < 0 ? 0 : arrL[0];
      altG.options.scales.x.suggestedMax = ts + 10 * factor;
      spdG.options.scales.x.suggestedMax = ts + 10 * factor;

      altG.data.labels = JSON.parse(JSON.stringify(arrL));
      spdG.data.labels = JSON.parse(JSON.stringify(arrL));

      altG.data.datasets[0].data.push({
        x: ts,
        y: msg.getAlt() ? msg.getAlt() : 0,
      });
      spdG.data.datasets[0].data.push({
        x: ts,
        y: msg.getSpeed() ? msg.getSpeed() : 0,
      });

      sessionStorage.setItem(
        "altData",
        JSON.stringify(altG.data.datasets[0].data)
      );
      sessionStorage.setItem(
        "spdData",
        JSON.stringify(spdG.data.datasets[0].data)
      );

      altG.update();
      spdG.update();
    }

    //update gauges
    if (msg.getAlt() || msg.getAlt() === 0) {
      alt.setAttribute("data-value-text", msg.getAlt());
      alt.setAttribute("data-value", msg.getAlt() / 1000);
      document.getElementById("alt-text").textContent = msg.getAlt() + " ft";
    } else {
      alt.setAttribute("data-value-text", "\u2014");
    }
    if (msg.getSpeed() || msg.getSpeed() === 0) {
      spd.setAttribute("data-value-text", msg.getSpeed());
      spd.setAttribute("data-value", msg.getSpeed() / 100);
      document.getElementById("spd-text").textContent =
        msg.getSpeed() + " ft/s";
    } else {
      spd.setAttribute("data-value-text", "\u2014");
    }

    //update max altitude and speed
    if (msg.getAlt() > maxAlt) {
      maxAlt = msg.getAlt();
      maxAltEl.textContent = maxAlt + " ft";
      sessionStorage.setItem("max-alt", maxAlt);
    }

    if (msg.getSpeed() > maxSpd) {
      maxSpd = msg.getSpeed();
      maxSpdEl.textContent = maxSpd + " ft/s";
      sessionStorage.setItem("max-spd", maxSpd);
    }

    //update stage
    let prog = document.getElementById("stage");
    let ff = document.getElementById("fun-facts-container");
    let ffTitle = document.getElementById("fun-fact-title");
    let ffText = document.getElementById("fun-fact-text");
    let sn = msg.getStageNumber();
    let percents = [5, 15, 25, 45, 80, 90];
    let stageNames = [
      "On the Pad",
      "Powered Flight",
      "Coast",
      "Drogue Deploy",
      "Main Parachute",
      "Landed",
    ];
    let stageFunFacts = [
      "The rocket is on the pad with all systems ready for flight.",
      "Liftoff! The rocket's motor ignites accelerating it to nearly the speed of sound in just a few seconds.",
      "After the motor burns out, the rocket's airbrake deploys to slow the rocket down and target a maximum altitude of 10,000ft.",
      "At the highest point during the rocket's flight, it separates and a drogue parachute deploys to slow the rocket's descent.",
      "The main parachute deploys near 1,000ft to slow the rocket down to a safe velocity for landing.",
      "The rocket has landed safely, completing its flight.",
    ];
    if (sn >= 0) {
      prog.textContent = percents[sn] + "%";
      prog.setAttribute("value", percents[sn]);
      document.getElementById("s" + sn).className = "stage active";
      if (sn > 0)
        document.getElementById("s" + (sn - 1)).className = "stage active";
      for (let i = lastStage; i < sn; i++) {
        document.getElementById("s" + i).className = "stage active";
      }
      if (sn > lastStage) {
        ff.className = "hide";
        ffTitle.textContent = stageNames[sn];
        ffText.textContent = stageFunFacts[sn];
        setTimeout(() => {
          ff.className = "";
        }, 500);
        lastStage = sn;
      }
    }
  });

  //should be called when switching between different layouts
  const changeLayout = (c) => {
    main.className = c;
    updateLayout();
    sizeGauges();
  };

  api.on("video-controls", (controls) => {
    changeLayout(controls.layout);
    if (video0.firstChild) videoSources.appendChild(video0.firstChild);
    if (video1.firstChild) videoSources.appendChild(video1.firstChild);
    video0.appendChild(document.getElementById(controls.video0));
    if (controls.layout === "two-video")
      video1.appendChild(document.getElementById(controls.video1));
  });
};
