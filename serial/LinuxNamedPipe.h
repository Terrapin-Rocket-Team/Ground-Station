//
// Created by ramykaddouri on 10/11/24.
//

#ifndef LINUXNAMEDPIPE_H
#define LINUXNAMEDPIPE_H
#include <NamedPipe.h>

class LinuxNamedPipe : public NamedPipe
{
private:
    int handle;

public:
    LinuxNamedPipe(const char *name, bool create, bool write);
    ~LinuxNamedPipe() override;

    int read(void *buffer, int bufferSize) override;
    int write(const void *buffer, int bufferSize) override;
    int readStr(char *buffer, int bufferSize) override;
    int writeStr(const char *buffer) override;
};

#endif // LINUXNAMEDPIPE_H
