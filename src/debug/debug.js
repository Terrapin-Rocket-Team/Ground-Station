//global variables to be used with CmdList.js
let printD;
let config;

window.onload = () => {
  //the main console output
  let con = document.getElementById("debug-console");
  // the main console input
  let inputBox = document.getElementById("input-box");
  let inputBoxText = document.getElementById("input-box-text");
  //previous commands list
  const previousCommands = [];
  //position in previous commands list
  let upArrowCounter = 0;
  //whether the main console output is currently scrolled
  let scrolled = false;

  //add a new print to the debug window
  printD = (data) => {
    // limit the number of messages to 10000
    if (con.childNodes.length > 10000) con.remove(con.firstChild);

    //create a new message element
    const text = document.createElement("PRE");
    text.textContent = data.message;
    text.className = data.level;
    con.insertBefore(text, inputBox);

    // resume autoscrolling if the user scrolls to the bottom of the page
    if (
      scrolled &&
      window.scrollY >= con.scrollHeight - window.innerHeight - 50
    )
      scrolled = false;
    //autoscroll
    if (!scrolled) window.scrollTo(0, con.scrollHeight);
    // fix css for when the main console window starts scrolling
    if (con.scrollHeight > window.innerHeight) inputBox.style.bottom = "unset";
  };

  //listens to the print event from the preload api, allows printing directly from main
  api.on("print", (data) => {
    printD(data);
  });

  //load previous logs into the window
  api.on("previous-logs", (data) => {
    let msgs = data.split("\n");
    msgs.forEach((msg) => {
      // weed out empty strings and create a new print for each log message
      if (msg) {
        const text = document.createElement("SPAN"); //should possibly switch to pre like above
        text.textContent = msg;
        // get the message level
        text.className = msg.match(/(?<=\]\[).+(?=\])/g)[0].toLowerCase();
        con.insertBefore(text, inputBox);
      }
    });
    // css fix for when the main console window scrolls
    if (con.scrollHeight > window.innerHeight) inputBox.style.bottom = "unset";
    // if the commands cause scrolling, scroll to the bottom
    window.scrollTo(0, con.scrollHeight);
  });

  //event listener to help handle autoscrolling
  document.addEventListener("scroll", () => {
    scrolled = true;
  });

  // resets the previous command position if the command is edited
  inputBoxText.addEventListener("keyup", (event) => {
    if (event.key === "Backspace") upArrowCounter = 0;
  });

  inputBoxText.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      //prevent newline
      event.preventDefault();

      //execute the command
      let cmd = inputBoxText.textContent;
      upArrowCounter = 0;

      previousCommands.push(cmd);
      //only store the last 50 commands
      if (previousCommands.length > 50) previousCommands.shift();

      CMDS.executeCmd(cmd.trim().split(" "));

      inputBoxText.innerHTML = "";
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      // show previous commands if available
      if (upArrowCounter !== previousCommands.length) {
        let range, selection;
        upArrowCounter++;
        inputBoxText.textContent =
          previousCommands[previousCommands.length - upArrowCounter];

        // move the cursor to the end
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
      // show newer commands if available
      if (upArrowCounter !== 1) {
        let range, selection;
        upArrowCounter--;
        inputBoxText.textContent =
          previousCommands[previousCommands.length - upArrowCounter];

        // move the cursor to the end
        range = document.createRange();
        range.selectNodeContents(inputBoxText);
        range.collapse(false);
        selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  });

  // get the current settings from main
  api.getSettings().then((c) => {
    config = c;
  });
};
