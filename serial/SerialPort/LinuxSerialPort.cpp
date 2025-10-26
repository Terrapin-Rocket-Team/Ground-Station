#include "LinuxSerialPort.h"
#include <cerrno>
#include <cstdio>
#include <cstring>
#include <fcntl.h> // Contains file controls like O_RDWR
#include <iostream>
#include <unistd.h>
#include <sys/ioctl.h>
#include <poll.h>

LinuxSerialPort::LinuxSerialPort(const char *portName, int baud) : SerialPort(portName)
{
  portHandle = open(portName, O_RDWR);
  if (portHandle < 0)
  {
    std::cout << "ERROR: Failed to open serial port at " << portName << "\n";
    std::cout << strerror(errno) << "\n";
    return;
  }

  struct termios2 tty;

  if (ioctl(portHandle, TCGETS, &tty) != 0)
  {
    std::cout << "Error " << errno << " from ioctl TCGETS " << strerror(errno)
              << "\n";
    connected = false;
    return;
  }
  backup = tty;

  tty.c_cflag &= ~PARENB; // Clear parity bit, disabling parity (most common)
  tty.c_cflag &= ~CSTOPB; // Clear stop field, only one stop bit used in
                          // communication (most common)
  tty.c_cflag &= ~CSIZE;  // Clear all bits that set the data size
  tty.c_cflag |= CS8;     // 8 bits per byte (most common)
  tty.c_cflag |= CRTSCTS; // Enable RTS/CTS hardware flow control (most common)
  tty.c_cflag |=
      CREAD | CLOCAL; // Turn on READ & ignore ctrl lines (CLOCAL = 1)

  tty.c_lflag &= ~ICANON;
  tty.c_lflag &= ~ECHO;                   // Disable echo
  tty.c_lflag &= ~ECHOE;                  // Disable erasure
  tty.c_lflag &= ~ECHONL;                 // Disable new-line echo
  tty.c_lflag &= ~ISIG;                   // Disable interpretation of INTR, QUIT and SUSP
  tty.c_iflag &= ~(IXON | IXOFF | IXANY); // Turn off s/w flow ctrl
  tty.c_iflag &= ~(IGNBRK | BRKINT | PARMRK | ISTRIP | INLCR | IGNCR |
                   ICRNL); // Disable any special handling of received bytes

  tty.c_oflag &= ~OPOST; // Prevent special interpretation of output bytes (e.g.
                         // newline chars)
  tty.c_oflag &=
      ~ONLCR; // Prevent conversion of newline to carriage return/line feed
  // tty.c_oflag &= ~OXTABS; // Prevent conversion of tabs to spaces (NOT
  // PRESENT ON LINUX) tty.c_oflag &= ~ONOEOT; // Prevent removal of C-d chars
  // (0x004) in output (NOT PRESENT ON LINUX)

  tty.c_cc[VTIME] = 10; // Wait for up to 1s (10 deciseconds), returning as soon
                        // as any data is received.
  tty.c_cc[VMIN] = 0;

  tty.c_cflag &= ~CBAUD;
  tty.c_cflag |= BOTHER;
  tty.c_ispeed = baud;
  tty.c_ospeed = baud;

  // Save tty settings, also checking for error
  if (ioctl(portHandle, TCSETSW, &tty) != 0)
  {
    std::cout << "Error " << errno << " from ioctl TCSETSW " << strerror(errno)
              << "\n";
    connected = false;
  }

  connected = true;
}

bool LinuxSerialPort::writeSerialPort(void *buffer, unsigned int buf_size)
{
  return write(portHandle, buffer, buf_size) == buf_size;
}
bool LinuxSerialPort::writeSerialPort(int data, unsigned int buf_size)
{
  return writeSerialPort((void *)(&data), buf_size) == buf_size;
}

int LinuxSerialPort::readSerialPort(void *buffer, unsigned int buf_size)
{
  return read(portHandle, buffer, buf_size);
}

void LinuxSerialPort::closeSerial()
{
  if (connected)
  {
    // apparently changing serial port settings persist after the process ends,
    // so it's a good idea to restore to the backup to clean up
    if (ioctl(portHandle, TCSETSW, &backup) != 0)
    {
      std::cout << "Error " << errno << " from ioctl TCSANOW " << strerror(errno)
                << "\n";
      connected = false;
    }
    close(portHandle);
  }
}

bool LinuxSerialPort::isConnected()
{
  // check if serial is still connected
  pollfd fds = {
      .fd = portHandle,
      .events = POLLHUP,
  };
  poll(&fds, 1, 0);
  if (fds.revents & POLLHUP)
    this->connected = false;
  return this->connected;
}

LinuxSerialPort::~LinuxSerialPort() { closeSerial(); }
