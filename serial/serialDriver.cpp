//
// Created by Joseph Hauerstein
// Original by ramykaddouri
//

#ifdef WINDOWS
#include <WinSerialPort.h>
#include <WinNamedPipe.h>
#include <windows.h>
#elif LINUX
#include <LinuxNamedPipe.h>
#include <LinuxSerialPort.h>
#include <unistd.h>
#endif

#include <cstring>
#include <iostream>
#include <ostream>
#include <cstdint>
#include <cstdlib>

#include "RadioMessage.h"
#include "rs.h"

void createPipe(NamedPipe **arr, int &index, const char *name);

int main(int argc, char **argv)
{
    // multiplexing data
    unsigned char data[MAX_DATA_LENGTH + 1];
    // amount of data handled out of x
    int dataHandled = 0;
    // amount of data available
    size_t x;
    // the pipe to control the driver
    NamedPipe *pipeControl;
    // the pipe to provide driver status
    NamedPipe *pipeStatus;
    // the pipes to input and output data for the driver
    NamedPipe **pipes = nullptr;
    // the multiplexing ids/indexes for each pipe
    uint8_t *pipeDemuxIds = nullptr;
    // the number of input pipes
    int numInputPipes = 0;
    // the number of output pipes
    int numOutputPipes = 0;
    // the total number of pipes (input and output)
    int numTotalPipes = 0;

    // whether the pipe interface is ready
    bool ready = false;
    // whether the handshake with the device was successful
    bool handshakeSuccess = false;
    // whether there is a handshake being attempted (with a specific sequence)
    bool handshakeAttempt = false;
    // timeout to allow multiple attempts for 1 handshake sequence
    clock_t handshakeStart = clock();
    // whether a handshake is in progress (up to 5 attempts)
    bool handshakePending = false;
    // whether connection status was requested during the handshake process
    bool checkConnectionAfterHandshake = false;
    // the current handshake sequence
    char handshakeSequence[6 + 1] = {0};
    // the maximum number of handshake attempts
    const uint8_t handshakeMaxAttempts = 5;
    // the current number of handshake attempts
    uint8_t handshakeNumAttempts = 0;
    // handshake response string
    char handshakeResp[6 + 1] = {0};
    // handshake response string length
    uint8_t handshakeRespLen = 0;
    // seed the random number generator
    srand(time(0));

    // Reed solomon
    // Reed solomon decoding object
    RS rs;
    // dummary array to pass for erasures since we don't know where they are
    int erasureDummyArr[16] = {};
    // TEMP: setting to enable/disable reed solomon on video streams
    bool enableRS = false;

    // create the status and control pipes
#ifdef WINDOWS
    pipeControl = new WinNamedPipe("\\\\.\\pipe\\control", true);
    pipeStatus = new WinNamedPipe("\\\\.\\pipe\\status", true);
#elif LINUX
    // need to be updated when switching to abstract sockets
    pipeControl = new LinuxNamedPipe("./build/serial/pipes/control", true);
    pipeStatus = new LinuxNamedPipe("./build/serial/pipes/status", true);
#endif

    // holds the header data
    uint8_t header[5] = {0};
    // holds the current size of the received header
    uint8_t headerSize = 0;
    // whether the header has been found
    bool headerFound = false;

    // the type of the message from the header
    uint8_t msgType = 0;
    // the index/id of the message from the header
    uint8_t msgIndex = 0;
    // the size of the message from the header
    uint16_t msgSize = 0;

    // the max size of a single chunk (string data only)
    const size_t maxChunkSize = 1024;
    // holds string data that is being output from the driver
    char outStr[maxChunkSize] = {0};
    // holds string data that is being input into the driver
    char inStr[maxChunkSize] = {0};

    // a message to hold only the data for a single multiplexed input message
    Message mOut;
    // a message to hold data from driver input pipes
    Message mIn;
    // a GSData object to decode multplexed data
    GSData rawData;

    // an object to handle the serial device connection
    SerialPort *device = nullptr;

    // required so that the program interfacing with the driver knows when the control and status pipes are ready
    std::cout << "driver ready" << std::endl;

    // identify the driver
    std::cout << "main driver v2.0.0" << std::endl;

    // controls the exiting the main loop
    bool exit = false;
    // a string to hold commands received over the control pipe
    char controlStr[50];

    while (!exit)
    {
        // wipe the command string
        memset(controlStr, 0, sizeof(controlStr));

        // attempt to read a command string
        if (pipeControl->readStr(controlStr, sizeof(controlStr)) > 0)
        {
            std::cout << "ctl: " << controlStr << std::endl;
            // check for close command
            if (strcmp(controlStr, "close") == 0)
            {
                // reset ready status and handshake
                ready = false;
                handshakeSuccess = false;
                handshakeNumAttempts = 0;
                // close the serial connection
                if (device != nullptr)
                {
                    delete device;
                    device = nullptr;
                }
            }
            // check for reset command
            if (strcmp(controlStr, "reset") == 0)
            {
                // reset ready status and handshake
                ready = false;
                handshakeSuccess = false;
                handshakeNumAttempts = 0;

                // close the existing serial connection
                if (device != nullptr)
                {
                    delete device;
                    device = nullptr;
                }

                // get the port path to connect to
                bool receivedPort = false;
                char portBuf[50];

                while (!receivedPort)
                {
                    memset(portBuf, 0, sizeof(portBuf));
                    if (pipeControl->readStr(portBuf, sizeof(portBuf)) > 0)
                    {
                        portBuf[sizeof(portBuf) - 1] = '\0';
                        std::cout << "Received port: " << portBuf << std::endl;
                        receivedPort = true;
                    }
                }

                // get the baud rate to connect with
                bool receivedBaudRate = false;
                char baudRate[50];

                while (!receivedBaudRate)
                {
                    memset(baudRate, 0, sizeof(baudRate));
                    if (pipeControl->readStr(baudRate, sizeof(baudRate)) > 0)
                    {
                        baudRate[sizeof(baudRate) - 1] = '\0';
                        std::cout << "Received baud rate: " << baudRate << std::endl;
                        receivedBaudRate = true;
                    }
                }

                // create a new serial connection
#ifdef WINDOWS
                device = new WinSerialPort(portBuf, atoi(baudRate));
#elif LINUX
                device = new LinuxSerialPort(portBuf, atoi(baudRate));
#endif
                // reset state control vars
                headerFound = false;
                mOut.clear();
            }
            // check for data pipes command
            if (strcmp(controlStr, "data pipes") == 0)
            {
                // get number of input pipes
                bool gotNumInputPipes = false;
                char numInputPipesStr[3] = {0};
                while (!gotNumInputPipes)
                {
                    memset(numInputPipesStr, 0, sizeof(numInputPipesStr));
                    if (pipeControl->readStr(numInputPipesStr, sizeof(numInputPipesStr)) > 0)
                    {
                        numInputPipesStr[sizeof(numInputPipesStr) - 1] = '\0';
                        std::cout << "Received num pipes: " << numInputPipesStr << std::endl;
                        gotNumInputPipes = true;
                    }
                }

                // get number of output pipes
                bool gotNumOutputPipes = false;
                char numOutputPipesStr[3] = {0};
                while (!gotNumOutputPipes)
                {
                    memset(numOutputPipesStr, 0, sizeof(numOutputPipesStr));
                    if (pipeControl->readStr(numOutputPipesStr, sizeof(numOutputPipesStr)) > 0)
                    {
                        numOutputPipesStr[sizeof(numOutputPipesStr) - 1] = '\0';
                        std::cout << "Received num pipes: " << numOutputPipesStr << std::endl;
                        gotNumOutputPipes = true;
                    }
                }

                // delete existing input and output pipes
                if (pipes != nullptr)
                {
                    for (int i = 0; i < numTotalPipes; i++)
                    {
                        delete pipes[i];
                    }
                    delete[] pipes;
                    pipes = nullptr;
                }

                // clear existing multiplexing ids
                if (pipeDemuxIds != nullptr)
                {
                    delete[] pipeDemuxIds;
                    pipeDemuxIds = nullptr;
                }

                // convert numbers of input and output pipes from string
                numInputPipes = atoi(numInputPipesStr);
                numOutputPipes = atoi(numOutputPipesStr);
                numTotalPipes = numInputPipes + numOutputPipes;

                // make sure more than 0 pipes should be requested
                if (numTotalPipes > 0)
                {
                    // allocate memory for input and output pipes and multiplexing ids
                    pipes = new NamedPipe *[numTotalPipes];
                    pipeDemuxIds = new uint8_t[numTotalPipes];

                    // keep track of total, input, and output pipe names received
                    int gotPipeNames = 0;
                    // string to store the name of the pipe
                    char pipeName[50] = {0};

                    // get all the pipe names
                    while (gotPipeNames < numTotalPipes)
                    {
                        // input pipes will be given first, then output pipes
                        memset(pipeName, 0, sizeof(pipeName));
                        if (pipeControl->readStr(pipeName, sizeof(pipeName)) > 0)
                        {
                            // get the pipe name
                            pipeName[sizeof(pipeName) - 1] = '\0';
                            int indexPos = 0;
                            for (int i = 0; i < strlen(pipeName); i++)
                            {
                                if (pipeName[i] == '-')
                                    indexPos = i;
                            }

                            // separate the multiplexing id and create a pipe
                            int pipeId = atoi(pipeName + indexPos + 1);
                            std::cout << pipeId << std::endl;
                            pipeDemuxIds[gotPipeNames] = pipeId;
                            createPipe(pipes, gotPipeNames, pipeName); // this increments gotPipeNames
                        }
                    }
                    // print all the multiplexing ids for debugging
                    std::cout << "Pipe Demux Ids: " << std::endl;
                    for (int i = 0; i < numTotalPipes; i++)
                    {
                        std::cout << (int)pipeDemuxIds[i] << std::endl;
                    }
                }
                // tell the connected program the pipes have been created
                pipeStatus->writeStr("pipe creation successful");
            }
            // check for interface ready command
            if (strcmp(controlStr, "interface ready") == 0)
            {
                std::cout << "interface ready" << std::endl;
                ready = true;
            }
            // check for connected command
            if (strcmp(controlStr, "connected") == 0)
            {
                // if a handshake is pending we need to check connected after the handshake completes
                if (!handshakePending)
                {
                    // otherwise check if the connection was successful now
                    if ((device != nullptr && device->isConnected() && handshakeSuccess))
                    {
                        pipeStatus->writeStr("connected");
                    }
                    else if (device == nullptr)
                    {
                        pipeStatus->writeStr("no active serial connection");
                    }
                    else if (device != nullptr && !device->isConnected())
                    {
                        std::cout << "here" << std::endl;
                        pipeStatus->writeStr("connection failed");
                    }
                    else if (!handshakeSuccess)
                    {
                        pipeStatus->writeStr("handshake failed");
                    }
                }
                else
                {
                    checkConnectionAfterHandshake = true;
                }
            }
            // check for exit command
            if (strcmp(controlStr, "exit") == 0)
            {
                // disable other parts of the main loop
                ready = false;
                handshakeSuccess = false;
                // exit the main loop
                exit = true;
            }
        }

        // handshake sequence, i.e. make sure both sides are ready before sending/looking for data
        if (!exit && !handshakeSuccess && device != nullptr && device->isConnected() && handshakeNumAttempts < handshakeMaxAttempts)
        {
            // see if we need to start a new handshake attempt
            if (!handshakeAttempt)
            {
                // handshake is pending until successful or max attempts reached
                handshakePending = true;
                std::cout << "attempting handshake" << std::endl;

                // reset handshake resp string
                memset(handshakeResp, 0, sizeof(handshakeResp));
                handshakeRespLen = 0;

                // reset multiplexing message in case it caused the handshake attempt
                mOut.clear();
                // start timeout
                handshakeStart = clock();

                // set the handshake sequence to 0
                memset(handshakeSequence, 0, sizeof(handshakeSequence));
                // generate a new handshake sequence
                snprintf(handshakeSequence, 7, "%d\n", rand() % 32767);
                std::cout << "handshake sequence: " << handshakeSequence << std::endl;

                // tell connected serial device to start handshake sequence and write handshake sequence
                device->writeSerialPort((void *)"handshake\n", strlen("handshake\n"));
                device->writeSerialPort(handshakeSequence, 6);
                handshakeAttempt = true;
            }

            // if a handshake attempt is in progress
            if (handshakeAttempt)
            {
                // try to read from the serial port
                x = device->readSerialPort(data, MAX_DATA_LENGTH);

                // if we received data
                if (x > 0)
                {
                    bool hasNewline = false;
                    // make sure data is null terminated
                    for (int i = 0; i < x; i++)
                    {
                        if (handshakeRespLen < sizeof(handshakeResp))
                        {
                            handshakeResp[handshakeRespLen++] = data[i];
                            std::cout << data[i] << std::endl;
                        }
                        if (data[i] == '\n')
                        {
                            hasNewline = true;
                            break;
                        }
                    }
                    if (hasNewline)
                    {
                        std::cout << "Sequence: " << handshakeSequence;
                        std::cout << "Data: ";
                        for (int i = 0; i < handshakeRespLen; i++)
                        {
                            std::cout << handshakeResp[i];
                        }
                        std::cout << std::endl;
                        // check if the handshake sequence matches
                        if (strcmp(handshakeSequence, handshakeResp) == 0)
                        {
                            // if it matches then the handshake has succeeded
                            std::cout << "handshake attempt succeeded" << std::endl;
                            // tell the device the handshake has succeeded
                            device->writeSerialPort((void *)"handshake succeeded\n", strlen("handshake succeeded\n"));
                            // set flags
                            handshakeSuccess = true;
                            handshakeAttempt = false;
                            handshakePending = false;

                            // report connection status if requested
                            if (checkConnectionAfterHandshake)
                            {
                                if ((device != nullptr && device->isConnected() && handshakeSuccess))
                                {
                                    pipeStatus->writeStr("connected");
                                }
                                else if (device == nullptr)
                                {
                                    pipeStatus->writeStr("no active serial connection");
                                }
                                else if (device != nullptr && !device->isConnected())
                                {
                                    std::cout << "here1" << std::endl;
                                    pipeStatus->writeStr("connection failed");
                                }
                                else if (!handshakeSuccess)
                                {
                                    pipeStatus->writeStr("handshake failed");
                                }
                                checkConnectionAfterHandshake = false;
                            }
                        }
                        else
                        {
                            std::cout << "handshake failed" << std::endl;
                        }
                    }
                }

                // make sure we still have an active handshake attempt (in case there was a successful handshake we don't want to override that)
                if (handshakeAttempt && clock() - handshakeStart > 50) // 50ms timeout
                {
                    // the connection failed
                    std::cout << "handshake attempt timeout" << std::endl;
                    // so set flags
                    handshakeSuccess = false;
                    handshakeAttempt = false;
                    // increase the number of attempts
                    handshakeNumAttempts++;
                }
            }

            // if we have reached the max handshake attempts without a successful handshake
            if (handshakeNumAttempts >= handshakeMaxAttempts && !handshakeSuccess)
            {
                // report that the handshake has failed
                std::cout << "max attempts reached" << std::endl;
                // TODO: maybe not needed
                pipeStatus->writeStr("Interrupt\n");
                pipeStatus->writeStr("serial connection error: handshake failed\n");
                device->writeSerialPort((void *)"handshake failed\n", strlen("handshake failed\n"));
                handshakePending = false;

                // report connection status if requested
                if (checkConnectionAfterHandshake)
                {
                    if ((device != nullptr && device->isConnected() && handshakeSuccess))
                    {
                        pipeStatus->writeStr("connected");
                    }
                    else if (device == nullptr)
                    {
                        pipeStatus->writeStr("no active serial connection");
                    }
                    else if (device != nullptr && !device->isConnected())
                    {
                        std::cout << "here2" << std::endl;
                        pipeStatus->writeStr("connection failed");
                    }
                    else if (!handshakeSuccess)
                    {
                        pipeStatus->writeStr("handshake failed");
                    }
                    checkConnectionAfterHandshake = false;
                }
            }
        }

        // if interface is ready and handshake was successful, then we can read from the device
        if (handshakeSuccess && ready && device != nullptr && device->isConnected())
        {
            // try reading multiplexing data from the device
            x = device->readSerialPort(data, MAX_DATA_LENGTH);
            dataHandled = 0;

            if (x > 0)
            {
                std::cout << "Serial data: ";
                for (int i = 0; i < x; i++)
                {
                    std::cout << data[i];
                }
                std::cout << std::endl;
            }

            // while all of the data hasn't been handled
            while (dataHandled < x)
            {
                // check if we need to find the header
                if (!headerFound)
                {
                    // copy up to headerLen bytes into header
                    for (int i = dataHandled; i < x; i++)
                    {
                        header[headerSize] = data[i];
                        headerSize++;
                        if (headerSize == GSData::headerLen)
                            break;
                    }

                    // if we have GSData::headerLen bytes in the header we've found the header
                    if (headerSize == GSData::headerLen)
                    {
                        // decode the header and check we got a valid header
                        GSData::decodeHeader(header, msgType, msgIndex, msgSize);
                        std::cout << "Type: " << (int)msgType << " Index: " << (int)msgIndex << " Size: " << (int)msgSize << std::endl;
                        if (msgType > 0 && msgIndex > 0 && msgSize > 0)
                        {
                            if (msgSize <= Message::maxSize)
                            {
                                headerFound = true;
                            }
                            else
                            {
                                std::cout << "Requested size of " << msgSize << " is too large, ignoring" << std::endl;
                                // something is out of sync, so redo handshake
                                handshakeSuccess = false;
                            }
                        }
                        else
                        {
                            std::cout << "Error parsing header, at least one field was not set correctly" << std::endl;
                            dataHandled += GSData::headerLen; // want to get rid of these bytes
                        }
                        // reset the header variables
                        memset(header, 0, sizeof(header));
                        headerSize = 0;
                    }

                    // append the read data to the message
                    if (x - dataHandled > 0 && mOut.size + x - dataHandled <= msgSize + GSData::headerLen)
                    {
                        mOut.append(data + dataHandled, x - dataHandled);
                        dataHandled += x - dataHandled;
                    }
                    else if (x - dataHandled > 0 && mOut.size < msgSize + GSData::headerLen && mOut.size + x - dataHandled > msgSize + GSData::headerLen)
                    {
                        int toCopy = msgSize + GSData::headerLen - mOut.size;
                        mOut.append(data + dataHandled, toCopy);
                        dataHandled += toCopy;
                    }
                }
                // we found the header
                if (headerFound)
                {
                    // append the read data to the message
                    if (x - dataHandled > 0 && mOut.size + x - dataHandled <= msgSize + GSData::headerLen)
                    {
                        mOut.append(data + dataHandled, x - dataHandled);
                        dataHandled += x - dataHandled;
                    }
                    else if (x - dataHandled > 0 && mOut.size + x - dataHandled > msgSize + GSData::headerLen)
                    {
                        std::cout << "Expected size: " << msgSize + GSData::headerLen << " and got size: " << mOut.size << std::endl;
                        int toCopy = msgSize + GSData::headerLen - mOut.size;
                        mOut.append(data + dataHandled, toCopy);
                        dataHandled += toCopy;
                    }

                    // debug statements if something goes wrong
                    if (mOut.size > msgSize + GSData::headerLen)
                    {
                        std::cout << "Expected size: " << msgSize + GSData::headerLen << ", but got size: " << mOut.size << std::endl;
                    }

                    if (x - dataHandled == 0 && mOut.size < msgSize + GSData::headerLen)
                    {
                        std::cout << "Expected size: " << msgSize + GSData::headerLen << ", but got size: " << mOut.size << std::endl;
                    }

                    // if the message size (which includes the GSData)
                    // is the same as the payload size + the header then we read the whole message
                    if (mOut.size == msgSize + GSData::headerLen)
                    {

                        // we have a complete message
                        mOut.decode(&rawData);

                        std::cout << "After decoding:" << std::endl;
                        std::cout << "Type: " << (int)rawData.dataType << " Index: " << (int)rawData.id << " Size: " << (int)rawData.size << std::endl;

                        // reset the output message
                        mOut.clear();
                        // add the GSData payload to the output message
                        mOut.fill(rawData.buf, rawData.size);
                        mOut.write();
                        std::cout << std::endl;

                        // determine the type of data
                        if (rawData.dataType == APRSTelem::type)
                        {
                            // this is an APRSTelem message
                            APRSTelem outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            // need to skip over all the input pipe ids
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.id)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    pipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (rawData.dataType == VideoData::type)
                        {
                            // this is video data
                            VideoData outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.id)
                                {
                                    if (enableRS)
                                    {
                                        // assume 255 byte block size
                                        const uint8_t blockSize = 255;
                                        uint8_t correctedData[blockSize] = {};
                                        // assume message made up of an integer number of blocks
                                        for (int j = 0; j < mOut.size / blockSize; j++)
                                        {
                                            // loop through each block
                                            std::cout << "on video block " << j << std::endl;
                                            rs.decode_data(mOut.buf + (blockSize * j), blockSize);
                                            // check for errors
                                            int syn = rs.check_syndrome();
                                            if (syn != 0)
                                            {
                                                // if errors try to correct them
                                                std::cout << "Errors in video block, syndrome = " << syn << std::endl;
                                                // TODO: can only correct errors for now, not erasures
                                                int result = rs.correct_errors_erasures(mOut.buf + (blockSize * j), blockSize, 0, erasureDummyArr);
                                                std::cout << "Attempted correction, result = " << result << std::endl;
                                                // TODO: what to do if we can't correct errors
                                            }
                                            // write the data (minus parity bits)
                                            pipes[i]->write(mOut.buf + (blockSize * j), blockSize - NPAR);
                                        }
                                    }
                                    else
                                    {
                                        pipes[i]->write(mOut.buf, mOut.size);
                                    }
                                }
                            }
                        }
                        if (rawData.dataType == APRSCmd::type)
                        {
                            // this is an APRSCmd message
                            APRSCmd outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.id)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[numInputPipes + i]);
                                    strcat(outStr, "\n");
                                    pipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (rawData.dataType == APRSText::type)
                        {
                            // this is an APRSText message
                            APRSText outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.id)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    pipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (rawData.dataType == Metrics::type)
                        {
                            // this is a Metrics message
                            Metrics outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.id)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    pipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }

                        // reset
                        mOut.clear();
                        headerFound = false;
                        msgType = 0;
                        msgIndex = 0;
                        msgSize = 0;
                    }
                }

                std::cout << "Found: " << headerFound << std::endl;
                std::cout << "Handled " << dataHandled << " out of " << x << std::endl;
            }

            // handle commands
            for (int i = 0; i < numInputPipes; i++)
            {
                // check to see if we received a command from the GUI
                memset(inStr, 0, sizeof(inStr));
                if (pipes[i]->read(inStr, sizeof(inStr)))
                {
                    // assume APRSCmd for now
                    // encode the APRSCmd from the JSON
                    APRSCmd inData;
                    int id = 0;
                    strlen(inStr);
                    std::cout << inStr << std::endl;
                    inData.fromJSON(inStr, strlen(inStr), id);
                    mIn.clear();
                    mIn.encode(&inData);
                    // take the APRSCmd and place it in a GSData object for multiplexing
                    GSData inDataGS(APRSCmd::type, pipeDemuxIds[i], mIn.buf, mIn.size);
                    mIn.clear();
                    mIn.encode(&inDataGS);
                    mIn.write();
                    std::cout << std::endl;
                    // tell the device we are sending a command
                    device->writeSerialPort((void *)"command\n", strlen("command\n"));
                    // write the new message formatted for multiplexing
                    device->writeSerialPort(mIn.buf, mIn.size);
                }
            }
        }
        // handle the device being disconnected
        else if (ready && device != nullptr && !device->isConnected())
        {
            pipeStatus->writeStr("Interrupt\n");
            pipeStatus->writeStr("serial connection error: connection lost\n");
            handshakeSuccess = false;
            ready = false;
        }
    }

    std::cout << "Exit" << std::endl;

    // properly delete everything
    if (device != nullptr)
        delete device;

    if (pipes != nullptr)
    {
        for (int i = 0; i < numTotalPipes; i++)
        {
            delete pipes[i];
        }
        delete[] pipes;
    }

    delete pipeControl;
    delete pipeStatus;

    return 0;
}

// adds a new named pipe (based on platform, with prefix) to the NamedPipe "arr" at "index" with name "name"
// also increments the index
void createPipe(NamedPipe **arr, int &index, const char *name)
{
    std::cout << "Creating pipe of name: " << name << std::endl;
    // assemble the pipe name and call the proper class based on platform
#ifdef WINDOWS
    char pipePath[60] = "\\\\.\\pipe\\";
    strcat(pipePath, name);
    arr[index++] = new WinNamedPipe(pipePath, true);
#elif LINUX
    // need to update these paths for abstract sockets
    char pipePath[60] = "./build/serial/pipes/";
    strcat(pipePath, name);
    arr[index++] = new LinuxNamedPipe(pipePath, true);
#endif
}