#include "LinuxSerialPort.hpp"
#include "SerialPort.hpp"
#include <cstring>
#include <iostream>
int main() {
  std::string outPortPath = "/dev/ttyUSB13";
  std::string inPortPath = "/dev/ttyUSB14";
  SerialPort *outPort =
      reinterpret_cast<SerialPort *>(new LinuxSerialPort(outPortPath.c_str()));
  SerialPort *inPort =
      reinterpret_cast<SerialPort *>(new LinuxSerialPort(inPortPath.c_str()));

  if (outPort->isConnected()) {

    std::cout << "Connected!\n";
    const char *str = "Hello Serial!";

    std::cout << "Writing '" << str << "' to serial port at " << outPortPath
              << "\n";
    if (!outPort->writeSerialPort((void *)str,
                                  sizeof(char) * (strlen(str) + 1))) {
      std::cerr << "failed to write\n";
    }

    char in[32] = {'\0'};
    inPort->readSerialPort(&in, sizeof(char) * 32);

    std::cout << "Reading from serial port at " << inPortPath << ": " << in
              << "\n";
  }

  outPort->closeSerial();
  inPort->closeSerial();
}
