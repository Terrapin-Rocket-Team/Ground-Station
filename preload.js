const { ipcRenderer, contextBridge } = require("electron");

const APP = {
  close: () => ipcRenderer.send("close"),
  minimize: () => ipcRenderer.send("minimize"),
  reload: () => ipcRenderer.send("reload"),
  loadPage: (id) => ipcRenderer.send("page", id),
  devTools: () => ipcRenderer.send("dev-tools"),
};

let con = document.getElementById("debug-console");
let scrolled = false;

ipcRenderer.on("print", (event, message) => {
  if (!con) {
    con = document.getElementById("debug-console");
  }
  if (con) {
    document.addEventListener("scroll", () => {
      scrolled = true;
    });
    con.textContent += message;
    if (
      scrolled &&
      window.scrollY >= con.scrollHeight - window.innerHeight - 20
    )
      scrolled = false;
    if (!scrolled) window.scrollTo(0, con.scrollHeight);
  }
});

contextBridge.exposeInMainWorld("app", APP);
