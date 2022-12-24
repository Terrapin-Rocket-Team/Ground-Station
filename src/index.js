window.onload = () => {
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

  document.getElementById("switcher-left").addEventListener("click", () => {
    const highlight = document.getElementById("switcher-highlight");
    highlight.style["border-radius"] = "0 3px 3px 0";
    highlight.style.left = 0;

    document.getElementById("chart-wrapper").classList.toggle("active");
    document.getElementById("map-wrapper").classList.toggle("active");
  });

  document.getElementById("switcher-right").addEventListener("click", () => {
    const highlight = document.getElementById("switcher-highlight");
    highlight.style["border-radius"] = "3px 0 0 3px";
    highlight.style.left = "50.2%";

    refreshMap();

    document.getElementById("chart-wrapper").classList.toggle("active");
    document.getElementById("map-wrapper").classList.toggle("active");
  });

  buildMap("map");

  let alt = createChart("alt-graph", "Altitude", "s", "ft", 1, 1);
  let spd = createChart("spd-graph", "Speed", "s", "ft/s", 1, 1);

  document.getElementById("serial-drop").addEventListener("click", () => {
    const drop = document.getElementById("serial-drop");
    const options = document.getElementById("serial-options");
    if (drop.classList.contains("active")) {
      options.style.display = "none";
      document
        .getElementById("serial-arrow")
        .setAttribute("src", "./images/arrow_right.svg");
    } else {
      options.style.display = "block";
      document
        .getElementById("serial-arrow")
        .setAttribute("src", "./images/arrow_down.svg");
    }
    drop.classList.toggle("active");
    drop.classList.toggle("inactive");
    options.classList.toggle("active");
  });

  api.getPorts().then((ports) => {
    const options = document.getElementById("serial-options");
    if (ports.length === 0) {
      const span = document.createElement("SPAN");
      span.className = "serial";
      span.textContent = "No available ports";
      options.appendChild(span);
    } else {
      const selected = document.getElementById("serial-selected");
      ports.forEach((port) => {
        const span = document.createElement("SPAN");
        span.className = "serial";
        span.textContent = port.path;
        span.addEventListener("click", () => {
          selected.textContent = port.path;
          api.setPort(port.path).then((success) => {
            const img = document.getElementById("serial-connection");
            if (success) {
              img.setAttribute("src", "./images/serial_connected.svg");
              img.setAttribute("title", "Serial Connected");
            } else {
              img.setAttribute("src", "./images/serial_disconnected.svg");
              img.setAttribute("title", "Connection Error");
            }
          });
        });
        options.appendChild(span);
      });
    }
  });

  let counter = 0;
  let lastCoords = [];

  api.on("data", (data) => {
    let msg = new APRSMessage(data);

    //update charts
    if (msg.getSpeed() || msg.getSpeed() === 0) {
      spd.data.datasets[0].data.push({ y: msg.getSpeed(), x: counter });
      if (counter > 10) spd.data.labels.push(counter);
      spd.update();
    }
    if (msg.getAlt() || msg.getAlt() === 0) {
      alt.data.datasets[0].data.push({ y: msg.getAlt(), x: counter });
      if (counter > 10) alt.data.labels.push(counter);
      alt.update();
    }
    counter++;

    //update map
    let coords = msg.getLatLong();
    if (coords[0] !== lastCoords[0] || coords[1] !== lastCoords[1]) {
      updateMarker(
        coords[0],
        coords[1],
        `<span style="font-size:1.5vh;font-weight:520;">Approximate Location: </span><br><span style="font-size:1.3vh;">${msg.getLatLongFormat()}</span>`
      );
      lastCoords = coords;
    }

    //update main displays
    document.getElementById("altitude").textContent = msg.getAlt()
      ? `${msg.getAlt()} ft`
      : "\u2014";
    document.getElementById("speed").textContent =
      msg.getSpeed() || msg.getSpeed() === 0
        ? `${msg.getSpeed()} ft/s`
        : "\u2014";
    let fcoords = msg.getLatLongFormat();
    document.getElementById("lat").textContent = fcoords
      ? fcoords.split("/")[0]
      : "\u2014";
    document.getElementById("long").textContent = fcoords
      ? fcoords.split("/")[1]
      : "\u2014";
    document.getElementById("heading").textContent = msg.getHeading()
      ? `${msg.getHeading()}\u00b0`
      : "\u2014";
  });
};
