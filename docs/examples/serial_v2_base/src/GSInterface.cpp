#include "GSInterface.h"

GSInterface::GSInterface(uint32_t baud, uint32_t debugBaud, uint32_t interval) : baud(baud), debugBaud(debugBaud), metricsInterval(interval) {}

GSInterface::~GSInterface()
{
    // delete each Metrics pointer
    for (int i = 0; i < this->numMetrics; i++)
        delete this->metricsArr[i];
    delete[] this->metricsArr;
}

#ifdef ARDUINO
bool GSInterface::begin(HardwareSerial *serial, HardwareSerial *serialDebug)
{
    // make sure serial is not a nullptr, then set up and set the baud rate
    if (serial != nullptr)
    {
        this->s = serial;
        this->s->begin(this->baud);
    }

    // make sure serialDebug is not a nullptr, a baud rate was given, then set up and set the baud rate
    if (serialDebug != nullptr && this->debugBaud > 0)
    {
        this->sd = serialDebug;
        this->sd->begin(this->debugBaud);
    }

    // check that the main serial is not a null pointer
    // and that the serialDebug was either not given (a null pointer)
    // or was given and the debug baud rate was set
    this->ready = this->s != nullptr && (sd == nullptr || (sd != nullptr && this->sd != nullptr && this->debugBaud > 0));

    // if the interface it ready enter ready state
    if (this->ready)
        this->state = READY;

    return this->ready;
}
#else
bool GSInterface::begin() { return false; }
#endif

int GSInterface::run()
{
    // store the number of bytes available from the serial port
    uint32_t bytesAvail = this->available();
    if (this->ready && bytesAvail > 0)
    {
        // whether a newline has been found in the input
        bool foundNewline = false;
        // check if the current state allows receiving a new command (ready state)
        if (this->state == READY)
        {
            for (uint32_t i = 0; i < bytesAvail; i++)
            {
                char c = this->readC();
                // stop when a new line is found
                if (c == '\n')
                {
                    // null terminate
                    this->serialBuf[i] = 0;
                    foundNewline = true;
                    break;
                }
                // add characters to buffer
                this->serialBuf[i] = c;
                this->serialBufLength++;
                // break and reset buffer if full
                if (this->serialBufLength >= (int)sizeof(this->serialBuf))
                {
                    this->serialBufLength = 0;
                    break;
                }
            }
            // update the available number of bytes
            bytesAvail = this->available();

            // if there was a new line
            if (foundNewline)
            {
                // figure out what command it was

                // if start of handshake
                if (strcmp(this->serialBuf, "handshake") == 0)
                {
                    // begin the handshake
                    this->handshake = false;
                    this->state = HANDSHAKE;
                }
                // if handshake was successful
                else if (strcmp(this->serialBuf, "handshake succeeded") == 0)
                {
                    // the handshake was successful
                    this->handshake = true;
                    for (int i = 0; i < this->numMetrics; i++)
                    {
                        this->metricsArr[i]->setInitialTime(this->time());
                    }
                }
                // if handshake failed
                else if (strcmp(this->serialBuf, "handshake failed") == 0)
                {
                    // the handshake was not successful
                    this->handshake = false;
                }
                // if a command is being sent
                else if (strcmp(this->serialBuf, "command") == 0)
                {
                    this->state = COMMAND;
                }
                // add additional commands as required

                // reset serial buffer
                memset(this->serialBuf, 0, sizeof(this->serialBuf));
                foundNewline = false;
            }
        }

        // handshake logic
        if (this->state == HANDSHAKE)
        {
            for (uint32_t i = 0; i < bytesAvail; i++)
            {
                // read each char
                char c = this->readC();
                // skip odd characters that accidently get added
                if (c != 0xff && c != 0)
                {
                    // and repeat back to ground station
                    this->writeC(c);
                    // until there is a new line (or no more bytes)
                    if (c == '\n')
                    {
                        foundNewline = true;
                        break;
                    }
                }
            }
            // update the available number of bytes
            bytesAvail = this->available();

            // if there is a new line, the handshake is complete
            if (foundNewline)
            {
                foundNewline = false;
                this->state = READY;
            }
        }

        // command logic
        if (this->state == COMMAND)
        {
            // clear internal message
            this->m.clear();
            // read into message
            for (uint32_t i = 0; i < bytesAvail; i++)
            {
                this->m.append(this->readC());
                if (this->m.size >= Message::maxSize)
                    break;
            }
            // update the available number of bytes
            bytesAvail = this->available();

            // check if we can decode the header
            if (this->m.size >= GSData::headerLen)
            {
                // decode the header
                uint8_t type, id, deviceId = 0;
                GSData::decodeHeader(this->m.buf, type, id, deviceId, inputSize);
                if (type != APRSCmd::type || id == 0 || inputSize == 0)
                {
                    // this is not an APRSCmd, ignore it
                    this->state = READY;
                }
            }

            // if there are more bytes in message than necessary
            if (this->m.size - GSData::headerLen > inputSize && inputSize != 0)
            {
                // remove the extra bytes and put them in the serial buffer in case they are part of a different message
                uint16_t removed = (this->m.size - GSData::headerLen) - inputSize;
                this->m.pop((uint8_t *)this->serialBuf, removed);
                this->serialBufLength += removed;
            }
            // if there are exactly enough bytes
            if (this->m.size - GSData::headerLen == inputSize && inputSize != 0)
            {
                // we have the full command, so decode it
                this->m.decode(&input);
                hasInput = true;
                this->state = READY;
            }
        }

        // add additional command handling here
    }

    // send Metrics on timer and check if handshake was successful
    if (this->time() - this->metricsTimer > this->metricsInterval && this->handshake)
    {
        // reset timer
        this->metricsTimer = this->time();
        // loop through metrics to send each
        for (int i = 0; i < this->numMetrics; i++)
        {
            // clear message
            this->m.clear();
            // encode metrics
            this->m.encode(this->metricsArr[i]);
            // fill GSData with metrics for multiplexing
            this->metricsGSData.fill(this->m.buf, this->m.size);
            // encode data for multiplexing
            this->m.encode(&(this->metricsGSData));
            // write multiplexed data
            this->write((char *)this->m.buf, this->m.size);
        }
    }
    return 0;
}

