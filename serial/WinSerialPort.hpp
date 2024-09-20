#pragma once
#include "SerialPort.hpp"
#include <windows.h>

class WinSerialPort : public SerialPort {
private:
  HANDLE handler;
  bool connected;
  COMSTAT status;
  DWORD errors;

public:
  WinSerialPort(const char *portName);
  ~WinSerialPort();

  virtual int readSerialPort(void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(int data, unsigned int buf_size) = 0;
  virtual bool isConnected() = 0;
  virtual void closeSerial() = 0;
};
