//
// Created by ramykaddouri on 10/11/24.
//

#ifndef NAMEDPIPE_H
#define NAMEDPIPE_H

#include <iostream>

class NamedPipe
{
protected:
  const char *path;

public:
  NamedPipe(const char *path)
  {
    this->path = path;
  }
  virtual ~NamedPipe() {};

  virtual int read(void *buffer, int bufferSize) = 0;
  virtual int write(const void *buffer, int bufferSize) = 0;
  virtual int readStr(char *buffer, int bufferSize) = 0;
  virtual int writeStr(const char *buffer) = 0;
};

#endif // NAMEDPIPE_H
