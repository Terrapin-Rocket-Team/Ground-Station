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
#include <chrono>

#include "RadioMessage.h"
#include "rs.h"

const char deviceLogFile[] = "log/serial_device.log";

void createPipe(NamedPipe **arr, int &index, const char *name);

std::chrono::milliseconds::rep elapsed(std::chrono::time_point<std::chrono::steady_clock> start);

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
    // the total number of pipes (input and output)
    int numTotalPipes = 0;

    // whether the pipe interface is ready
    bool ready = false;
    // whether the handshake with the device was successful
    bool handshakeSuccess = false;
    // whether there is a handshake being attempted (with a specific sequence)
    bool handshakeAttempt = false;
    // timeout to allow multiple attempts for 1 handshake sequence
    auto handshakeStart = std::chrono::steady_clock::now();
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

    // a message to hold only the data for a single multiplexed message
    GSMessage mOut;
    // a message to hold data from driver input pipes
    GSMessage mIn;

    // file to write serial device data to
    FILE *log = fopen(deviceLogFile, "wb");

    const uint8_t statusIndex = 1;

    // an object to handle the serial device connection
    SerialPort *device = nullptr;

    // required so that the program interfacing with the driver knows when the control and status pipes are ready
    std::cout << "driver ready" << std::endl;

    // identify the driver
    std::cout << "main driver v2.1.0" << std::endl;

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
                // get number of pipes
                bool gotNumPipes = false;
                char numPipesStr[3] = {0};
                while (!gotNumPipes)
                {
                    memset(numPipesStr, 0, sizeof(numPipesStr));
                    if (pipeControl->readStr(numPipesStr, sizeof(numPipesStr)) > 0)
                    {
                        numPipesStr[sizeof(numPipesStr) - 1] = '\0';
                        std::cout << "Received num pipes: " << numPipesStr << std::endl;
                        gotNumPipes = true;
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
                numTotalPipes = atoi(numPipesStr);

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

                            // create the pipe
                            int pipeId = atoi(pipeName);               // pipeName will always be a number (the id)
                            pipeDemuxIds[gotPipeNames] = pipeId;       // store ids as numbers in array for easy access
                            createPipe(pipes, gotPipeNames, pipeName); // this increments gotPipeNames
                        }
                    }
                    // print all the multiplexing ids for debugging
                    std::cout << "Pipe Demux Ids: ";
                    for (int i = 0; i < numTotalPipes; i++)
                    {
                        std::cout << (int)pipeDemuxIds[i] << " ";
                    }
                    std::cout << std::endl;
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
                handshakeStart = std::chrono::steady_clock::now();

                // set the handshake sequence to 0
                memset(handshakeSequence, 0, sizeof(handshakeSequence));
                // generate a new handshake sequence
                snprintf(handshakeSequence, sizeof(handshakeSequence), "%d", rand() % 32767);
                std::cout << "handshake sequence: " << handshakeSequence << std::endl;

                GSControl hs("HANDSHAKE", handshakeSequence);
                mIn.setMetadata(GSControl::type, statusIndex);
                mIn.encode(&hs);

                // tell connected serial device to start handshake sequence and write handshake sequence
                device->writeSerialPort(mIn.buf, mIn.size);
                std::cout << "handshake message: ";
                mIn.write();
                std::cout << std::endl;
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
                    for (int i = 0; i < x; i++)
                    {
                        if (handshakeRespLen < sizeof(handshakeResp))
                        {
                            handshakeResp[handshakeRespLen++] = data[i];
                        }
                        else
                        {
                            // too much data, restart handshake
                        }
                        if (data[i] == '\n')
                        {
                            std::cout << "Received response after: " << elapsed(handshakeStart) << "ms" << std::endl;
                            handshakeResp[i] = 0; // set to newline to null terminator
                            hasNewline = true;
                            break;
                        }
                    }
                    if (hasNewline)
                    {
                        std::cout << "Sequence: " << handshakeSequence << std::endl;
                        std::cout << "Data: ";
                        for (int i = 0; i < handshakeRespLen - 1; i++)
                        {
                            std::cout << handshakeResp[i];
                        }
                        std::cout << std::endl;

                        // check if the handshake sequence matches
                        bool success = strcmp(handshakeSequence, handshakeResp) == 0;

                        GSControl hs("HS_DONE", success ? "SUCCESS" : "FAIL");
                        mIn.setMetadata(GSControl::type, statusIndex);
                        mIn.encode(&hs);

                        // tell connected serial device that handshake result
                        device->writeSerialPort(mIn.buf, mIn.size);

                        // handle other actions
                        if (success)
                        {
                            std::cout << "handshake attempt succeeded" << std::endl;

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
                                    std::cout << "connection failed from handshake" << std::endl;
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
                if (handshakeAttempt && elapsed(handshakeStart) > 50) // 100ms timeout
                {
                    // the connection failed
                    std::cout << "handshake attempt timeout after 50ms" << std::endl;
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
                    // TODO: make sure mOut is cleared
                    // copy up to headerLen bytes into header
                    for (int i = dataHandled; i < x; i++)
                    {
                        mOut.append(data[i]);
                        dataHandled++;
                        if (mOut.size == GSMessage::headerLen)
                            break;
                    }

                    // if we have GSData::headerLen bytes in the header we've found the header
                    if (mOut.size == GSMessage::headerLen)
                    {
                        // decode the header and check we got a valid header
                        if (mOut.decodeHeader())
                        {
                            std::cout << "Type: " << (int)mOut.dataType << " Index: " << (int)mOut.id << " Size: " << (int)mOut.msgSize << std::endl;
                            if (mOut.dataType > 0 && mOut.id > 0 && mOut.msgSize > 0)
                            {
                                if (mOut.msgSize <= GSMessage::maxSize)
                                {
                                    headerFound = true;
                                }
                                else
                                {
                                    std::cout << "Requested size of " << mOut.msgSize << " is too large, redoing handshake" << std::endl;
                                    handshakeSuccess = false; // something is out of sync, so redo handshake
                                    dataHandled = x;          // we handled all data since there was an error
                                    mOut.clear();             // clear erroneous data in the message
                                }
                            }
                            else
                            {
                                std::cout << "Error parsing header, at least one field was not set correctly" << std::endl;
                                mOut.clear(); // clear erroneous data in the message
                            }
                        }
                        else
                        {
                            std::cout << "Error parsing header, parsing failed in GSMessage" << std::endl;
                            mOut.clear(); // clear erroneous data in the message
                        }
                    }
                }
                // we found the header
                if (headerFound)
                {
                    // append the read data to the message
                    if (x - dataHandled > 0 && mOut.size + x - dataHandled <= mOut.msgSize + GSMessage::headerLen)
                    {
                        mOut.append(data + dataHandled, x - dataHandled);
                        dataHandled += x - dataHandled;
                    }
                    else if (x - dataHandled > 0 && mOut.size + x - dataHandled > mOut.msgSize + GSMessage::headerLen)
                    {
                        std::cout << "Expected size: " << mOut.msgSize + GSMessage::headerLen << " and got size: " << mOut.size << std::endl;
                        int toCopy = mOut.msgSize + GSMessage::headerLen - mOut.size;
                        mOut.append(data + dataHandled, toCopy);
                        dataHandled += toCopy;
                    }

                    // debug statements if something goes wrong
                    if (mOut.size > mOut.msgSize + GSMessage::headerLen)
                    {
                        std::cout << "Expected size: " << mOut.msgSize + GSMessage::headerLen << ", but got size: " << mOut.size << std::endl;
                    }

                    if (x - dataHandled == 0 && mOut.size < mOut.msgSize + GSMessage::headerLen)
                    {
                        std::cout << "Expected size: " << mOut.msgSize + GSMessage::headerLen << ", but got size: " << mOut.size << std::endl;
                    }

                    // if the message size (which includes the GSData)
                    // is the same as the payload size + the header then we read the whole message
                    if (mOut.size == mOut.msgSize + GSMessage::headerLen)
                    {
                        if (mOut.dataType == GSControl::type)
                        {
                            // this is a GSControl message
                            GSControl outData;
                            mOut.decode(&outData);
                            // handle fatal errors
                            if (strcmp(outData.cmdBuf, "FATAL") == 0)
                            {
                                // hard reset device if it hasn't already
                                GSControl cont("RESET", "");
                                mIn.setMetadata(GSControl::type, statusIndex);
                                mIn.encode(&cont);
                                mIn.write();
                                std::cout << std::endl;
                                device->writeSerialPort(mIn.buf, mIn.size);

                                // reset so handshake is invalid
                                handshakeSuccess = false;
                                // and close serial connection because the device is hard resetting
                                device->closeSerial();
                            }
                            // this doesn't go to a pipe, write to a log file instead
                            fwrite(outData.argBuf, sizeof(char), strlen(outData.argBuf), log);
                            fwrite("\n", sizeof(char), 1, log);
                            fflush(log);
                        }
                        // we have a complete message
                        // determine the type of data
                        if (mOut.dataType == APRSTelem::type)
                        {
                            // this is an APRSTelem message
                            APRSTelem outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            // need to skip over all the input pipe ids
                            for (int i = 0; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == mOut.id)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    pipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (mOut.dataType == VideoData::type)
                        {
                            // this is video data
                            VideoData outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = 0; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == mOut.id)
                                {
                                    if (enableRS)
                                    {
                                        // assume 255 byte block size
                                        const uint8_t blockSize = 255;
                                        uint8_t correctedData[blockSize] = {};
                                        // assume message made up of an integer number of blocks
                                        for (int j = 0; j < outData.size / blockSize; j++)
                                        {
                                            // loop through each block
                                            std::cout << "on video block " << j << std::endl;
                                            rs.decode_data(outData.data + (blockSize * j), blockSize);
                                            // check for errors
                                            int syn = rs.check_syndrome();
                                            if (syn != 0)
                                            {
                                                // if errors try to correct them
                                                std::cout << "Errors in video block, syndrome = " << syn << std::endl;
                                                // TODO: can only correct errors for now, not erasures
                                                int result = rs.correct_errors_erasures(outData.data + (blockSize * j), blockSize, 0, erasureDummyArr);
                                                std::cout << "Attempted correction, result = " << result << std::endl;
                                                // TODO: what to do if we can't correct errors
                                            }
                                            // write the data (minus parity bits)
                                            pipes[i]->write(outData.data + (blockSize * j), blockSize - NPAR);
                                        }
                                    }
                                    else
                                    {
                                        pipes[i]->write(outData.data, outData.size);
                                    }
                                }
                            }
                        }
                        if (mOut.dataType == GenericData::type)
                        {
                            // this is video data
                            GenericData outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = 0; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == mOut.id)
                                {
                                    if (enableRS)
                                    {
                                        // assume 255 byte block size
                                        const uint8_t blockSize = 255;
                                        uint8_t correctedData[blockSize] = {};
                                        // assume message made up of an integer number of blocks
                                        for (int j = 0; j < outData.size / blockSize; j++)
                                        {
                                            // loop through each block
                                            std::cout << "on video block " << j << std::endl;
                                            rs.decode_data(outData.data + (blockSize * j), blockSize);
                                            // check for errors
                                            int syn = rs.check_syndrome();
                                            if (syn != 0)
                                            {
                                                // if errors try to correct them
                                                std::cout << "Errors in video block, syndrome = " << syn << std::endl;
                                                // TODO: can only correct errors for now, not erasures
                                                int result = rs.correct_errors_erasures(outData.data + (blockSize * j), blockSize, 0, erasureDummyArr);
                                                std::cout << "Attempted correction, result = " << result << std::endl;
                                                // TODO: what to do if we can't correct errors
                                            }
                                            // write the data (minus parity bits)
                                            pipes[i]->write(outData.data + (blockSize * j), blockSize - NPAR);
                                        }
                                    }
                                    else
                                    {
                                        pipes[i]->write(outData.data, outData.size);
                                    }
                                }
                            }
                        }
                        if (mOut.dataType == APRSCmd::type)
                        {
                            // this is an APRSCmd message
                            APRSCmd outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = 0; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == mOut.id)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    pipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (mOut.dataType == APRSText::type)
                        {
                            // this is an APRSText message
                            APRSText outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = 0; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == mOut.id)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    pipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (mOut.dataType == Metrics::type)
                        {
                            // this is a Metrics message
                            Metrics outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = 0; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == mOut.id)
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
                    }
                }

                std::cout << "Found: " << headerFound << std::endl;
                std::cout << "Handled " << dataHandled << " out of " << x << std::endl;
            }

            // handle commands
            for (int i = 0; i < numTotalPipes; i++)
            {
                // check to see if we received a command from the GUI
                memset(inStr, 0, sizeof(inStr));
                std::cout << "Reading from pipe: " << i << std::endl;
                if (pipes[i]->read(inStr, sizeof(inStr) - 1) > 0) // ensure null terminated
                {
                    char type[30];
                    memset(type, 0, sizeof(type)); // initialize entire array to 0 to ensure null terminated
                    std::cout << "Got input: " << inStr << std::endl;
                    if (Data::extractStr(inStr, strlen(inStr), "\"type\":\"", '\"', type, sizeof(type)))
                    {
                        if (strcmp(type, "GSControl") == 0)
                        {
                            // this is a GSControl, encode it from the JSON
                            GSControl inData;
                            int id = 0;
                            inData.fromJSON(inStr, strlen(inStr), id);
                            mIn.setMetadata(GSControl::type, pipeDemuxIds[i]);
                            mIn.encode(&inData);
                            std::cout << "Sending to device: " << mIn.buf + GSMessage::headerLen << std::endl;
                            // write the new message formatted for multiplexing
                            device->writeSerialPort(mIn.buf, mIn.size);
                        }
                        else if (strcmp(type, "APRSTelem") == 0)
                        {
                            // this is an APRSTelem, encode it from the JSON
                            APRSTelem inData;
                            int id = 0;
                            inData.fromJSON(inStr, strlen(inStr), id);
                            mIn.setMetadata(APRSTelem::type, pipeDemuxIds[i]);
                            mIn.encode(&inData);
                            std::cout << "Sending to device: " << mIn.buf + GSMessage::headerLen << std::endl;
                            // write the new message formatted for multiplexing
                            device->writeSerialPort(mIn.buf, mIn.size);
                        }
                        else if (strcmp(type, "APRSCmd") == 0)
                        {
                            // this is an APRSCmd, encode it from the JSON
                            APRSCmd inData;
                            int id = 0;
                            inData.fromJSON(inStr, strlen(inStr), id);
                            mIn.setMetadata(APRSCmd::type, pipeDemuxIds[i]);
                            mIn.encode(&inData);
                            std::cout << "Sending to device: " << mIn.buf + GSMessage::headerLen << std::endl;
                            // write the new message formatted for multiplexing
                            device->writeSerialPort(mIn.buf, mIn.size);
                        }
                        else if (strcmp(type, "Metrics") == 0)
                        {
                            // this is a Metrics, encode it from the JSON
                            Metrics inData;
                            int id = 0;
                            inData.fromJSON(inStr, strlen(inStr), id);
                            mIn.setMetadata(Metrics::type, pipeDemuxIds[i]);
                            mIn.encode(&inData);
                            std::cout << "Sending to device: " << mIn.buf + GSMessage::headerLen << std::endl;
                            // write the new message formatted for multiplexing
                            device->writeSerialPort(mIn.buf, mIn.size);
                        }
                        else if (strcmp(type, "HITLData") == 0)
                        {
                            // this is a HITLData, encode it from the JSON
                            // TODO: update when HITLData is written
                            Metrics inData;
                            int id = 0;
                            inData.fromJSON(inStr, strlen(inStr), id);
                            mIn.setMetadata(Metrics::type, pipeDemuxIds[i]);
                            mIn.encode(&inData);
                            std::cout << "Sending to device: " << mIn.buf + GSMessage::headerLen << std::endl;
                            // write the new message formatted for multiplexing
                            device->writeSerialPort(mIn.buf, mIn.size);
                        }
                        else
                        {
                            std::cout << "Error: type not in supported types, type was: " << type << std::endl;
                        }
                    }
                    else
                    {
                        std::cout << "Error: could not find type for JSON: " << inStr << std::endl;
                    }
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

std::chrono::milliseconds::rep elapsed(std::chrono::time_point<std::chrono::steady_clock> start)
{
    return (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - start)).count();
}