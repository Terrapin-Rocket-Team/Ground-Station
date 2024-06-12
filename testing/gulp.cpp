#include "SerialPort.hpp"

char port[] = "\\\\.\\COM8";

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
                            PIPE_ACCESS_DUPLEX,
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


	while (true) {

        Sleep(500);
        BOOL result = WriteFile(hPipe,
                  "Hello Pipe\n",
                  12,   // = length of string + terminating '\0' !!!
                  &dwWritten,
                  NULL);
        std::cout << "Written: " << dwWritten << std::endl;
        // if (!result) {
        //     std::cerr << "Error writing to named pipe.\n";
        //     break;
        // }
	}
    CloseHandle(hPipe);
	return 0;
}
