const fs = require('fs');
const pipePath = '\\\\.\\pipe\\myPipe';

const pipeStream = fs.createReadStream(pipePath);

pipeStream.on('data', (data) => {
    console.log(data);
});
