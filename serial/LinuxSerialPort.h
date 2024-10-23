#pragma once

#include "SerialPort.h"
#include <termios.h>
class LinuxSerialPort : public SerialPort
{
private:
  int portHandle;
  bool connected;
  struct termios backup;

public:
  LinuxSerialPort(const char *portName);
  ~LinuxSerialPort();

  int readSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(int data, unsigned int buf_size) override;
  bool isConnected() override;
  void closeSerial() override;
};
