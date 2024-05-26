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

  const video0Canvas = document.getElementById("video-0"),
    video0 = YUVCanvas.attach(video0Canvas);
  let format = YUVBuffer.format({
    width: 640,
    height: 832,
    chromaWidth: 640 / 2,
    chromaHeight: 832 / 2,
  });
  frame = YUVBuffer.frame(format);

  api.on("frame-ready", (frame) => {
    frameQueue.push(frame);
  });

  setInterval(() => {
    if (frameQueue.length > 0) {
      thisFrame = frameQueue.shift();
      frame.y.bytes = thisFrame.y;
      frame.u.bytes = thisFrame.u;
      frame.v.bytes = thisFrame.v;
      video0.drawFrame(frame);
    }
  }, 20);
};
