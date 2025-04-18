#include "WinSerialPort.h"

#include <iostream>

WinSerialPort::WinSerialPort(const char *portName) : SerialPort(portName)
{
  this->connected = false;

  char portPath[60] = "\\\\.\\";
  strcat(portPath, portName);

  this->handler =
      CreateFileA(static_cast<LPCSTR>(portPath), GENERIC_READ | GENERIC_WRITE,
                  0, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (this->handler == INVALID_HANDLE_VALUE)
  {
    if (GetLastError() == ERROR_FILE_NOT_FOUND)
    {
      std::cerr << "ERROR: Handle was not attached.Reason : " << portName
                << " not available\n";
    }
    else
    {
      std::cerr << "ERROR!!!\n";
    }
  }
  else
  {
    DCB dcbSerialParameters = {0};

    if (!GetCommState(this->handler, &dcbSerialParameters))
    {
      std::cerr << "Failed to get current serial parameters\n";
    }
    else
    {
      dcbSerialParameters.BaudRate = 600000; // Adjust to match desired bitrate
      dcbSerialParameters.ByteSize = 8;
      dcbSerialParameters.StopBits = ONESTOPBIT;
      dcbSerialParameters.Parity = NOPARITY;
      dcbSerialParameters.fDtrControl = DTR_CONTROL_ENABLE;
      dcbSerialParameters.fRtsControl =
          RTS_CONTROL_HANDSHAKE; // Enable RTS/CTS flow control
      dcbSerialParameters.fOutxCtsFlow = TRUE;
      dcbSerialParameters.fOutxDsrFlow = TRUE;

      if (!SetCommState(handler, &dcbSerialParameters))
      {
        std::cout << "ALERT: could not set serial port parameters\n";
      }
      else
      {
        this->connected = true;
        PurgeComm(this->handler, PURGE_RXCLEAR | PURGE_TXCLEAR);
        // Sleep(ARDUINO_WAIT_TIME); // TODO: does this need to be here?
      }
    }
  }
}

WinSerialPort::~WinSerialPort()
{
  if (this->connected)
  {
    this->connected = false;
    CloseHandle(this->handler);
  }
}

// Reading bytes from serial port to buffer;
// returns read bytes count, or if error occurs, returns 0
int WinSerialPort::readSerialPort(void *buffer, unsigned int buf_size)
{
  DWORD bytesRead{};
  unsigned int toRead = 0;

  ClearCommError(this->handler, &this->errors, &this->status);

  if (this->status.cbInQue > 0)
  {
    if (this->status.cbInQue > buf_size)
    {
      toRead = buf_size;
    }
    else
    {
      toRead = this->status.cbInQue;
    }
  }

  memset((void *)buffer, 0, buf_size);

  if (ReadFile(this->handler, (void *)buffer, toRead, &bytesRead, NULL))
  {
    return bytesRead;
  }

  return 0;
}

// Sending provided buffer to serial port;
// returns true if succeed, false if not
bool WinSerialPort::writeSerialPort(void *buffer, unsigned int buf_size)
{
  DWORD bytesSend;

  if (!WriteFile(this->handler, buffer, buf_size, &bytesSend, 0))
  {
    ClearCommError(this->handler, &this->errors, &this->status);
    return false;
  }

  return true;
}

// Overloaded function for int input
bool WinSerialPort::writeSerialPort(int data, unsigned int buf_size)
{
  DWORD bytesSend;

  if (!WriteFile(this->handler, (void *)(&data), buf_size, &bytesSend, 0))
  {
    ClearCommError(this->handler, &this->errors, &this->status);
    return false;
  }

  return true;
}

// Checking if serial port is connected
bool WinSerialPort::isConnected()
{
  if (!ClearCommError(this->handler, &this->errors, &this->status))
  {
    this->connected = false;
  }

  return this->connected;
}

void WinSerialPort::closeSerial() { CloseHandle(this->handler); }
