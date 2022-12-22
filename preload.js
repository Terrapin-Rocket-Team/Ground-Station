const { ipcRenderer, contextBridge } = require("electron");

const APP = {
  //app control
  close: () => ipcRenderer.send("close"),
  minimize: () => ipcRenderer.send("minimize"),
  reload: () => ipcRenderer.send("reload"),
  devTools: () => ipcRenderer.send("dev-tools"),
  openDebug: () => ipcRenderer.send("open-debug"),
  //getters
  getPorts: () => ipcRenderer.invoke("get-ports"),
  //setters
  setPort: (port) => ipcRenderer.invoke("set-port", port),
};

let con = document.getElementById("debug-console");
let scrolled = false;

ipcRenderer.on("print", (event, message, level) => {
  if (!con) {
    con = document.getElementById("debug-console");
  }
  if (con) {
    document.addEventListener("scroll", () => {
      scrolled = true;
    });
    if (con.childNodes.length > 10000) con.remove(con.firstChild);
    const text = document.createElement("SPAN");
    text.textContent = message;
    text.className = level;
    con.appendChild(text);
    if (
      scrolled &&
      window.scrollY >= con.scrollHeight - window.innerHeight - 20
    )
      scrolled = false;
    if (!scrolled) window.scrollTo(0, con.scrollHeight);
  }
});

contextBridge.exposeInMainWorld("app", APP);
