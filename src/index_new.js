window.onload = () => {
  let fullscreened = false;
  // let fullscreenCallbacks = [];
  //app control button listeners
  document.getElementById("fullscreen").addEventListener("click", () => {
    fullscreened = !fullscreened;
    api.fullscreen("main", fullscreened);
    // fullscreenCallbacks.forEach((callback) => {
    //   callback();
    // });
  });
  document.getElementById("reload").addEventListener("click", () => {
    api.reload("main");
  });
  document.getElementById("minimize").addEventListener("click", () => {
    api.minimize("main");
  });
  document.getElementById("close").addEventListener("click", () => {
    api.close("main");
  });
  // document
  //   .getElementById("radio-command-open")
  //   .addEventListener("click", () => {
  //     api.openCommand();
  //   });

  let portsInUse = [];
  //custom dropdown setup
  const setupDropdown = (idPrefix) => {
    document
      .getElementById(idPrefix + "-drop")
      .addEventListener("click", () => {
        const drop = document.getElementById(idPrefix + "-drop");
        const options = document.getElementById(idPrefix + "-options");
        if (drop.classList.contains("active")) {
          options.style.display = "none";
          document
            .getElementById(idPrefix + "-arrow")
            .setAttribute("src", "./images/arrow_right.svg");
        } else {
          options.style.display = "block";
          getAvailPorts(idPrefix);
          document
            .getElementById(idPrefix + "-arrow")
            .setAttribute("src", "./images/arrow_down.svg");
        }
        drop.classList.toggle("active");
        drop.classList.toggle("inactive");
        options.classList.toggle("active");
      });
  };

  //adds available ports to the custom dropdown
  const getAvailPorts = (idPrefix) => {
    api.getPorts().then((ports) => {
      const options = document.getElementById(idPrefix + "-options");
      while (options.childElementCount > 0) {
        options.removeChild(options.firstChild);
      }
      const selected = document.getElementById(idPrefix + "-selected");
      if (ports.length === 0) {
        const span = document.createElement("SPAN");
        span.className = "serial";
        span.textContent = "No available ports";
        span.addEventListener("click", () => {
          selected.textContent = "Select Port";
        });
        options.appendChild(span);
      } else {
        ports.forEach((port) => {
          if (!portsInUse.some((el) => el.path === port.path)) {
            const span = document.createElement("SPAN");
            span.className = "serial";
            span.textContent = port.path;
            span.addEventListener("click", () => {
              api.setPort({ idPrefix, path: port.path }).then((success) => {
                const img = document.getElementById(idPrefix + "-connection");
                if (success) {
                  portsInUse.push({ idPrefix, path: port.path });
                  selected.textContent = port.path;
                  img.setAttribute("src", "./images/serial_connected.svg");
                  img.setAttribute("title", "Serial Connected");
                } else {
                  img.setAttribute("src", "./images/serial_disconnected.svg");
                  img.setAttribute("title", "Connection Error");
                }
              });
            });
            options.appendChild(span);
          }
        });
      }
    });
  };

  setupDropdown("serial");

  const resizeGauges = () => {
    console.log("Here");
    //set gauge.js gauge sizing
    let gauges = document.getElementsByClassName("gauge");

    let size = document.getElementById("telem-1").offsetWidth * 0.7;

    let numGauges = gauges.length;
    for (let i = 0; i < numGauges; i++) {
      gauges[i].setAttribute("data-width", size);
      gauges[i].setAttribute("data-height", size);
    }
  };

  resizeGauges();
  api.on("fullscreen-change", (res) => {
    if (res.win === "main") {
      setTimeout(() => {
        resizeGauges();
      }, 10);
    }
  });
};
