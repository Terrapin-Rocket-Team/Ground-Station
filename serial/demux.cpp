#include "SerialPort.hpp"
#include <string>

char portPrefix[] = "\\\\.\\";

//g++ um2.cpp SerialPort.cpp -lgdi32 -o main.exe

byte data[MAX_DATA_LENGTH];
HANDLE hPipe1;
HANDLE hPipe2;
HANDLE hPipe3;
HANDLE hPipeIn;
DWORD dwWritten;
DWORD dwRead;

int main(int argc, char **argv) {

    hPipeIn = CreateNamedPipe(TEXT("\\\\.\\pipe\\terpFcCommands"),
                            PIPE_ACCESS_INBOUND,
                            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                            1,
                            1024 * 16,
                            1024 * 16,
                            NMPWAIT_USE_DEFAULT_WAIT,
                            NULL);

    hPipe1 = CreateNamedPipe(TEXT("\\\\.\\pipe\\ffmpegVideoOne"),
                            PIPE_ACCESS_OUTBOUND,
                            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                            PIPE_UNLIMITED_INSTANCES,              // Max instances
                            1024 * 16,           // Out buffer size
                            1024 * 16,           // In buffer size
                            NMPWAIT_USE_DEFAULT_WAIT,
                            NULL);

    hPipe2 = CreateNamedPipe(TEXT("\\\\.\\pipe\\ffmpegVideoTwo"),
                            PIPE_ACCESS_OUTBOUND,
                            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                            PIPE_UNLIMITED_INSTANCES,              // Max instances
                            1024 * 16,           // Out buffer size
                            1024 * 16,           // In buffer size
                            NMPWAIT_USE_DEFAULT_WAIT,
                            NULL);

    hPipe3 = CreateNamedPipe(TEXT("\\\\.\\pipe\\terpTelemetry"),
                            PIPE_ACCESS_OUTBOUND,
                            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                            PIPE_UNLIMITED_INSTANCES,              // Max instances
                            1024 * 8,           // Out buffer size
                            1024 * 8,           // In buffer size
                            NMPWAIT_USE_DEFAULT_WAIT,
                            NULL);

    if (hPipe1 == INVALID_HANDLE_VALUE || hPipe2 == INVALID_HANDLE_VALUE || hPipe3 == INVALID_HANDLE_VALUE || hPipeIn == INVALID_HANDLE_VALUE) {
        std::cerr << "Error creating named pipes.\n";
        return 1;
    }

    std::cout << "Named pipes created successfully.\n";

    size_t x;
    size_t dataidx;
    size_t totalCount = 0;
    size_t source = 0;
    size_t packetSize = 0;
    size_t packetidx = 0;
    bool packetSizeFound = false;
    size_t maxChunkSize = 1024 * 16;
    byte chunks1[maxChunkSize];
    byte chunks2[maxChunkSize];
    byte chunks3[maxChunkSize];
    byte chunkIn[7];

    size_t chunks1top = 0;
    size_t chunks2top = 0;
    size_t chunks3top = 0;
    size_t chunks1bot = 0;
    size_t chunks2bot = 0;
    size_t chunks3bot = 0;

    bool receivedPort = false;


    char portBuf[1024];

    while (!receivedPort) {
        if (ReadFile(hPipeIn, portBuf, 1024, &dwWritten, NULL)) {
            portBuf[dwWritten] = '\0';
            std::cout << "Received port: " << portBuf << std::endl;
            receivedPort = true;
        }
    }

    SerialPort teensy(strcat(portPrefix, portBuf));
	if(teensy.isConnected()){
		std::cout<<"Connection made"<<std::endl<<std::endl;
	}
	else{
		std::cout<<"Error in port name"<<std::endl<<std::endl;
	}

	while (teensy.isConnected()) {

		x = teensy.readSerialPort(data, MAX_DATA_LENGTH);
        // Sleep(500);
        // std::cout << data;
        // !WriteFile(hPipe1, data, MAX_DATA_LENGTH, &dwWritten, NULL);


        // implement demuxer on data
        dataidx = 0;  // index of the next byte to read from data (so we don't need to always resize it)

        // repeat until we have processed all data
        while (dataidx < x)
        {

            // we need to check if the data is either video or telemetry
            if (source == 0)
            {

                std::cout << "source == 0 at " << totalCount << std::endl;
                std::cout << totalCount << ":"  << std::hex << (int)data[dataidx] << " | ";
                if (data[dataidx] == 0x01) source = 1;
                else if (data[dataidx] == 0x02) source = 2;
                else if (data[dataidx] == 0xfe) source = 3;


                dataidx++;
                totalCount++;
                packetSize = 0;
            }

            // we need to find packetsize
            if (packetSize == 0 && packetSizeFound == false && dataidx < x && source != 0)
            {
                std::cout << totalCount << ":"  << std::hex << (int)data[dataidx] << " | ";
                packetSize = data[dataidx] * 256; 
                packetSizeFound = false;
                dataidx++;
                totalCount++;
            }
            // find the second byte of the packetsize
            if (packetSizeFound == false && dataidx < x && source != 0)
            {
                std::cout << totalCount << ":"  << std::hex << (int)data[dataidx] << " | ";
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
                    std::cout << totalCount << ":"  << std::hex << (int)data[dataidx] << " | ";
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
                        WriteFile(hPipe1, chunks1 + chunks1bot, chunks1top - chunks1bot, &dwWritten, NULL);

                        // update bottom index
                        chunks1bot = chunks1top;
                    }
                    else
                    {
                        WriteFile(hPipe1, chunks1 + chunks1bot, maxChunkSize - chunks1bot, &dwWritten, NULL);
                        chunks1bot = 0;
                        WriteFile(hPipe1, chunks1 + chunks1bot, chunks1top - chunks1bot, &dwWritten, NULL);

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
                    std::cout << totalCount << ":"  << std::hex << (int)data[dataidx] << " | ";
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
                        WriteFile(hPipe2, chunks2 + chunks2bot, chunks2top - chunks2bot, &dwWritten, NULL);

                        // update bottom index
                        chunks2bot = chunks2top;
                    }
                    else
                    {
                        WriteFile(hPipe2, chunks2 + chunks2bot, maxChunkSize - chunks2bot, &dwWritten, NULL);
                        chunks2bot = 0;
                        WriteFile(hPipe2, chunks2 + chunks2bot, chunks2top - chunks2bot, &dwWritten, NULL);

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
                    std::cout << totalCount << ":"  << std::hex << (int)data[dataidx] << " | ";
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
                        WriteFile(hPipe3, chunks3 + chunks3bot, chunks3top - chunks3bot, &dwWritten, NULL);

                        // update bottom index
                        chunks3bot = chunks3top;
                    }
                    else
                    {
                        WriteFile(hPipe3, chunks3 + chunks3bot, maxChunkSize - chunks3bot, &dwWritten, NULL);
                        chunks3bot = 0;
                        WriteFile(hPipe3, chunks3 + chunks3bot, chunks3top - chunks3bot, &dwWritten, NULL);

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
        if (ReadFile(hPipeIn, chunkIn, 7, &dwWritten, NULL)) {
            teensy.writeSerialPort(chunkIn, 7);
        }
    }
    std::cout << totalCount << std::endl;
    CloseHandle(hPipe1);
    CloseHandle(hPipe2);
    CloseHandle(hPipe3);
    CloseHandle(hPipeIn);
	return 0;
}
