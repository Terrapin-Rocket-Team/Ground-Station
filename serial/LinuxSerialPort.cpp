#include "LinuxSerialPort.hpp"
#include <fcntl.h> // Contains file controls like O_RDWR
#include <iostream>
#include <stdlib.h>
#include <termios.h> // Contains POSIX terminal control definitions
#include <unistd.h>
#include <unistd.h> // write(), read(), close()

#pragma once

LinuxSerialPort::LinuxSerialPort(const char *portName) : SerialPort(portName) {
  portNumber = open(portName, O_RDWR);
  if (portNumber < 0) {
    std::cerr << "ERROR: Failed to open serial port at " << portName << "\n";
  }
}

bool LinuxSerialPort::writeSerialPort(void *buffer, unsigned int buf_size) {
  return true;
}
bool LinuxSerialPort::writeSerialPort(int data, unsigned int buf_size) {
  return true;
}

int LinuxSerialPort::readSerialPort(void *buffer, unsigned int bufSize) {
  return read(portNumber, buffer, bufSize);
}

LinuxSerialPort::~LinuxSerialPort() { close(portNumber); }
