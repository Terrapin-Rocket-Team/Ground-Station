#include "SerialPort.hpp"
class LinuxSerialPort : public SerialPort {
private:
  int portNumber;

public:
  LinuxSerialPort(const char *portName);
  ~LinuxSerialPort();

  virtual int readSerialPort(void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(void *buffer, unsigned int buf_size) = 0;
  virtual bool writeSerialPort(int data, unsigned int buf_size) = 0;
  virtual bool isConnected() = 0;
  virtual void closeSerial() = 0;
};
