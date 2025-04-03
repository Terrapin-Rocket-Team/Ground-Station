/*
 * Author: Manash Kumar Mandal
 * Modified Library introduced in Arduino Playground which does not work
 * This works perfectly
 * LICENSE: MIT
 */

#pragma once

#define ARDUINO_WAIT_TIME 2000
#define MAX_DATA_LENGTH 2048

class SerialPort
{
public:
  SerialPort(const char *portName) {};
  virtual ~SerialPort() {};

  virtual int readSerialPort(void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(int data, unsigned int buf_size) = 0;
  virtual bool isConnected() = 0;
  virtual void closeSerial() = 0;
};