window.onload = () => {
  document.getElementById("reload").addEventListener("click", () => {
    app.reload();
  });
  document.getElementById("minimize").addEventListener("click", () => {
    app.minimize();
  });
  document.getElementById("close").addEventListener("click", () => {
    app.close();
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

  let counter = 0;

  setInterval(() => {
    let ra = Math.random() * 10000;
    let rs = Math.random() * 300;
    alt.data.datasets[0].data.push({ y: ra, x: counter++ });
    spd.data.datasets[0].data.push({ y: rs, x: counter });
    if (counter > 10) {
      alt.data.labels.push(counter);
      spd.data.labels.push(counter);
    }
    alt.update();
    spd.update();
  }, 1000);

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
};
