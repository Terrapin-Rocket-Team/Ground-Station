window.onload = () => {
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
};
