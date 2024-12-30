//
// Created by ramykaddouri on 10/19/24.
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

void createPipe(NamedPipe **arr, int &index, const char *name);

int main(int argc, char **argv)
{
    unsigned char data[MAX_DATA_LENGTH + 1];
    int dataHandled = 0;
    NamedPipe *pipeControl;
    NamedPipe *pipeStatus;
    NamedPipe **inputPipes = nullptr;
    NamedPipe **outputPipes = nullptr;
    uint8_t *pipeDemuxIds = nullptr;
    int numInputPipes = 0;
    int numOutputPipes = 0;
    int numTotalPipes = 0;

    bool ready = false;
    bool handshakeSuccess = false;
    bool handshakeAttempt = false;
    bool handshakePending = false;
    bool checkConnectionAfterHandshake = false;
    char handshakeSequence[6 + 1] = {0};
    uint8_t handshakeMaxAttempts = 5;
    uint8_t handshakeNumAttempts = 0;
    srand(time(0));

#ifdef WINDOWS
    pipeControl = new WinNamedPipe("\\\\.\\pipe\\control", true);
    pipeStatus = new WinNamedPipe("\\\\.\\pipe\\status", true);
#elif LINUX
    // THESE PATHS MIGHT BE WRONG!
    pipeControl = new LinuxNamedPipe("./build/serial/pipes/control", true);
    pipeStatus = new LinuxNamedPipe("./build/serial/pipes/status", true);
#endif

    size_t x;
    const size_t maxChunkSize = 1024 * 16;

    uint8_t header[5] = {0};
    uint8_t headerSize = 0;
    bool headerFound = false;

    uint8_t msgType = 0;
    uint8_t msgIndex = 0;
    uint16_t msgSize = 0;

    char outStr[maxChunkSize] = {0};
    char inStr[maxChunkSize] = {0};

    Message m;
    Message mOut;
    Message mIn;

    GSData rawData;

    SerialPort *device = nullptr;

    std::cout << "driver ready" << std::endl;

    bool exit = false;
    char controlStr[50];

    while (!exit)
    {
        memset(controlStr, 0, sizeof(controlStr));

        if (pipeControl->readStr(controlStr, sizeof(controlStr)) > 0)
        {
            std::cout << controlStr << std::endl;
            if (strcmp(controlStr, "close") == 0)
            {
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
            if (strcmp(controlStr, "reset") == 0)
            {
                ready = false;
                handshakeSuccess = false;
                handshakeNumAttempts = 0;

                if (device != nullptr)
                {
                    delete device;
                    device = nullptr;
                }

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

#ifdef WINDOWS
                device = new WinSerialPort(portBuf);
#elif LINUX
                device = new LinuxSerialPort(portBuf);
#endif

                // attempt to connect
                // time_t start = time(0);
                // bool timeout = false;
                // while (!timeout && !(device->isConnected()))
                // {
                //     time_t end = time(0);
                //     if (difftime(end, start) > 2)
                //         timeout = true;
                // }
            }
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
                if (inputPipes != nullptr)
                {
                    for (int i = 0; i < numInputPipes; i++)
                    {
                        delete inputPipes[i];
                    }
                    delete[] inputPipes;
                    inputPipes = nullptr;
                }
                if (outputPipes != nullptr)
                {
                    for (int i = 0; i < numOutputPipes; i++)
                    {
                        delete outputPipes[i];
                    }
                    delete[] outputPipes;
                    outputPipes = nullptr;
                }

                if (pipeDemuxIds != nullptr)
                {
                    delete[] pipeDemuxIds;
                    pipeDemuxIds = nullptr;
                }

                numInputPipes = atoi(numInputPipesStr);
                numOutputPipes = atoi(numOutputPipesStr);
                numTotalPipes = numInputPipes + numOutputPipes;

                if (numTotalPipes > 0)
                {
                    inputPipes = new NamedPipe *[numInputPipes];
                    outputPipes = new NamedPipe *[numOutputPipes];
                    pipeDemuxIds = new uint8_t[numTotalPipes];

                    int gotPipeNames = 0;
                    int gotInputPipeNames = 0;
                    int gotOutputPipeNames = 0;
                    char pipeName[50] = {0};

                    // input pipes will be given first
                    while (gotPipeNames < numTotalPipes)
                    {
                        while (gotInputPipeNames < numInputPipes)
                        {
                            memset(pipeName, 0, sizeof(pipeName));
                            if (pipeControl->readStr(pipeName, sizeof(pipeName)) > 0)
                            {
                                pipeName[sizeof(pipeName) - 1] = '\0';
                                int indexPos = 0;
                                for (int i = 0; i < strlen(pipeName); i++)
                                {
                                    if (pipeName[i] == '-')
                                        indexPos = i;
                                }

                                int pipeId = atoi(pipeName + indexPos + 1);
                                std::cout << pipeId << std::endl;
                                pipeDemuxIds[gotPipeNames] = pipeId;
                                createPipe(inputPipes, gotInputPipeNames, pipeName);
                                gotPipeNames++;
                            }
                        }

                        while (gotOutputPipeNames < numOutputPipes)
                        {
                            memset(pipeName, 0, sizeof(pipeName));
                            if (pipeControl->readStr(pipeName, sizeof(pipeName)) > 0)
                            {
                                pipeName[sizeof(pipeName) - 1] = '\0';
                                int indexPos = 0;
                                for (int i = 0; i < strlen(pipeName); i++)
                                {
                                    if (pipeName[i] == '-')
                                        indexPos = i;
                                }

                                int pipeId = atoi(pipeName + indexPos + 1);
                                std::cout << pipeId << std::endl;
                                pipeDemuxIds[gotPipeNames] = pipeId;

                                // pipeName[indexPos] = '\0';
                                createPipe(outputPipes, gotOutputPipeNames, pipeName);
                                gotPipeNames++;
                            }
                        }
                    }
                    std::cout << "Pipe Demux Ids: " << std::endl;
                    for (int i = 0; i < numTotalPipes; i++)
                    {
                        std::cout << (int)pipeDemuxIds[i] << std::endl;
                    }
                }
                pipeStatus->writeStr("pipe creation successful");
            }
            if (strcmp(controlStr, "interface ready") == 0)
            {
                std::cout << "interface ready" << std::endl;
                ready = true;
            }
            if (strcmp(controlStr, "connected") == 0)
            {
                if (!handshakePending)
                {
                    if ((device != nullptr && device->isConnected() && handshakeSuccess))
                    {
                        pipeStatus->writeStr("connected");
                    }
                    else if (device == nullptr || !device->isConnected())
                    {
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
            if (strcmp(controlStr, "exit") == 0)
            {
                std::cout << "exiting" << std::endl;
                ready = false;
                handshakeSuccess = false;
                exit = true;
            }
        }

        // handshake sequence, i.e. make sure both sides are ready before sending/looking for data
        if (!handshakeSuccess && device != nullptr && device->isConnected() && handshakeNumAttempts < handshakeMaxAttempts)
        {
            if (!handshakeAttempt)
            {
                handshakePending = true;
                std::cout << "attempting handshake" << std::endl;
                memset(handshakeSequence, 0, sizeof(handshakeSequence));
                snprintf(handshakeSequence, 7, "%d\n", rand() % 32767);
                std::cout << "handshake sequence: " << handshakeSequence << std::endl;
                device->writeSerialPort((void *)"handshake\n", 11);
                device->writeSerialPort(handshakeSequence, 6);
                handshakeAttempt = true;
            }
            if (handshakeAttempt)
            {
                x = device->readSerialPort(data, MAX_DATA_LENGTH);

                if (x > 0)
                {
                    data[x] = 0;
                    std::cout << "Sequence: " << handshakeSequence;
                    std::cout << "Data: ";
                    for (int i = 0; i < x; i++)
                    {
                        std::cout << data[i];
                    }
                    std::cout << std::endl;
                    if (strcmp(handshakeSequence, (char *)data) == 0)
                    {
                        std::cout << "handshake attempt succeeded" << std::endl;
                        device->writeSerialPort((void *)"success\n", 9);
                        handshakeSuccess = true;
                        handshakeAttempt = false;
                        handshakePending = false;

                        if (checkConnectionAfterHandshake)
                        {
                            if ((device != nullptr && device->isConnected() && handshakeSuccess))
                            {
                                pipeStatus->writeStr("connected");
                            }
                            else if (device == nullptr || !device->isConnected())
                            {
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
                        std::cout << "handshake attempt failed" << std::endl;
                        handshakeSuccess = false;
                        handshakeAttempt = false;
                        handshakeNumAttempts++;
                    }
                }
            }
            if (handshakeNumAttempts >= handshakeMaxAttempts && !handshakeSuccess)
            {
                std::cout << "max attempts reached" << std::endl;
                pipeStatus->writeStr("Interrupt\n");
                pipeStatus->writeStr("serial connection error: handshake failed\n");
                handshakePending = false;
                if (checkConnectionAfterHandshake)
                {
                    if ((device != nullptr && device->isConnected() && handshakeSuccess))
                    {
                        pipeStatus->writeStr("connected");
                    }
                    else if (device == nullptr || !device->isConnected())
                    {
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

        if (handshakeSuccess && ready && device != nullptr && device->isConnected())
        {
            x = device->readSerialPort(data, MAX_DATA_LENGTH);
            dataHandled = 0;

            while (dataHandled < x)
            {
                // check if we need to find the header
                if (!headerFound)
                {
                    // copy up to headerLen bytes into header
                    for (int i = 0; i < x; i++)
                    {
                        header[headerSize] = data[i];
                        headerSize++;
                        if (headerSize == GSData::headerLen)
                            break;
                    }

                    // if we have 5 bytes in the header we've found the header
                    if (headerSize == GSData::headerLen)
                    {

                        GSData::decodeHeader(header, msgType, msgIndex, msgSize);
                        std::cout << "Type: " << (int)msgType << " Index: " << (int)msgIndex << " Size: " << (int)msgSize << std::endl;
                        if (msgType > 0 && msgIndex > 0 && msgSize > 0)
                        {
                            headerFound = true;
                        }
                        else
                        {
                            std::cout << "Error parsing header, at least one field was not set correctly" << std::endl;
                        }
                        memset(header, 0, sizeof(header));
                        headerSize = 0;
                    }

                    // append the read data to the message
                    if (x - dataHandled > 0 && m.size + x - dataHandled <= msgSize + GSData::headerLen)
                    {
                        m.append(data + dataHandled, x - dataHandled);
                        dataHandled += x - dataHandled;
                    }
                    else if (x - dataHandled > 0 && m.size < msgSize + GSData::headerLen && m.size + x - dataHandled > msgSize + GSData::headerLen)
                    {
                        int toCopy = msgSize + GSData::headerLen - m.size;
                        m.append(data + dataHandled, toCopy);
                        dataHandled += toCopy;
                    }
                }
                // we found the header
                if (headerFound)
                {
                    // append the read data to the message
                    if (x - dataHandled > 0 && m.size + x - dataHandled <= msgSize + GSData::headerLen)
                    {
                        m.append(data + dataHandled, x - dataHandled);
                        dataHandled += x - dataHandled;
                    }
                    else if (x - dataHandled > 0 && m.size + x - dataHandled > msgSize + GSData::headerLen)
                    {
                        std::cout << "Expected size: " << msgSize + GSData::headerLen << " and got size: " << m.size << std::endl;
                        int toCopy = msgSize + GSData::headerLen - m.size;
                        m.append(data + dataHandled, toCopy);
                        dataHandled += toCopy;
                    }

                    if (m.size > msgSize + GSData::headerLen)
                    {
                        std::cout << "Expected size: " << msgSize + GSData::headerLen << ", but got size: " << m.size << std::endl;
                    }

                    if (x - dataHandled == 0 && m.size < msgSize + GSData::headerLen)
                    {
                        std::cout << "Expected size: " << msgSize + GSData::headerLen << ", but got size: " << m.size << std::endl;
                    }

                    // if the message size (which includes the GSData)
                    // is the same as the payload size + the header then we read the whole message
                    if (m.size == msgSize + GSData::headerLen)
                    {

                        // we have a complete message
                        m.decode(&rawData);

                        std::cout << "After decoding:" << std::endl;
                        std::cout << rawData.buf << std::endl;

                        // reset the output message
                        mOut.clear();
                        // add the GSData payload to the output message
                        mOut.fill(rawData.buf, rawData.size);

                        if (rawData.type == APRSTelem::TYPE)
                        {
                            // this is an APRSTelem message
                            APRSTelem outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.index)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    outputPipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (rawData.type == VideoData::TYPE)
                        {
                            // this is video data
                            VideoData outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                // need to skip over all the input pipe ids
                                if (pipeDemuxIds[i] == rawData.index)
                                {
                                    outputPipes[i]->write(m.buf, m.size);
                                }
                            }
                        }
                        if (rawData.type == APRSCmd::TYPE)
                        {
                            // this is an APRSCmd message
                            APRSCmd outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.index)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[numInputPipes + i]);
                                    strcat(outStr, "\n");
                                    outputPipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }
                        if (rawData.type == APRSText::TYPE)
                        {
                            // this is an APRSText message
                            APRSText outData;
                            mOut.decode(&outData);
                            // locate the proper pipe and send data
                            for (int i = numInputPipes; i < numTotalPipes; i++)
                            {
                                if (pipeDemuxIds[i] == rawData.index)
                                {
                                    memset(outStr, 0, sizeof(outStr));
                                    outData.toJSON(outStr, sizeof(outStr), pipeDemuxIds[i]);
                                    strcat(outStr, "\n");
                                    outputPipes[i]->write(outStr, strlen(outStr));
                                }
                            }
                        }

                        // reset
                        m.clear();
                        headerFound = false;
                        msgType = 0;
                        msgIndex = 0;
                        msgSize = 0;
                    }
                }

                std::cout << "Found: " << headerFound << std::endl;
                std::cout << "Handled " << dataHandled << " out of " << x << std::endl;

                // for (int i = 0; i < numInputPipes; i++)
                // {
                //     // check to see if we received a command from the GUI
                //     memset(inStr, 0, sizeof(inStr));
                //     if (inputPipes[i]->read(inStr, sizeof(inStr)))
                //     {
                //         // assume APRSCmd for now
                //         // encode the APRSCmd from the JSON
                //         APRSCmd inData;
                //         char streamName[100];
                //         inData.fromJSON(inStr, strlen(inStr), streamName);
                //         mIn.clear();
                //         mIn.encode(&inData);
                //         // take the APRSCmd and place it in a GSData object for multiplexing
                //         GSData inDataGS(APRSCmd::TYPE, i, mIn.buf, mIn.size);
                //         mIn.clear();
                //         mIn.encode(&inDataGS);
                //         // write the new message formatted for multiplexing
                //         device->writeSerialPort(mIn.buf, mIn.size);
                //     }
                // }
            }
        }
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
        device->closeSerial();

    if (inputPipes != nullptr)
    {
        for (int i = 0; i < numInputPipes; i++)
        {
            delete inputPipes[i];
        }
        delete[] inputPipes;
    }
    if (outputPipes != nullptr)
    {
        for (int i = 0; i < numOutputPipes; i++)
        {
            delete outputPipes[i];
        }
        delete[] outputPipes;
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
#ifdef WINDOWS
    char pipePath[60] = "\\\\.\\pipe\\";
    // char pipePath[60] = "";
    strcat(pipePath, name);
    arr[index++] = new WinNamedPipe(pipePath, true);
#elif LINUX
    char pipePath[60] = "./build/serial/pipes/";
    // char pipePath[60] = "";
    strcat(pipePath, name);
    // THESE PATHS MIGHT BE WRONG!
    arr[index++] = new LinuxNamedPipe(pipePath, true);
#endif
}