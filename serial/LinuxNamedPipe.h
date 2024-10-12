//
// Created by ramykaddouri on 10/11/24.
//

#ifndef LINUXNAMEDPIPE_H
#define LINUXNAMEDPIPE_H
#include <NamedPipe.h>


class LinuxNamedPipe : public NamedPipe {
private:

public:
    ~LinuxNamedPipe() {

    }
    int read(char *buffer, int bufferSize) override;
    int write(const char *buffer, int bufferSize) override;
};



#endif //LINUXNAMEDPIPE_H
