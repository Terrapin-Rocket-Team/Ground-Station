//
// Created by ramykaddouri on 10/11/24.
//

#include "LinuxNamedPipe.h"

#include <cstring>
#include <fcntl.h>
#include <iostream>
#include <ostream>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/socket.h>

LinuxNamedPipe::LinuxNamedPipe(const char *name, bool create) : NamedPipe(name)
{

    sockaddr_un addr;
    if (strlen(name) > sizeof(addr.sun_path) - 2)
    {
        std::cerr << "Server socket path too long:" << name << std::endl;
        return;
    }
    memset(&addr, 0, sizeof(sockaddr_un));
    addr.sun_family = AF_UNIX;
    addr.sun_path[0] = '\0'; // always abstract socket
    strncpy(addr.sun_path + 1, name, sizeof(addr.sun_path) - 2);

    if (create)
    {

        int fd;
        // if (mkfifo(name, 0666))
        if (fd = socket(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0) < 0)
        {
            std::cerr << "Error creating named pipe: " << name << std::endl;
            std::cerr << "This is most likely because the pipe already exists. If so, ignore this error." << std::endl;
        }

        if (handle = bind(fd, &addr, sizeof(sockaddr_un)) < 0)
        {
            std::cerr << "Error binding socket to path" << std::endl;
        }
    }
    else
    {
        if (handle = connect(fd, &addr, sizeof(sockaddr_un)) < 0)
        {
            std::cerr << "Error connect to socket" << std::endl;
        }
    }
}

LinuxNamedPipe::~LinuxNamedPipe()
{
    if (handle != -1)
        close(handle);
}

int LinuxNamedPipe::read(void *buffer, int bufferSize)
{
    int bytesRead = 0;
    if ((bytesRead = ::read(handle, buffer, bufferSize)) <= 0)
    {
        std::cout << "Error reading from named pipe at " << path << std::endl;
    }

    return bytesRead;
}

int LinuxNamedPipe::readStr(char *buffer, int bufferSize)
{
    int bytesRead = 1;
    int count = 0;
    while (count < bufferSize && bytesRead > 0)
    {
        bytesRead = 0;
        bytesRead = read(buffer + count, 1);
        if (buffer[count] == '\n')
        {
            buffer[count] = '\0';
            break;
        }
        count += bytesRead;
    }
    return count;
}

int LinuxNamedPipe::writeStr(const char *buffer)
{
    return write(buffer, strlen(buffer));
}

int LinuxNamedPipe::write(const void *buffer, int bufferSize)
{
    int bytesWritten = 0;
    if ((bytesWritten = ::write(handle, buffer, bufferSize)) <= 0)
    {
        std::cout << "Error writing to named pipe at " << path << std::endl;
    }

    return bytesWritten;
}
