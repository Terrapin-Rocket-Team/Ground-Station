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

  // get colors from css
  const t1Color = getComputedStyle(document.body).getPropertyValue(
      "--t1-color"
    ),
    t2Color = getComputedStyle(document.body).getPropertyValue("--t2-color"),
    t3Color = getComputedStyle(document.body).getPropertyValue("--t3-color");

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
    spdG = createChart("spd-graph", "min", "ft/s", 1, 1, chartsConfig),
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
              "Unrecognized video name " + video.name + ", ignoring"
            );
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
      0.85 *
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
      // need to move speed gauge to the bottom of the telemetry div for this layout
      telemetry.appendChild(document.getElementById("spd-gauge-container"));
      video0.appendChild(none0);
      video1.appendChild(none1);
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
    maxSpdEl = document.getElementById("max-spd");

  let maxAlt = 0,
    maxSpd = 0,
    lastStage = 0,
    t0Set = false,
    chartState = "seconds";

  // load previous data if it exists
  {
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

  const updateT0 = (idPrefix, msg) => {
    // wait until the flight computer reports the stage is >0 (out of preflight)
    if (msg.getStateflag("Stage") > 0 && !t0Set) {
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

  api.on("data", (data) => {
    let msg = new APRSTelem(data);

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
        const spdValue = Math.max(msg.getSpeed() || 0, 0)
        spd.setAttribute("data-value-text", spdValue);
        spd.setAttribute("data-value", spdValue / 100);
        
        // Set the speed text and track digit length for responsive font sizing
        const spdText = document.getElementById("spd-text");
        spdText.textContent = spdValue + " ft/s";
        
        // Add a data attribute to track the number of digits for CSS responsive font sizing
        const digitLength = spdValue.toString().length;
        spdText.setAttribute("data-length", digitLength);
      } else {
        spd.setAttribute("data-value-text", "\u2014");
      }

      //update max altitude and speed
      if (msg.getAlt() > maxAlt) {
        maxAlt = Math.max(msg.getAlt() || 0, 0)
        maxAltEl.textContent = maxAlt + " ft";
        sessionStorage.setItem("max-alt", maxAlt);
      }

      if (msg.getSpeed() > maxSpd) {
        maxSpd = Math.max(msg.getSpeed() || 0, 0);
        maxSpdEl.textContent = maxSpd + " ft/s";
        sessionStorage.setItem("max-spd", maxSpd);
      }

      //update stage
      let prog = document.getElementById("stage");
      let ff = document.getElementById("fun-facts-container");
      let ffTitle = document.getElementById("fun-fact-title");
      let ffText = document.getElementById("fun-fact-text");
      // Try to get stage number using the updated getStateflag method that handles both "Stage" and "State Flags"
      let sn = msg.getStateflag("Stage");
      let percents = [5.5, 17, 31, 49, 76, 100];    // think these percents work better for 1080p, but may need to be checked
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
        "After the motor burns out, the rocket's airbrake deploys to slow the rocket down and target a maximum altitude of 30,000ft.",
        "At the highest point during the rocket's flight, it separates and a drogue parachute deploys to slow the rocket's descent.",
        "The main parachute deploys near 1,000ft to slow the rocket down to a safe velocity for landing.",
        "The rocket lands back on the ground, completing its flight.",
      ];
      // Check if we have a valid stage number and it's within our array bounds
      if (sn !== null && sn >= 0 && sn < stageNames.length) {
        // Update progress bar
        prog.textContent = percents[sn] + "%";
        prog.setAttribute("value", percents[sn]);
        
        // Mark current stage as active
        document.getElementById("s" + sn).className = "stage active";
        
        // Make sure all previous stages are also marked as active
        for (let i = 0; i <= sn; i++) {
          document.getElementById("s" + i).className = "stage active";
        }
        
        // Show fun facts if we've moved to a new stage
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
    }
    if (msg.stream === "telem-airbrake") {
      updateCharts("t2", msg);
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
  api.on("video-controls", (controls) => {
    changeLayout(controls.layout);
    if (video0.firstChild) videoSources.appendChild(video0.firstChild);
    if (video1.firstChild) videoSources.appendChild(video1.firstChild);
    video0.appendChild(document.getElementById(controls.video0));
    if (controls.layout === "two-video")
      video1.appendChild(document.getElementById(controls.video1));
  });


  console.log("Babylon.js core modules and OBJ loader imported successfully.");
  canvas = document.getElementById("3d-visualization");
  babylonEngine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  console.log("Babylon.js Engine created.");
  console.log(BABYLON.Engine.isSupported());

  const createScene = async () => {
    const scene = new BABYLON.Scene(babylonEngine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // Transparent background

    const camera = new BABYLON.ArcRotateCamera("cam",
        BABYLON.Tools.ToRadians(135), BABYLON.Tools.ToRadians(65),
        15, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0.5, 1, 0.5), scene);
    // Print the current file route/directory
    console.log("Current file route/directory:", window.location.pathname);
    // 🔁 Replace this with your actual CAD model
    const result = await BABYLON.LoadAssetContainerAsync(                    
        "../../models/rocket.obj",              // your rocket file
        scene
    );

    const rocket = result.meshes[0]; // top-level node
    rocket.scaling.setAll(2);        // optional

    // Enable quaternion-based rotation
    rocket.rotationQuaternion = new BABYLON.Quaternion();

    // Wire in telemetry-based orientation
    const d2r = BABYLON.Angle.FromDegrees;
    api.on("data", (msg) => {
        if (msg.stream !== "telem-avionics") return;
        rocket.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
            d2r(msg.getOrientationX()).radians(),
            d2r(msg.getOrientationY()).radians(),
            d2r(msg.getOrientationZ()).radians()
        );
    });

    return scene;
  };

  createScene().then(scene => {
      babylonEngine.runRenderLoop(() => scene.render());
  });
  window.addEventListener("resize", () => babylonEngine.resize());

  console.log("Babylon.js initialization complete. Render loop started.");
  
};
