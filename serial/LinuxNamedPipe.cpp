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

LinuxNamedPipe::LinuxNamedPipe(const char* name, bool create) : NamedPipe(name) {
    if(create) {
        if(mkfifo(name, 0666)) {
            std::cerr << "Error creating named pipe: " << name << std::endl;
            std::cerr << "This is most likely because the pipe already exists. If so, ignore this error." << std::endl;
        }
    }

    handle = open(name, O_RDWR);
    if(handle == -1) {
        std::cerr << "Error opening named pipe: " << name << std::endl;
    }
}

LinuxNamedPipe::~LinuxNamedPipe() {
    if(handle != -1)
        close(handle);
}

int LinuxNamedPipe::read(void *buffer, int bufferSize) {
    int bytesRead = 0;
    if((bytesRead = ::read(handle, buffer, bufferSize)) <= 0) {
        std::cout << "Error reading from named pipe at " << path << std::endl;
    }

    return bytesRead;
}

int LinuxNamedPipe::readStr(char *buffer, int bufferSize) {
    return read(buffer, bufferSize);
}

int LinuxNamedPipe::writeStr(const char *buffer) {
    return write(buffer, strlen(buffer));
}

int LinuxNamedPipe::write(const void *buffer, int bufferSize) {
    int bytesWritten = 0;
    if((bytesWritten = ::write(handle, buffer, bufferSize)) <= 0) {
        std::cout << "Error writing to named pipe at " << path << std::endl;
    }

    return bytesWritten;
}
