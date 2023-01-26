window.onload = () => {
  let con = document.getElementById("debug-console");
  let scrolled = false;

  //add a new print to the debug window
  api.on("print", (data) => {
    if (con.childNodes.length > 10000) con.remove(con.firstChild);
    const text = document.createElement("SPAN");
    text.textContent = data.message;
    text.className = data.level;
    con.appendChild(text);
    if (
      scrolled &&
      window.scrollY >= con.scrollHeight - window.innerHeight - 50
    )
      scrolled = false;
    if (!scrolled) window.scrollTo(0, con.scrollHeight);
  });

  //load previous logs into the window
  api.on("previous-logs", (data) => {
    let msgs = data.split("\n");
    msgs.forEach((msg) => {
      if (msg) {
        const text = document.createElement("SPAN");
        text.textContent = msg;
        text.className = msg.match(/(?<=\]\[).+(?=\])/g)[0].toLowerCase();
        con.appendChild(text);
      }
    });
  });

  //event listener to help handle autoscrolling
  document.addEventListener("scroll", () => {
    scrolled = true;
  });
};
