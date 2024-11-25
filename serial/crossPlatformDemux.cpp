//
// Created by ramykaddouri on 10/19/24.
//

#ifdef WINDOWS
#include <WinSerialPort.h>
#include <WinNamedPipe.h>
#elif LINUX
#include <LinuxNamedPipe.h>
#include <LinuxSerialPort.h>
#endif
#include <cstring>
#include <iostream>
#include <ostream>

int main(int argc, char **argv)
{
    std::cout << "Hello from demux!" << std::endl;
    unsigned char data[MAX_DATA_LENGTH] = {'\0'};
    NamedPipe *hPipeIn;
    NamedPipe *hPipe1;
    NamedPipe *hPipe2;
    NamedPipe *hPipe3;

#ifdef WINDOWS
    hPipeIn = new WinNamedPipe("..\\serial\\pipes\\terpFcCommands", true);
    hPipe1 = new WinNamedPipe("..\\serial\\pipes\\ffmpegVideoOne", true);
    hPipe2 = new WinNamedPipe("..\\serial\\pipes\\ffmpegVideoTwo", true);
    hPipe3 = new WinNamedPipe("..\\serial\\pipes\\terpTelemetry", true);
#elif LINUX
    hPipeIn = new LinuxNamedPipe("./build/serial/pipes/terpFcCommands", true);
    hPipe1 = new LinuxNamedPipe("./build/serial/pipes/ffmpegVideoOne", true);
    hPipe2 = new LinuxNamedPipe("./build/serial/pipes/ffmpegVideoTwo", true);
    hPipe3 = new LinuxNamedPipe("./build/serial/pipes/terpTelemetry", true);
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

    bool receivedPort = false;
    char portBuf[1024] = {'\0'};

    while (!receivedPort)
    {
        // std::cout << "Awaiting port...\n";
        memset(portBuf, '\0', sizeof(portBuf));
        int pipeInRead = hPipeIn->read(portBuf, sizeof(portBuf));
        std::cout << "pipeInRead = " << pipeInRead << std::endl;
        if (pipeInRead > 0)
        {
            portBuf[sizeof(portBuf) - 1] = '\0';
            std::cout << "Received port: " << portBuf << std::endl;
            receivedPort = true;
        }
    }

    SerialPort *teensy;

#ifdef WINDOWS
    teensy = new WinSerialPort(portBuf);
#elif LINUX
    teensy = new LinuxSerialPort(portBuf);
#endif

    time_t start = time(NULL);
    bool timeout = false;
    while(!timeout && !(teensy->isConnected())) {
        time_t end = time(NULL);
        if(difftime(end, start) > 2) {
            timeout = true;
        }
    }

    if (teensy->isConnected())
    {
        std::cout << "Connection made" << std::endl
                  << std::endl;
    }
    else
    {
        std::cout << "Error in port name" << std::endl
                  << std::endl;
    }

    while (teensy->isConnected())
    {
        std::cout << "Before reading from serial" << std::endl;
        x = teensy->readSerialPort(data, MAX_DATA_LENGTH);
        // Sleep(500);
        // std::cout << data;
        // !WriteFile(hPipe1, data, MAX_DATA_LENGTH, &dwWritten, NULL);

        // implement demuxer on data
        dataidx = 0; // index of the next byte to read from data (so we don't need
        // to always resize it)
        char strData[MAX_DATA_LENGTH+1] = {'\0'};
        memcpy(strData, data, MAX_DATA_LENGTH);

        std::cout << "Bytes Read From Serial: " << x << std::endl;

        // repeat until we have processed all data
        while (dataidx < x)
        {
            // we need to check if the data is either video or telemetry
            if (source == 0)
            {
                std::cout << "source == 0 at " << totalCount << std::endl;
                // std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
                //           << " | ";
                if (data[dataidx] == 0x01)
                    source = 1;
                else if (data[dataidx] == 0x02)
                    source = 2;
                else if (data[dataidx] == 0xfe)
                    source = 3;

                dataidx++;
                totalCount++;
                packetSize = 0;
            }

            // we need to find packetsize
            if (packetSize == 0 && packetSizeFound == false && dataidx < x &&
                source != 0)
            {
                // std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
                //           << " | ";
                packetSize = data[dataidx] * 256;
                packetSizeFound = false;
                dataidx++;
                totalCount++;
            }
            // find the second byte of the packetsize
            if (packetSizeFound == false && dataidx < x && source != 0)
            {
                // std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
                //           << " | ";
                packetSize += data[dataidx];
                packetSizeFound = true;
                packetidx = 0;
                dataidx++;
                totalCount++;
            }

            if (source == 1 && packetSizeFound)
            {
                // copy data to the circular buffer
                while (dataidx < x && packetidx < packetSize)
                {
                    // std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
                    //           << " | ";
                    chunks1[chunks1top] = data[dataidx];
                    chunks1top = (chunks1top + 1) % maxChunkSize;
                    packetidx++;
                    dataidx++;
                    totalCount++;
                }

                // if we have a full packet, emit it
                if (packetidx == packetSize)
                {
                    std::cout << "packetidx1 == packetSize1" << std::endl;

                    // write from bottom to end of buffer or bottom to top of buffer
                    if (chunks1top > chunks1bot)
                    {
                        hPipe1->write(chunks1 + chunks1bot, chunks1top - chunks1bot);

                        // update bottom index
                        chunks1bot = chunks1top;
                    }
                    else
                    {
                        hPipe1->write(chunks1 + chunks1bot, maxChunkSize - chunks1bot);
                        chunks1bot = 0;
                        hPipe1->write(chunks1 + chunks1bot, chunks1top - chunks1bot);

                        // update bottom index
                        chunks1bot = chunks1top;
                    }

                    source = 0;
                    packetSize = 0;
                    packetSizeFound = false;
                    packetidx = 0;
                }
            }
            else if (source == 2 && packetSizeFound)
            {
                // copy data to the circular buffer
                while (dataidx < x && packetidx < packetSize)
                {
                    // std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
                    //           << " | ";
                    chunks2[chunks2top] = data[dataidx];
                    chunks2top = (chunks2top + 1) % maxChunkSize;
                    packetidx++;
                    dataidx++;
                    totalCount++;
                }

                // if we have a full packet, emit it
                if (packetidx == packetSize)
                {
                    // std::cout << "packetidx2 == packetSize2" << std::endl;

                    // write from bottom to end of buffer or bottom to top of buffer
                    if (chunks2top > chunks2bot)
                    {
                        hPipe2->write(chunks2 + chunks2bot, chunks2top - chunks2bot);

                        // update bottom index
                        chunks2bot = chunks2top;
                    }
                    else
                    {
                        hPipe2->write(chunks2 + chunks2bot, maxChunkSize - chunks2bot);
                        chunks2bot = 0;
                        hPipe2->write(chunks2 + chunks2bot, chunks2top - chunks2bot);

                        // update bottom index
                        chunks2bot = chunks2top;
                    }

                    source = 0;
                    packetSize = 0;
                    packetSizeFound = false;
                    packetidx = 0;
                }
            }
            else if (source == 3 && packetSizeFound)
            {
                // std::cout << "packetidx3 == packetSize3" << std::endl;

                // copy data to the start of the telemetry buffer
                while (dataidx < x && packetidx < packetSize)
                {
                    std::cout << totalCount << ":" << std::hex << (int)data[dataidx]
                              << " | ";
                    chunks3[chunks3top] = data[dataidx];
                    chunks3top = (chunks3top + 1) % maxChunkSize;
                    packetidx++;
                    dataidx++;
                    totalCount++;
                }

                // if we have a full packet, emit it
                if (packetidx == packetSize)
                {
                    // write from bottom to end of buffer or bottom to top of buffer
                    if (chunks3top > chunks3bot)
                    {
                        hPipe3->write(chunks3 + chunks3bot, chunks3top - chunks3bot);

                        // update bottom index
                        chunks3bot = chunks3top;
                    }
                    else
                    {
                        hPipe3->write(chunks3 + chunks3bot, maxChunkSize - chunks3bot);
                        chunks3bot = 0;
                        hPipe3->write(chunks3 + chunks3bot, chunks3top - chunks3bot);

                        // update bottom index
                        chunks3bot = chunks3top;
                    }

                    source = 0;
                    packetSize = 0;
                    packetSizeFound = false;
                    packetidx = 0;
                }
            }
        }

        // check to see if we received a command from the GUI
        if (hPipeIn->read(chunkIn, 7) > 0)
        {
            teensy->writeSerialPort(chunkIn, 7);
        }
    }
    std::cout << totalCount << std::endl;

    teensy->closeSerial();
    delete hPipeIn;
    delete hPipe1;
    delete hPipe2;
    delete hPipe3;

    return 0;
}
