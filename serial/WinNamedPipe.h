//
// Created by ramykaddouri on 10/13/24.
//

#ifndef WINNAMEDPIPE_H
#define WINNAMEDPIPE_H

#include <NamedPipe.h>
#include <windows.h>


class WinNamedPipe : public NamedPipe {
private:
    HANDLE hPipe;
public:
    WinNamedPipe(const char *name, bool create);
    ~WinNamedPipe() override;

    int read(void *buffer, int bufferSize) override;
    int write(const void *buffer, int bufferSize) override;
};

#endif //WINNAMEDPIPE_H
