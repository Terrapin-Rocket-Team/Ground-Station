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

  const video0 = document.getElementById("video-0"),
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
};
