#include "LinuxSerialPort.h"
#include "SerialPort.h"
#include <cstring>
#include <iostream>

// making slight modifications so that the usb paths match to what's on my mac right now
int main()
{
  std::string portPath = "";

  // teensy 4.1 just has a single port for both in/out
  SerialPort *port = reinterpret_cast<SerialPort *>(new LinuxSerialPort(portPath.c_str(), 115200)); // wants a baud now

  if (port->isConnected())
  {

    std::cout << "Connected!\n";
    const char *str = "Hello Serial!";

    std::cout << "Writing '" << str << "' to serial port at " << portPath
              << "\n";
    if (!port->writeSerialPort((void *)str, sizeof(char) * (strlen(str) + 1)))
    {
      std::cerr << "failed to write\n";
    }

    char in[32] = {'\0'};
    port->readSerialPort(&in, sizeof(char) * 32);

    std::cout << "Reading from serial port at " << portPath << ": " << in << "\n";
  }

  port->closeSerial();
}
