#pragma once

#include "SerialPort.h"
#include "asm/termbits.h"

class LinuxSerialPort : public SerialPort
{
private:
  int portHandle;
  bool connected;
  termios2 backup;

public:
  LinuxSerialPort(const char *portName);
  ~LinuxSerialPort();

  int readSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(int data, unsigned int buf_size) override;
  bool isConnected() override;
  void closeSerial() override;
};
