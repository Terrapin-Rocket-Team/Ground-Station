const { FileStreamSource } = require("./video-source");

let st = new FileStreamSource("./serial/out5.av1", {
  resolution: { width: 640, height: 832 },
  framerate: 30,
  rotation: "cw",
  createLog: true,
});
let frame = [];
st.on("data", (chunk) => {
  frame = frame.concat(Array.from(chunk));
  if (frame.length > (640 * 832 * 3) / 2) {
    let thisFrame = frame.splice(0, (640 * 832 * 3) / 2);
    // let f = {
    //   y: Buffer.from(thisFrame.slice(0, 0 + 640 * 832)),
    //   u: Buffer.from(thisFrame.slice(640 * 832, 640 * 832 + (640 * 832) / 4)),
    //   v: Buffer.from(
    //     thisFrame.slice(
    //       640 * 832 + (640 * 832) / 4,
    //       640 * 832 + (640 * 832) / 4 + 640 * 832 + (640 * 832) / 4
    //     )
    //   ),
    // };
    // console.log(thisFrame.length);
  }
});
setTimeout(() => {
  console.log("started video");
  st.startOutput();
}, 1000 * 1);