bool GSInterface::isReady()
{
    // check whether the interface is ready, a handshake is established, the interface is not busy
    return this->ready && this->handshake && this->state == READY;
}

GSStream GSInterface::createStream(uint8_t type, uint8_t deviceId)
{
    // check for a metrics with this device id
    bool hasDeviceId = false;
    uint16_t i;
    for (i = 0; i < this->numMetrics; i++)
    {
        if (this->metricsArr[i]->deviceId == deviceId)
        {
            hasDeviceId = true;
            break;
        }
    }

    // if there is no metrics with this device id, and numMetrics is not max(uint16), create a new one
    if (!hasDeviceId && this->numMetrics < 0xFFFF)
    {
        // create new, larger metrics array
        Metrics **newMetricsArr = new Metrics *[this->numMetrics + 1];
        // copy pointers from old array
        memcpy(newMetricsArr, this->metricsArr, sizeof(Metrics *) * this->numMetrics);
        // add new pointer to array
        newMetricsArr[this->numMetrics] = new Metrics(deviceId);
        // delete old array
        delete[] this->metricsArr;
        // set metricsArr to new array
        this->metricsArr = newMetricsArr;
        // create a new stream with the given type, the next stream index, and the new metrics
        return GSStream(type, streamIndex++, this->metricsArr[numMetrics++]);
    }

    // create a new stream with the given type, the next stream index, and the found metrics
    return GSStream(type, streamIndex++, this->metricsArr[i]);
}

int GSInterface::writeStream(GSStream *s, Data *data, short signalStrength)
{
    // encode data to internal message to get character buffer
    this->m.encode(data);
    return this->writeStream(s, (char *)this->m.buf, this->m.size, signalStrength);
}

int GSInterface::writeStream(GSStream *s, char *data, int dataLen, short signalStrength)
{
    // make sure there is data to send
    if (dataLen <= 0)
        return 0;

    // set up data to be encoded for multiplexing
    s->streamData.fill((uint8_t *)data, dataLen);
    // reset internal message
    this->m.clear();
    // encode data for multiplexing
    this->m.encode(&(s->streamData));
    // update metrics for this stream
    s->streamMetrics->update(m.size, this->time(), signalStrength);
    // write the stream data
    return this->write((char *)this->m.buf, this->m.size);
}

int GSInterface::readStream(char *data, int dataLen)
{
    // check if there is input available
    if (this->hasInput)
    {
        // make sure the data array can fit the input
        if (dataLen < this->input.size)
            return 0;

        // copy the data contained in the GSData to the data array
        memcpy(data, this->input.buf, this->input.size);
        this->hasInput = false;
        return this->input.size;
    }
    return 0;
}

void GSInterface::log(const char *str1, const char *str2, const char *str3)
{
    // make sure there is a debug serial port
    if (this->sd != nullptr && this->debugBaud > 0)
    {
        // platform dependent implementation
#ifdef ARDUINO
        this->sd->print(str1);
        this->sd->print(str2);
        this->sd->print(str3);
        this->sd->write("\n");
#endif
    }
}

// private methods

int GSInterface::available()
{
    // platform dependent implementation
#ifdef ARDUINO
    return this->s->available();
#else
    return 0;
#endif
}

int GSInterface::write(char *s, uint32_t length)
{
    // platform dependent implementation
#ifdef ARDUINO
    return this->s->write(s, length);
#endif
}

void GSInterface::writeC(char c)
{
    // platform dependent implementation
#ifdef ARDUINO
    this->s->write(c);
#endif
}

int GSInterface::read(char *s, uint32_t length)
{
    // platform dependent implementation
#ifdef ARDUINO
    uint32_t addedLength = 0;
    // add bytes while there are still bytes in the serial port and the array is not full
    while (this->s->available() > 0 && addedLength < length)
    {
        s[addedLength++] = this->s->read();
    }
    return addedLength;
#else
    return 0;
#endif
}

char GSInterface::readC()
{
    // platform dependent implementation
#ifdef ARDUINO
    return this->s->read();
#else
    return 0;
#endif
}

uint32_t GSInterface::time()
{
    // platform dependent implementation
#ifdef ARDUINO
    return millis();
#else
    return 0;
#endif
}
