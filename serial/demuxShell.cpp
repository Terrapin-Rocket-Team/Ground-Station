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
#endif
#include <cstring>
#include <iostream>
#include <ostream>
#include <cstdint>

int main(int argc, char **argv)
{
    unsigned char data[MAX_DATA_LENGTH];
    NamedPipe *pipeControl;
    NamedPipe *pipeStatus;
    NamedPipe **dataPipes = nullptr;
    uint8_t *pipeIndexes = nullptr;
    int numPipes = 0;

#ifdef WINDOWS
    pipeControl = new WinNamedPipe("\\\\.\\pipe\\control", true);
    pipeStatus = new WinNamedPipe("\\\\.\\pipe\\status", true);
#elif LINUX
    // THESE PATHS MIGHT BE WRONG!
    pipeControl = new LinuxNamedPipe("./pipe/control", true);
    pipeStatus = new LinuxNamedPipe("./pipe/status", true);
#endif

    size_t x;
    size_t dataidx;
    size_t totalCount = 0;
    size_t source = 0;
    size_t packetSize = 0;
    size_t packetidx = 0;
    bool packetSizeFound = false;
    size_t maxChunkSize = 1024 * 16;
    char chunks1[maxChunkSize];
    char chunks2[maxChunkSize];
    char chunks3[maxChunkSize];
    char chunkIn[7];

    size_t chunks1top = 0;
    size_t chunks2top = 0;
    size_t chunks3top = 0;
    size_t chunks1bot = 0;
    size_t chunks2bot = 0;
    size_t chunks3bot = 0;

    SerialPort *teensy = nullptr;

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
                // close the serial connection
                if (teensy != nullptr)
                {
                    delete teensy;
                    teensy = nullptr;
                }
            }
            if (strcmp(controlStr, "reset") == 0)
            {

                if (teensy != nullptr)
                {
                    delete teensy;
                    teensy = nullptr;
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
                teensy = new WinSerialPort(portBuf);
#elif LINUX
                teensy = new LinuxSerialPort(strcat("./", portBuf));
#endif

                // attempt to connect
                time_t start = time(0);
                bool timeout = false;
                while (!timeout && !(teensy->isConnected()))
                {
                    time_t end = time(0);
                    if (difftime(end, start) > 1)
                        timeout = true;
                }
            }
            if (strcmp(controlStr, "data pipes") == 0)
            {
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

                if (dataPipes != nullptr)
                {
                    for (int i = 0; i < numPipes; i++)
                    {
                        delete dataPipes[i];
                    }
                    delete[] dataPipes;
                    dataPipes = nullptr;
                }
                if (pipeIndexes != nullptr)
                {
                    delete[] pipeIndexes;
                    pipeIndexes = nullptr;
                }
                numPipes = atoi(numPipesStr);
                if (numPipes > 0)
                {
                    dataPipes = new NamedPipe *[numPipes];
                    pipeIndexes = new uint8_t[numPipes];

                    int gotPipeNames = 0;
                    char pipeName[50] = {0};
                    while (gotPipeNames < numPipes)
                    {
                        memset(pipeName, 0, sizeof(pipeName));
                        if (pipeControl->readStr(pipeName, sizeof(pipeName)) > 0)
                        {
                            pipeName[sizeof(pipeName) - 1] = '\0';
                            int indexPos = 0;
                            for (int i = 0; i < strlen(pipeName); i++)
                            {
                                if (pipeName[i] == ' ')
                                    indexPos = i;
                            }

                            int pipeIndex = atoi(pipeName + indexPos + 1);
                            pipeIndexes[gotNumPipes] = pipeIndex;

                            pipeName[indexPos] = '\0';
                            std::cout << "Creating pipe of name: " << pipeName << std::endl;
#ifdef WINDOWS
                            char pipePath[60] = "\\\\.\\pipe\\";
                            strcat(pipePath, pipeName);
                            dataPipes[gotPipeNames++] = new WinNamedPipe(pipePath, true);
#elif LINUX
                            char pipePath[60] = "./pipe/";
                            strcat(pipePath, pipeName);
                            // THESE PATHS MIGHT BE WRONG!
                            dataPipes[gotPipeNames++] = new LinuxNamedPipe(pipePath, true);
#endif
                        }
                    }
                }

                pipeStatus->writeStr("pipe creation successful");
            }
            if (strcmp(controlStr, "connected") == 0)
            {
                if ((teensy != nullptr && teensy->isConnected()) || true)
                {
                    pipeStatus->writeStr("connected");
                }
                else
                {
                    pipeStatus->writeStr("not connected");
                }
            }
            if (strcmp(controlStr, "exit") == 0)
            {
                std::cout << "exiting" << std::endl;
                exit = true;
            }
        }
    }

    //     while (teensy->isConnected())
    //     {
    //         x = teensy->readSerialPort(data, MAX_DATA_LENGTH);
    //         // Sleep(500);
    //         // std::cout << data;
    //         // !WriteFile(hPipe1, data, MAX_DATA_LENGTH, &dwWritten, NULL);

    //         // implement demuxer on data
    //         dataidx = 0; // index of the next byte to read from data (so we don't need
    //         // to always resize it)

    //         // repeat until we have processed all data
    //         while (dataidx < x)
    //         {
    //             // we need to check if the data is either video or telemetry
    //             if (source == 0)
    //             {
    //                 std::cout << "source == 0 at " << totalCount << std::endl;
    //                 std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
    //                           << " | ";
    //                 if (data[dataidx] == 0x01)
    //                     source = 1;
    //                 else if (data[dataidx] == 0x02)
    //                     source = 2;
    //                 else if (data[dataidx] == 0xfe)
    //                     source = 3;

    //                 dataidx++;
    //                 totalCount++;
    //                 packetSize = 0;
    //             }

    //             // we need to find packetsize
    //             if (packetSize == 0 && packetSizeFound == false && dataidx < x &&
    //                 source != 0)
    //             {
    //                 std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
    //                           << " | ";
    //                 packetSize = data[dataidx] * 256;
    //                 packetSizeFound = false;
    //                 dataidx++;
    //                 totalCount++;
    //             }
    //             // find the second byte of the packetsize
    //             if (packetSizeFound == false && dataidx < x && source != 0)
    //             {
    //                 std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
    //                           << " | ";
    //                 packetSize += data[dataidx];
    //                 packetSizeFound = true;
    //                 packetidx = 0;
    //                 dataidx++;
    //                 totalCount++;
    //             }

    //             if (source == 1 && packetSizeFound)
    //             {
    //                 // copy data to the circular buffer
    //                 while (dataidx < x && packetidx < packetSize)
    //                 {
    //                     std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
    //                               << " | ";
    //                     chunks1[chunks1top] = data[dataidx];
    //                     chunks1top = (chunks1top + 1) % maxChunkSize;
    //                     packetidx++;
    //                     dataidx++;
    //                     totalCount++;
    //                 }

    //                 // if we have a full packet, emit it
    //                 if (packetidx == packetSize)
    //                 {
    //                     std::cout << "packetidx1 == packetSize1" << std::endl;

    //                     // write from bottom to end of buffer or bottom to top of buffer
    //                     if (chunks1top > chunks1bot)
    //                     {
    //                         hPipe1->write(chunks1 + chunks1bot, chunks1top - chunks1bot);

    //                         // update bottom index
    //                         chunks1bot = chunks1top;
    //                     }
    //                     else
    //                     {
    //                         hPipe1->write(chunks1 + chunks1bot, maxChunkSize - chunks1bot);
    //                         chunks1bot = 0;
    //                         hPipe1->write(chunks1 + chunks1bot, chunks1top - chunks1bot);

    //                         // update bottom index
    //                         chunks1bot = chunks1top;
    //                     }

    //                     source = 0;
    //                     packetSize = 0;
    //                     packetSizeFound = false;
    //                     packetidx = 0;
    //                 }
    //             }
    //             else if (source == 2 && packetSizeFound)
    //             {
    //                 // copy data to the circular buffer
    //                 while (dataidx < x && packetidx < packetSize)
    //                 {
    //                     std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
    //                               << " | ";
    //                     chunks2[chunks2top] = data[dataidx];
    //                     chunks2top = (chunks2top + 1) % maxChunkSize;
    //                     packetidx++;
    //                     dataidx++;
    //                     totalCount++;
    //                 }

    //                 // if we have a full packet, emit it
    //                 if (packetidx == packetSize)
    //                 {
    //                     // std::cout << "packetidx2 == packetSize2" << std::endl;

    //                     // write from bottom to end of buffer or bottom to top of buffer
    //                     if (chunks2top > chunks2bot)
    //                     {
    //                         hPipe2->write(chunks2 + chunks2bot, chunks2top - chunks2bot);

    //                         // update bottom index
    //                         chunks2bot = chunks2top;
    //                     }
    //                     else
    //                     {
    //                         hPipe2->write(chunks2 + chunks2bot, maxChunkSize - chunks2bot);
    //                         chunks2bot = 0;
    //                         hPipe2->write(chunks2 + chunks2bot, chunks2top - chunks2bot);

    //                         // update bottom index
    //                         chunks2bot = chunks2top;
    //                     }

    //                     source = 0;
    //                     packetSize = 0;
    //                     packetSizeFound = false;
    //                     packetidx = 0;
    //                 }
    //             }
    //             else if (source == 3 && packetSizeFound)
    //             {
    //                 // std::cout << "packetidx3 == packetSize3" << std::endl;

    //                 // copy data to the start of the telemetry buffer
    //                 while (dataidx < x && packetidx < packetSize)
    //                 {
    //                     std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
    //                               << " | ";
    //                     chunks3[chunks3top] = data[dataidx];
    //                     chunks3top = (chunks3top + 1) % maxChunkSize;
    //                     packetidx++;
    //                     dataidx++;
    //                     totalCount++;
    //                 }

    //                 // if we have a full packet, emit it
    //                 if (packetidx == packetSize)
    //                 {
    //                     // write from bottom to end of buffer or bottom to top of buffer
    //                     if (chunks3top > chunks3bot)
    //                     {
    //                         hPipe3->write(chunks3 + chunks3bot, chunks3top - chunks3bot);

    //                         // update bottom index
    //                         chunks3bot = chunks3top;
    //                     }
    //                     else
    //                     {
    //                         hPipe3->write(chunks3 + chunks3bot, maxChunkSize - chunks3bot);
    //                         chunks3bot = 0;
    //                         hPipe3->write(chunks3 + chunks3bot, chunks3top - chunks3bot);

    //                         // update bottom index
    //                         chunks3bot = chunks3top;
    //                     }

    //                     source = 0;
    //                     packetSize = 0;
    //                     packetSizeFound = false;
    //                     packetidx = 0;
    //                 }
    //             }
    //         }

    //         // check to see if we received a command from the GUI
    //         if (hPipeIn->read(chunkIn, 7))
    //         {
    //             teensy->writeSerialPort(chunkIn, 7);
    //         }
    //     }
    //     std::cout << totalCount << std::endl;

    //     teensy->closeSerial();
    std::cout << "Exit" << std::endl;
    delete pipeControl;
    delete pipeStatus;

    return 0;
}