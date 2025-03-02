//
// Created by ramykaddouri on 10/11/24.
//

#include "LinuxNamedPipe.h"

#include <iostream>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <poll.h>

LinuxNamedPipe::LinuxNamedPipe(const char *name, bool create) : NamedPipe(name)
{

    sockaddr_un addr;
    if (strlen(name) > sizeof(addr.sun_path) - 2)
    {
        std::cerr << "Server socket path too long:" << name << std::endl;

        return;
    }
    memset(&addr, 0, sizeof(sockaddr_un));
    addr.sun_family = PF_UNIX;
    // Use for abstract sockets
    // addr.sun_path[0] = 0; // always abstract socket
    // strncpy(addr.sun_path + 1, name, strlen(name));
    // Use for regular sockets
    strncpy(addr.sun_path, name, sizeof(addr.sun_path) - 2);

    if (create)
    {
        // not needed for abstract sockets
        remove(addr.sun_path);
        if ((sockFd = socket(PF_UNIX, SOCK_STREAM, 0)) < 0)
        {
            std::cerr << "Error creating named pipe: " << name << std::endl;
            std::cerr << "This is most likely because the pipe already exists. If so, ignore this error." << std::endl;
        }
        setsockopt(sockFd, SOL_SOCKET, SO_SNDTIMEO, 0, 1);

        if ((bind(sockFd, (sockaddr *)&addr, sizeof(addr.sun_family) + strlen(name) + 1) < 0))
        {
            std::cerr << "Error binding socket to path: " << std::endl;
            perror("bind");
        }
        if (listen(sockFd, 1) < 0)
        {
            std::cerr << "Error listening on socket: " << std::endl;
            perror("listen");
        }
    }
    else
    {
        if (connect(sockFd, (sockaddr *)&addr, sizeof(sockaddr_un)) < 0)
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
    if (handle == -1)
    {
        pollfd fds = {
            .fd = sockFd,
            .events = POLLIN,
        };
        poll(&fds, 1, 0);
        if (fds.revents & POLLIN){}
            handle = accept4(sockFd, NULL, NULL, SOCK_NONBLOCK);
    }
    if (handle != -1 && (bytesRead = ::read(handle, buffer, bufferSize)) < 0)
    {
        // std::cout << "Error reading from named pipe at " << path << std::endl;
        // perror("read");
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
    if (handle == -1)
    {
        pollfd fds = {
            .fd = sockFd,
            .events = POLLIN,
        };
        poll(&fds, 1, 0);
        if (fds.revents & POLLIN)
            handle = accept(sockFd, NULL, NULL);
    }
    if (handle != -1 && (bytesWritten = ::write(handle, buffer, bufferSize)) < 0)
    {
        std::cout << "Error writing to named pipe at " << path << std::endl;
    }

    return bytesWritten;
}
