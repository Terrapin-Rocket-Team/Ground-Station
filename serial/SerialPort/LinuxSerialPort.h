#pragma once

#include "SerialPort.h"

#ifdef __linux__
  #include <linux/termios.h>
#else
  #include <termios.h>
#endif

class LinuxSerialPort : public SerialPort
{
private:
  int portHandle;
  bool connected;

#ifdef __linux__
  termios2 backup;
#else
  termios backup;
#endif

public:
  LinuxSerialPort(const char *portName, int baud);
  ~LinuxSerialPort();

  int readSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(int data, unsigned int buf_size) override;
  bool isConnected() override;
  void closeSerial() override;
};