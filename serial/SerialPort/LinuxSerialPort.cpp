#include "LinuxSerialPort.h"
#include <cerrno>
#include <cstdio>
#include <cstring>
#include <fcntl.h> // Contains file controls like O_RDWR
#include <iostream>
#include <unistd.h>
#include <sys/ioctl.h>
#include <poll.h>

#ifdef LINUX
#include <linux/termios.h> // termios2, TCGETS/TCSETSW, BOTHER, etc.
#elif APPLE
#include <termios.h>           // macOS / POSIX
#include <IOKit/serial/ioss.h> // IOSSIOSPEED (macOS)
#endif

LinuxSerialPort::LinuxSerialPort(const char *portName, int baud) : SerialPort(portName)
{
  // open as read/write, no controlling terminal, nonblocking during setup
  portHandle = open(portName, O_RDWR | O_NOCTTY | O_NONBLOCK);
  if (portHandle < 0)
  {
    std::cout << "ERROR: Failed to open serial port at " << portName << "\n";
    std::cout << strerror(errno) << "\n";
    connected = false;
    return;
  }

#ifdef LINUX
  struct termios2 tty;

  if (ioctl(portHandle, TCGETS, &tty) != 0)
  {
    std::cout << "Error " << errno << " from ioctl TCGETS " << strerror(errno) << "\n";
    connected = false;
    return;
  }
  backup = tty;

  tty.c_cflag &= ~PARENB;
  tty.c_cflag &= ~CSTOPB;
  tty.c_cflag &= ~CSIZE;
  tty.c_cflag |= CS8;
  tty.c_cflag |= CRTSCTS;
  tty.c_cflag |= CREAD | CLOCAL;

  tty.c_lflag &= ~ICANON;
  tty.c_lflag &= ~ECHO;
  tty.c_lflag &= ~ECHOE;
  tty.c_lflag &= ~ECHONL;
  tty.c_lflag &= ~ISIG;

  tty.c_iflag &= ~(IXON | IXOFF | IXANY);
  tty.c_iflag &= ~(IGNBRK | BRKINT | PARMRK | ISTRIP | INLCR | IGNCR | ICRNL);

  tty.c_oflag &= ~OPOST;
  tty.c_oflag &= ~ONLCR;

  tty.c_cc[VTIME] = 10;
  tty.c_cc[VMIN] = 0;

  tty.c_cflag &= ~CBAUD;
  tty.c_cflag |= BOTHER;
  tty.c_ispeed = baud;
  tty.c_ospeed = baud;

  if (ioctl(portHandle, TCSETSW, &tty) != 0)
  {
    std::cout << "Error " << errno << " from ioctl TCSETSW " << strerror(errno) << "\n";
    connected = false;
    return;
  }

#elif APPLE
  struct termios tty;

  if (tcgetattr(portHandle, &tty) != 0)
  {
    std::cout << "Error " << errno << " from tcgetattr " << strerror(errno) << "\n";
    connected = false;
    return;
  }
  backup = tty;

  // similar “raw” behavior to your Linux flags
  cfmakeraw(&tty);

  tty.c_cflag |= (CREAD | CLOCAL);
  tty.c_cflag &= ~PARENB;
  tty.c_cflag &= ~CSTOPB;
  tty.c_cflag &= ~CSIZE;
  tty.c_cflag |= CS8;

#ifdef CRTSCTS
  // You enabled RTS/CTS on Linux. Keep behavior if available.
  tty.c_cflag |= CRTSCTS;
#endif

  tty.c_cc[VTIME] = 10;
  tty.c_cc[VMIN] = 0;

  // set “standard” baud if possible
  speed_t spd = 0;
  switch (baud)
  {
  case 9600:
    spd = B9600;
    break;
  case 19200:
    spd = B19200;
    break;
  case 38400:
    spd = B38400;
    break;
  case 57600:
    spd = B57600;
    break;
  case 115200:
    spd = B115200;
    break;
#ifdef B230400
  case 230400:
    spd = B230400;
    break;
#endif
  default:
    spd = 0;
    break;
  }

  if (spd != 0)
  {
    cfsetispeed(&tty, spd);
    cfsetospeed(&tty, spd);
  }

  if (tcsetattr(portHandle, TCSANOW, &tty) != 0)
  {
    std::cout << "Error " << errno << " from tcsetattr " << strerror(errno) << "\n";
    connected = false;
    return;
  }

  // If baud isn't a standard enum, try IOSSIOSPEED (some devices/drivers support it)
  if (spd == 0)
  {
    speed_t iosSpeed = (speed_t)baud;
    ioctl(portHandle, IOSSIOSPEED, &iosSpeed);
  }
#endif

  // clear nonblocking after configuration
  int flags = fcntl(portHandle, F_GETFL, 0);
  if (flags != -1)
    fcntl(portHandle, F_SETFL, flags & ~O_NONBLOCK);

  connected = true;
}

bool LinuxSerialPort::writeSerialPort(void *buffer, unsigned int buf_size)
{
  return write(portHandle, buffer, buf_size) == (ssize_t)buf_size;
}

bool LinuxSerialPort::writeSerialPort(int data, unsigned int buf_size)
{
  (void)buf_size; // keep signature; we only send a single byte
  unsigned char b = (unsigned char)data;
  return writeSerialPort((void *)&b, 1);
}

int LinuxSerialPort::readSerialPort(void *buffer, unsigned int buf_size)
{
  return (int)read(portHandle, buffer, buf_size);
}

void LinuxSerialPort::closeSerial()
{
  if (connected)
  {
    // restore settings to backup
#ifdef __linux__
    if (ioctl(portHandle, TCSETSW, &backup) != 0)
    {
      std::cout << "Error " << errno << " from ioctl TCSETSW " << strerror(errno) << "\n";
    }
#else
    if (tcsetattr(portHandle, TCSANOW, &backup) != 0)
    {
      std::cout << "Error " << errno << " from tcsetattr " << strerror(errno) << "\n";
    }
#endif
    close(portHandle);
    connected = false;
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