#include "SerialPort.hpp"
#include <string>

#define CHUNK_SIZE 100

char portPrefix[] = "\\\\.\\";

//g++ demuxSimple.cpp SerialPort.cpp -lgdi32 -o main.exe

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

            if (source == 0) {
                if (data[dataidx] == 0x01) source = 1;
                else if (data[dataidx] == 0x02) source = 2;
                else if (data[dataidx] == 0xfe) source = 3;

                dataidx++;

                // get packetsize
                packetSize = data[dataidx] * 256 + data[dataidx + 1];
                dataidx += 2;
                packetidx = 0;
            }
            else
                std::cout << "ERROR WITH SOURCE HEADER" << std::endl;

            if (source == 1) {
                while (dataidx < x && packetidx < packetSize)
                {
                    chunks1[chunks1top] = data[dataidx];
                    dataidx++;
                    packetidx++;
                }

                if (chunks1top > CHUNK_SIZE) {
                    //dump it now
                    WriteFile(hPipe1, chunks1, chunks1top, &dwWritten, NULL);
                    chunks1top = 0;
                }

                // reset for next packet
                if (packetidx >= packetSize) {
                    packetidx = 0;
                    packetSize = 0;
                    source = 0;
                }
            }
        }
    }
    std::cout << totalCount << std::endl;
    CloseHandle(hPipe1);
    CloseHandle(hPipe2);
    CloseHandle(hPipe3);
    CloseHandle(hPipeIn);
	return 0;
}
