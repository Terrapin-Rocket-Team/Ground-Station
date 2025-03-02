#pragma once

#include "SerialPort.h"
// #include "asm/termbits.h"
// added git stuff
#include <stdio.h>
#include <string.h>
#include <sstream>
#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/signal.h>
#include <errno.h>
#include <paths.h>
#include <sysexits.h>
#include <termios.h>
#include <sys/param.h>
#include <pthread.h>
#include <IOKit/serial/ioss.h>
// end added

class LinuxSerialPort : public SerialPort
{
private:
  int portHandle;
  bool connected;
  #ifdef __APPLE__
    termios backup;
  #endif
  #ifdef __linux__
    termios2 backup;
  #endif

public:
  LinuxSerialPort(const char *portName);
  ~LinuxSerialPort();

  int readSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(int data, unsigned int buf_size) override;
  bool isConnected() override;
  void closeSerial() override;
};
