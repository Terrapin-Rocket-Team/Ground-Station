window.onload = () => {
  let con = document.getElementById("debug-console");
  let scrolled = false;

  api.on("print", (data) => {
    if (con.childNodes.length > 10000) con.remove(con.firstChild);
    const text = document.createElement("SPAN");
    text.textContent = data.message;
    text.className = data.level;
    con.appendChild(text);
    if (
      scrolled &&
      window.scrollY >= con.scrollHeight - window.innerHeight - 20
    )
      scrolled = false;
    if (!scrolled) window.scrollTo(0, con.scrollHeight);
  });

  api.on("previous-logs", (data) => {
    con.textContent = data;
  });

  document.addEventListener("scroll", () => {
    scrolled = true;
  });
};
