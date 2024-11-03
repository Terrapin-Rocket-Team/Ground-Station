//
// Created by ramykaddouri on 10/13/24.
//

#include "WinNamedPipe.h"

#include <iostream>
#include <ostream>

WinNamedPipe::WinNamedPipe(const char *name, bool create) : NamedPipe(name)
{
    if (create)
    {
        hPipe = CreateNamedPipe(TEXT(name), PIPE_ACCESS_DUPLEX,
                                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT, 1,
                                1024 * 16, 1024 * 16, NMPWAIT_USE_DEFAULT_WAIT, NULL);
    }
    else
    {
        hPipe = CreateFile(
            name,          // pipe name
            GENERIC_READ | // read and write access
                GENERIC_WRITE,
            0,             // no sharing
            NULL,          // default security attributes
            OPEN_EXISTING, // opens existing pipe
            0,             // default attributes
            NULL);         // no template file
    }

    if (hPipe == INVALID_HANDLE_VALUE)
    {
        std::cerr << "Creating Named Pipe failed!" << std::endl;
    }
}

int WinNamedPipe::readStr(char *buffer, int bufferSize)
{
    unsigned long int read = 1;
    unsigned int count = 0;
    while (count < bufferSize && read > 0)
    {
        read = 0;
        ReadFile(hPipe, buffer + count, 1, &read, NULL);
        if (buffer[count] == '\n')
        {
            buffer[count] = '\0';
            break;
        }
        count += read;
    }
    return count;
}

int WinNamedPipe::writeStr(const char *buffer)
{
    unsigned long int written = 0;
    WriteFile(hPipe, buffer, strlen(buffer), &written, NULL);
    return written;
}

int WinNamedPipe::read(void *buffer, int bufferSize)
{
    unsigned long int read = 0;
    ReadFile(hPipe, buffer, bufferSize, &read, NULL);
    return read;
}

int WinNamedPipe::write(const void *buffer, int bufferSize)
{
    unsigned long int written = 0;
    WriteFile(hPipe, buffer, bufferSize, &written, NULL);
    return written;
}

WinNamedPipe::~WinNamedPipe()
{
    if (hPipe != NULL)
    {
        FlushFileBuffers(hPipe);
        // DisconnectNamedPipe(hPipe);
        CloseHandle(hPipe);
    }
}
