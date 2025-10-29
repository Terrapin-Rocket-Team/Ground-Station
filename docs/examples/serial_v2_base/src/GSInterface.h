#ifndef GSINTERFACE_H
#define GSINTERFACE_H

#include "Arduino.h"
#include "RadioMessage.h"

enum InputState
{
    HANDSHAKE, // performing a handshake
    COMMAND,   // reading data from GS
    WRITE,     // writing data to GS
    READY,     // ready to read or write
    IDLE       // not ready to read or write
};

enum CallbackNames
{
    HANDSHAKE_SUCCESS,
    HANDSHAKE_FAIL,
    COMMAND_START,
    NONE
};

struct Callback
{
    void (*func)();
    CallbackNames type = NONE;
};

class GSInterface
{
public:
    GSInterface(uint32_t baud, uint32_t debugBaud = 0);

#ifdef ARDUINO
    bool begin(HardwareSerial *s, HardwareSerial *sd = nullptr);
    HardwareSerial *s;
    HardwareSerial *sd;
#else
    bool begin();
#endif

    int run();

    // debug methods
    void log(const char *str1, const char *str2 = "", const char *str3 = "");

    // communications variables
    uint32_t baud = 115200;
    uint32_t debugBaud = 0;
    char serialBuf[Message::maxSize] = {0};
    uint16_t serialBufLength = 0;

    // state variables
    bool ready = false;
    bool handshake = false;
    InputState state = IDLE;

    // callback variables
    Callback callbacks[10];

private:
    int available();
    int write(char *s, uint32_t length);
    void writeC(char c);
    int read(char *s, uint32_t length);
    char readC();

    // uint32_t bytesAvail = 0;
};

#endif