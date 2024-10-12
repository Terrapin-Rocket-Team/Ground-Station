//
// Created by ramykaddouri on 10/12/24.
//

#include <iostream>
#include <LinuxNamedPipe.h>
#include <ostream>

int main() {
    LinuxNamedPipe outLinPipe = LinuxNamedPipe("testing_pipe", true);
    LinuxNamedPipe inLinPipe = LinuxNamedPipe("testing_pipe", false);

    NamedPipe* outPipe = &outLinPipe;
    NamedPipe* inPipe = &inLinPipe;

    const char outMessage[128] = "Hello World!";
    outPipe->write(outMessage, sizeof(outMessage));
    std::cout << "Wrote message: " << outMessage << std::endl;

    char inMessage[128];
    inPipe->read(inMessage, sizeof(outMessage));

    std::cout << "Received: " << inMessage << std::endl;
    return 0;
}
