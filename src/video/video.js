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
  document.getElementById("debug").addEventListener("click", () => {
    api.openDebug();
  });
  document.getElementById("fullscreen").addEventListener("click", () => {
    fullscreen = !fullscreen;
    api.fullscreen("video", fullscreen);
  });

  api.on("fullscreen-change", (change) => {
    if (change.win === "video") {
      fullscreen = change.isFullscreen;
      document.getElementById("top-bar").className = fullscreen ? "hidden" : "";
    }
  });

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

  const video0 = document.getElementById("video-0"),
    video1 = document.getElementById("video-1");

  let LV0 = setupVideoCanvas("live-video-0"),
    LV1 = setupVideoCanvas("live-video-1");

  video0.appendChild(LV0.canvas);
  video1.appendChild(LV1.canvas);

  setInterval(() => {
    api.getVideo().then((f) => {
      if (f && f.length > 0) frameQueue.push(f);
    });
    if (frameQueue.length > 0) {
      thisFrame = frameQueue.shift();
      thisFrame.forEach((video) => {
        if (video) {
          if (video.name === "video0.av1") {
            LV0.frame.y.bytes = video.data.y;
            LV0.frame.u.bytes = video.data.u;
            LV0.frame.v.bytes = video.data.v;
            LV0.ctx.drawFrame(LV0.frame);
          }
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
};
