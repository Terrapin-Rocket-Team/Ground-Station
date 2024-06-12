#include "SerialPort.hpp"

char port[] = "\\\\.\\COM8";

//g++ um2.cpp SerialPort.cpp -lgdi32 -o main.exe

char output[MAX_DATA_LENGTH];
HANDLE hPipe;
DWORD dwWritten;

int main(int argc, char **argv) {

	SerialPort teensy(port);
	if(teensy.isConnected()){
		std::cout<<"Connection made"<<std::endl<<std::endl;
	}
	else{
		std::cout<<"Error in port name"<<std::endl<<std::endl;
	}

    hPipe = CreateNamedPipe(TEXT("\\\\.\\pipe\\myPipe"),
                            PIPE_ACCESS_OUTBOUND,
                            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                            1,              // Max instances
                            1024 * 16,           // Out buffer size
                            1024 * 16,           // In buffer size
                            NMPWAIT_USE_DEFAULT_WAIT,
                            NULL);

    if (hPipe == INVALID_HANDLE_VALUE) {
        std::cerr << "Error creating named pipe.\n";
        return 1;
    }

    std::cout << "Named pipe created successfully.\n";

    size_t x;

	while (teensy.isConnected()) {

		x = teensy.readSerialPort(output, MAX_DATA_LENGTH);
        // Sleep(500);
        std::cout << x << std::endl;
        WriteFile(hPipe, output, MAX_DATA_LENGTH, &dwWritten, NULL);
	}
    CloseHandle(hPipe);
	return 0;
}
