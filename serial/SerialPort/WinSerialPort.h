#pragma once
#include "SerialPort.h"
#include <windows.h>

class WinSerialPort : public SerialPort
{
private:
  HANDLE handler;
  bool connected;
  COMSTAT status;
  DWORD errors;

public:
  WinSerialPort(const char *portName, int baud);
  ~WinSerialPort();

  int readSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(void *buffer, unsigned int buf_size) override;
  bool writeSerialPort(int data, unsigned int buf_size) override;
  bool isConnected() override;
  void closeSerial() override;
};
