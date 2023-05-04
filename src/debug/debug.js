let printD;

window.onload = () => {
  let con = document.getElementById("debug-console");
  let inputBox = document.getElementById("input-box");
  let inputBoxText = document.getElementById("input-box-text");
  const previousCommands = [];
  let upArrowCounter = 0;
  let scrolled = false;

  //add a new print to the debug window
  printD = (data) => {
    if (con.childNodes.length > 10000) con.remove(con.firstChild);
    const text = document.createElement("PRE");
    text.textContent = data.message;
    text.className = data.level;
    con.insertBefore(text, inputBox);
    if (
      scrolled &&
      window.scrollY >= con.scrollHeight - window.innerHeight - 50
    )
      scrolled = false;
    if (!scrolled) window.scrollTo(0, con.scrollHeight);
    if (con.scrollHeight > window.innerHeight) inputBox.style.bottom = "unset";
  };

  api.on("print", (data) => {
    printD(data);
  });

  //load previous logs into the window
  api.on("previous-logs", (data) => {
    let msgs = data.split("\n");
    msgs.forEach((msg) => {
      if (msg) {
        const text = document.createElement("SPAN");
        text.textContent = msg;
        text.className = msg.match(/(?<=\]\[).+(?=\])/g)[0].toLowerCase();
        con.insertBefore(text, inputBox);
      }
    });
    if (con.scrollHeight > window.innerHeight) inputBox.style.bottom = "unset";
    window.scrollTo(0, con.scrollHeight);
  });

  //event listener to help handle autoscrolling
  document.addEventListener("scroll", () => {
    scrolled = true;
  });

  inputBoxText.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      let cmd = inputBoxText.textContent;
      upArrowCounter = 0;

      previousCommands.push(cmd);
      if (previousCommands.length > 50) previousCommands.shift();

      CMDS.executeCmd(cmd.split(" "));

      inputBoxText.innerHTML = "";
    }
    if (event.key === "Backspace") upArrowCounter = 0;
  });

  inputBoxText.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (upArrowCounter !== previousCommands.length) {
        let range, selection;
        upArrowCounter++;
        inputBoxText.textContent =
          previousCommands[previousCommands.length - upArrowCounter];

        range = document.createRange(); //Create a range (a range is a like the selection but invisible)
        range.selectNodeContents(inputBoxText); //Select the entire contents of the element with the range
        range.collapse(false); //collapse the range to the end point. false means collapse to end rather than the start
        selection = window.getSelection(); //get the selection object (allows you to change selection)
        selection.removeAllRanges(); //remove any selections already made
        selection.addRange(range); //make the range you have just created the visible selection
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (upArrowCounter !== 1) {
        let range, selection;
        upArrowCounter--;
        inputBoxText.textContent =
          previousCommands[previousCommands.length - upArrowCounter];

        range = document.createRange(); //Create a range (a range is a like the selection but invisible)
        range.selectNodeContents(inputBoxText); //Select the entire contents of the element with the range
        range.collapse(false); //collapse the range to the end point. false means collapse to end rather than the start
        selection = window.getSelection(); //get the selection object (allows you to change selection)
        selection.removeAllRanges(); //remove any selections already made
        selection.addRange(range); //make the range you have just created the visible selection
      }
    }
  });
};
