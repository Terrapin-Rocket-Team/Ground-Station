/*
 * Author: Manash Kumar Mandal
 * Modified Library introduced in Arduino Playground which does not work
 * This works perfectly
 * LICENSE: MIT
 */

#pragma once

#define ARDUINO_WAIT_TIME 2000
#define MAX_DATA_LENGTH 2048

#include <iostream>
#ifdef _WIN32
#include <windows.h>
#elif __linux

#endif

class SerialPort {
private:
#ifdef _WIN32
  HANDLE handler;
  bool connected;
  COMSTAT status;
  DWORD errors;
#elif __linux
  int serialPort;
#endif

public:
  explicit SerialPort(const char *portName);
  ~SerialPort();

  virtual int readSerialPort(const void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(int data, unsigned int buf_size) = 0;
  virtual bool isConnected() = 0;
  virtual void closeSerial() = 0;
};
