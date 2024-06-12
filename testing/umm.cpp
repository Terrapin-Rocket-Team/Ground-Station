#include <windows.h>   // For Windows API functions
#include <iostream>    // For standard I/O
#include <string>      // For working with strings
#include <fstream>     // For file I/O
#include <sstream>     // For string stream operations
#include <vector>      // For working with vectors
#include <stdexcept>   // For exceptions
#include <chrono>      // For time-related functions
#include <thread>      // For multi-threading support

int main() {
    HANDLE hSerial;
    DCB dcbSerialParams = {0};
    COMMTIMEOUTS timeouts = {0};
    DWORD dwBytesRead = 0;
    char readBuffer[256] = {0};

    HANDLE hPipe;
    DWORD dwWritten;

    hSerial = CreateFileA("\\\\.\\COM8", GENERIC_READ, 0, NULL, OPEN_EXISTING, 0, NULL);
    if (hSerial == INVALID_HANDLE_VALUE) {
        std::cerr << "Error opening serial port.\n";
        return 1;
    }

    hPipe = CreateNamedPipe(TEXT("\\\\.\\pipe\\myPipe"),
                            PIPE_ACCESS_OUTBOUND,
                            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                            1,              // Max instances
                            1024,           // Out buffer size
                            1024,           // In buffer size
                            NMPWAIT_USE_DEFAULT_WAIT,
                            NULL);

    if (hPipe == INVALID_HANDLE_VALUE) {
        std::cerr << "Error creating named pipe.\n";
        return 1;
    }

    std::cout << "Named pipe created successfully.\n";

    dcbSerialParams.DCBlength = sizeof(dcbSerialParams);
    if (!GetCommState(hSerial, &dcbSerialParams)) {
        std::cerr << "Error getting serial port state.\n";
        CloseHandle(hSerial);
        CloseHandle(hPipe);
        return 1;
    }

    dcbSerialParams.BaudRate = CBR_9600;  // Set the baud rate
    dcbSerialParams.ByteSize = 8;         // 8 data bits
    dcbSerialParams.StopBits = ONESTOPBIT; // 1 stop bit
    dcbSerialParams.Parity   = NOPARITY;   // No parity

    if (!SetCommState(hSerial, &dcbSerialParams)) {
        std::cerr << "Error setting serial port state.\n";
        CloseHandle(hSerial);
        CloseHandle(hPipe);
        return 1;
    }

    timeouts.ReadIntervalTimeout         = 50;
    timeouts.ReadTotalTimeoutConstant    = 50;
    timeouts.ReadTotalTimeoutMultiplier  = 10;
    timeouts.WriteTotalTimeoutConstant   = 50;
    timeouts.WriteTotalTimeoutMultiplier = 10;
    if (!SetCommTimeouts(hSerial, &timeouts)) {
        std::cerr << "Error setting serial port timeouts.\n";
        CloseHandle(hSerial);
        CloseHandle(hPipe);
        return 1;
    }

    while (true) {
        BOOL fsuccess = ReadFile(hSerial, readBuffer, sizeof(readBuffer), &dwBytesRead, NULL);
        if (!fsuccess) {
            std::cout << "Error reading from serial port.\n" << GetLastError() << std::endl;
            break;
        }
        else {
            std::cout << "Received " << dwBytesRead << " bytes: " << readBuffer << std::endl;
        }
        if (dwBytesRead > 0) {
            std::cout << "Receiveds " << dwBytesRead << " bytes: " << readBuffer << std::endl;

            // Write the received data to the named pipe
            if (!WriteFile(hPipe, readBuffer, dwBytesRead, &dwWritten, NULL)) {
                std::cerr << "Error writing to named pipe.\n";
                break;
            }
        }
        // Clear the buffer for the next read
        // memset(readBuffer, 0, sizeof(readBuffer));
    }

    CloseHandle(hSerial);
    CloseHandle(hPipe);
    return 0;
}