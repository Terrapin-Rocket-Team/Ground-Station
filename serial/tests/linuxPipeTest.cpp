//
// Created by ramykaddouri on 10/12/24.
//

#include <iostream>
#include <LinuxNamedPipe.h>
#include <ostream>

int main() {
    std::string pipePath = "testing_pipe";
    LinuxNamedPipe outLinPipe = LinuxNamedPipe(pipePath.c_str(), true);
    LinuxNamedPipe inLinPipe = LinuxNamedPipe(pipePath.c_str(), false);

    NamedPipe* outPipe = &outLinPipe;
    NamedPipe* inPipe = &inLinPipe;

    const char outMessage[128] = "Hello World!";
    outPipe->write(outMessage, sizeof(outMessage));
    std::cout << "Wrote message to named pipe at " << pipePath << ": " << outMessage << std::endl;

    char inMessage[128];
    inPipe->read(inMessage, sizeof(outMessage));

    std::cout << "Received from named pipe at " << pipePath << ": " << inMessage << std::endl;
    return 0;
}
