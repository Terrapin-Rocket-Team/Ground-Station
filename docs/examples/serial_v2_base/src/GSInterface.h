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

struct GSStream
{
    GSStream(uint8_t type, uint8_t streamIndex, Metrics *m) : streamData(type, streamIndex, 0), streamMetrics(m) {}
    GSData streamData;
    Metrics *streamMetrics;
};

class GSInterface
{
public:
    GSInterface(uint32_t baud, uint32_t debugBaud = 0);
    ~GSInterface();

#ifdef ARDUINO
    bool begin(HardwareSerial *s, HardwareSerial *sd = nullptr);
    HardwareSerial *s;
    HardwareSerial *sd;
#else
    bool begin();
#endif

    int run();

    bool isReady();

    int writeStream(GSStream *s, Data *data, short signalStrength = 0);
    int writeStream(GSStream *s, char *data, int dataLen, short signalStrength = 0);

    int readStream(char *data, int dataLen);

    GSStream createStream(uint8_t type, uint8_t deviceId);

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

    // streams
    uint8_t streamIndex = 1; // 0 used to indicate error, so start at 1

    // metrics handling
    Metrics *metricsArr[10];
    uint8_t deviceIdArr[10];
    int numMetrics = 0;
    uint32_t metricsInterval = 1000; // ms
    GSData metricsGSData = {Metrics::type, this->streamIndex++, 0};

    // encoding variables
    Message m;
    uint16_t inputSize = 0;
    GSData input;
    bool hasInput = false;

private:
    int available();
    int write(char *s, uint32_t length);
    void writeC(char c);
    int read(char *s, uint32_t length);
    char readC();
    uint32_t time();

    uint32_t metricsTimer = 0;
};

#endif