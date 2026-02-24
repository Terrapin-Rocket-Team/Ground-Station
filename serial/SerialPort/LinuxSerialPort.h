#pragma once

#include "SerialPort.h"

#ifdef APPLE
#include <linux/termios.h>
#elif
#include <termios.h>
#endif

class LinuxSerialPort : public SerialPort
{
private:
  int portHandle;
  bool connected;

#ifdef LINUX
  termios2 backup;
#elif APPLE
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