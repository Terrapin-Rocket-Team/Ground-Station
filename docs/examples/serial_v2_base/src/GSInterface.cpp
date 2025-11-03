#include "GSInterface.h"

GSInterface::GSInterface(uint32_t baud, uint32_t debugBaud) : baud(baud), debugBaud(debugBaud) {}

GSInterface::~GSInterface()
{
    for (int i = 0; i < this->numMetrics; i++)
        delete this->metricsArr[i];
}

#ifdef ARDUINO
bool GSInterface::begin(HardwareSerial *serial, HardwareSerial *serialDebug)
{
    if (serial != nullptr)
    {
        this->s = serial;
        this->s->begin(this->baud);
    }

    if (serialDebug != nullptr && this->debugBaud > 0)
    {
        this->sd = serialDebug;
        this->sd->begin(this->debugBaud);
    }

    // check that the main serial is not a null pointer
    // and that the serialDebug was either not given (a null pointer)
    // or was given and the debug baud rate was set
    this->ready = this->s != nullptr && (sd == nullptr || (sd != nullptr && this->sd != nullptr && this->debugBaud > 0));

    if (this->ready)
        this->state = READY;

    return this->ready;
}
#else
bool GSInterface::begin() { return false; }
#endif

int GSInterface::run()
{
    uint32_t bytesAvail = 0;
    if (this->ready && ((bytesAvail = this->available()) > 0))
    {
        bool foundNewline = false;
        // check if a command is being sent
        if (this->state == READY)
        {
            for (uint32_t i = 0; i < bytesAvail; i++)
            {
                char c = this->readC();
                if (c == '\n')
                {
                    this->serialBuf[i] = 0;
                    foundNewline = true;
                    break;
                }
                this->serialBuf[i] = c;
                this->serialBufLength++;
                if (this->serialBufLength >= (int)sizeof(this->serialBuf))
                    break;
            }
            bytesAvail = this->available();

            if (foundNewline)
            {
                if (strcmp(this->serialBuf, "handshake") == 0)
                {
                    // begin the handshake
                    this->handshake = false;
                    this->state = HANDSHAKE;
                }
                else if (strcmp(this->serialBuf, "handshake succeeded") == 0)
                {
                    // the handshake was successful
                    this->handshake = true;
                    for (int i = 0; i < this->numMetrics; i++)
                    {
                        this->metricsArr[i]->setInitialTime(this->time());
                    }
                }
                else if (strcmp(this->serialBuf, "handshake failed") == 0)
                {
                    // the handshake was not successful
                    this->handshake = false;
                }
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

        // complete the handshake
        if (this->state == HANDSHAKE)
        {
            for (uint32_t i = 0; i < bytesAvail; i++)
            {
                char c = this->readC();
                // skip odd characters that accidently get added
                if (c != 0xff && c != 0)
                {
                    this->writeC(c);
                    if (c == '\n')
                    {
                        foundNewline = true;
                        break;
                    }
                }
            }
            bytesAvail = this->available();

            if (foundNewline)
            {
                foundNewline = false;
                this->state = READY;
            }
        }

        // receive the radio command
        if (this->state == COMMAND)
        {
            this->m.clear();
            // read into serial buffer
            for (uint32_t i = 0; i < bytesAvail; i++)
            {
                this->m.append(this->readC());
                if (this->m.size >= Message::maxSize)
                    break;
            }
            bytesAvail = this->available();

            if (this->m.size >= GSData::headerLen)
            {
                // we can decode the header
                uint8_t type, id, deviceId = 0;
                GSData::decodeHeader(this->m.buf, type, id, deviceId, inputSize);
                if (type != APRSCmd::type || id == 0 || inputSize == 0)
                {
                    // this is not an APRSCmd, ignore it
                    this->state = READY;
                }
            }

            if (this->m.size - GSData::headerLen > inputSize && inputSize != 0)
            {
                // remove the extra bytes and put them in the serial buffer in case they are part of a different message
                uint16_t removed = (this->m.size - GSData::headerLen) - inputSize;
                this->m.pop((uint8_t *)this->serialBuf, removed);
                this->serialBufLength += removed;
            }
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

    if (this->time() - this->metricsTimer > this->metricsInterval && this->handshake)
    {
        this->metricsTimer = this->time();
        for (int i = 0; i < this->numMetrics; i++)
        {
            this->m.clear();
            this->m.encode(this->metricsArr[i]);
            this->metricsGSData.fill(this->m.buf, this->m.size);
            this->m.encode(&(this->metricsGSData));
            this->write((char *)this->m.buf, this->m.size);
        }
    }
    return 0;
}

bool GSInterface::isReady()
{
    return this->ready && this->handshake && this->state == READY;
}

int GSInterface::writeStream(GSStream *s, Data *data, short signalStrength)
{
    // encode data to internal message to get character buffer
    this->m.encode(data);
    return this->writeStream(s, (char *)this->m.buf, this->m.size, signalStrength);
}

int GSInterface::writeStream(GSStream *s, char *data, int dataLen, short signalStrength)
{
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
    if (this->hasInput)
    {
        if (dataLen < this->input.size)
        {
            return 0;
        }

        memcpy(data, this->input.buf, this->input.size);
        this->hasInput = false;
    }
    return 0;
}

GSStream GSInterface::createStream(uint8_t type, uint8_t deviceId)
{
    // associate metrics
    bool hasDeviceId = false;
    int i;
    for (i = 0; i < this->numMetrics; i++)
    {
        if (this->deviceIdArr[i] == deviceId)
        {
            hasDeviceId = true;
            break;
        }
    }

    if (!hasDeviceId && this->numMetrics < 10)
    {
        this->deviceIdArr[numMetrics] = deviceId;
        this->metricsArr[numMetrics] = new Metrics(deviceId);
        return GSStream(type, streamIndex++, this->metricsArr[numMetrics++]);
    }

    return GSStream(type, streamIndex++, this->metricsArr[i]);
}

// debug functions
void GSInterface::log(const char *str1, const char *str2, const char *str3)
{
    if (this->sd != nullptr && this->debugBaud > 0)
    {
#ifdef ARDUINO
        this->sd->print(str1);
        this->sd->print(str2);
        this->sd->print(str3);
        this->sd->write("\n");
#endif
    }
}

// private methods

// serial communication abstractions

int GSInterface::available()
{
#ifdef ARDUINO
    return this->s->available();
#else
    return 0;
#endif
}

int GSInterface::write(char *s, uint32_t length)
{
#ifdef ARDUINO
    return this->s->write(s, length);
#endif
}

void GSInterface::writeC(char c)
{
#ifdef ARDUINO
    this->s->write(c);
#endif
}

int GSInterface::read(char *s, uint32_t length)
{
#ifdef ARDUINO
    uint32_t addedLength = 0;
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
#ifdef ARDUINO
    return this->s->read();
#else
    return 0;
#endif
}

uint32_t GSInterface::time()
{
#ifdef ARDUINO
    return millis();
#else
    return 0;
#endif
}
