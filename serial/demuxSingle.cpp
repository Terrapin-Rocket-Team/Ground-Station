#include "SerialPort.hpp"
#include <string>
#include <iostream>
#include <fstream>

char portPrefix[] = "\\\\.\\";

//g++ demuxSingle.cpp SerialPort.cpp -lgdi32 -o main.exe

byte data[MAX_DATA_LENGTH];
HANDLE hPipe1;
HANDLE hPipe2;
HANDLE hPipe3;
HANDLE hPipeIn;
DWORD dwWritten;
DWORD dwRead;

int main(int argc, char **argv) {

    // create a file in binary mode for debug writing
    std::ofstream debugFile("debug.log", std::ios::binary);

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
    byte chunkIn[10];

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
        // debugFile.write((char *)data, x);


        // implement demuxer on data
        dataidx = 0;  // index of the next byte to read from data (so we don't need to always resize it)

        // repeat until we have processed all data
        while (dataidx < x)
        {

            // get destination
            if (source == 0) {

                if (data[dataidx] == 0x01) source = 1;
                else if (data[dataidx] == 0x02) source = 2;
                else if (data[dataidx] == 0xfe) source = 3;
                else {
                    std::cout << "Invalid source: " << data[dataidx] << std::endl;
                }

                dataidx++;
            }

            // read the single byte
            if (source != 0 && dataidx < x) {


                if (source == 1) {
                    WriteFile(hPipe1, data + dataidx, 1, &dwWritten, NULL);
                }
                else if (source == 2)
                    WriteFile(hPipe2, data + dataidx, 1, &dwWritten, NULL);
                else if (source == 3) {
                    WriteFile(hPipe3, data + dataidx, 1, &dwWritten, NULL);
                    // std::cout << data[dataidx] << " ";
                }

                dataidx++;
                source = 0;
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
