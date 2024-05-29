window.onload = () => {
  let frameQueue = [];
  //app control button listeners
  let fullscreen = false;
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

  const telemetry = document.getElementById("telemetry"),
    video0 = document.getElementById("video-0"),
    video1 = document.getElementById("video-1");

  const LV0 = setupVideoCanvas("live-video-0"),
    LV1 = setupVideoCanvas("live-video-1");

  video0.appendChild(LV0.canvas);
  video1.appendChild(LV1.canvas);

  //refresh canvases at 50hz
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

  const sizeGauges = () => {
    let size = telemetry.offsetWidth * 0.75;

    alt.setAttribute("data-width", size);
    alt.setAttribute("data-height", size);
    spd.setAttribute("data-width", size);
    spd.setAttribute("data-height", size);
  };
  sizeGauges();
  window.onresize = sizeGauges;

  let maxAlt = 0,
    maxSpd = 0,
    lastStage = 0;

  const maxAltEl = document.getElementById("max-alt"),
    maxSpdEl = document.getElementById("max-spd");

  api.on("data", (data) => {
    let msg = new APRSMessage(data);

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

    if (msg.getAlt() > maxAlt) {
      maxAlt = msg.getAlt();
      maxAltEl.textContent = maxAlt + " ft";
    }

    if (msg.getSpeed() > maxSpd) {
      maxSpd = msg.getSpeed();
      maxSpdEl.textContent = maxSpd + " ft/s";
    }

    //update stage
    let prog = document.getElementById("stage");
    let sn = msg.getStageNumber();
    let percents = [5, 15, 25, 45, 80, 90]; //add 1 to percents from css because of rounded end
    if (sn >= 0) {
      prog.textContent = percents[sn] + "%";
      prog.setAttribute("value", percents[sn]);
      document.getElementById("s" + sn).className = "stage active";
      if (sn > 0)
        document.getElementById("s" + (sn - 1)).className = "stage active";
      for (let i = lastStage; i < sn; i++) {
        document.getElementById("s" + i).className = "stage active";
      }
      lastStage = sn;
    }
  });
};
