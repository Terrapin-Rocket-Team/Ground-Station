window.onload = () => {
  //app control button listeners
  document.getElementById("reload").addEventListener("click", () => {
    api.reload();
  });
  document.getElementById("minimize").addEventListener("click", () => {
    api.minimize();
  });
  document.getElementById("close").addEventListener("click", () => {
    api.close();
  });
  document.getElementById("debug").addEventListener("click", () => {
    api.openDebug();
  });
};
