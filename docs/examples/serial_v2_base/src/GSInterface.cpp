#include "GSInterface.h"

GSInterface::GSInterface(uint32_t baud, uint32_t debugBaud) : baud(baud), debugBaud(debugBaud) {}

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
            for (int i = 0; i < bytesAvail; i++)
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
                    this->handshakeSuccessCallback();

                    // we will start sending data, so setup metrics
                    telemMetrics.setInitialTime(millis());
                }
                else if (strcmp(this->serialBuf, "handshake failed") == 0)
                {
                    // the handshake was not successful
                    this->handshake = false;
                    this->handshakeFailedCallback();
                }
                else if (strcmp(this->serialBuf, "command") == 0)
                {
                    this->state = COMMAND;
                    this->commandStartCallback();

                    // the next text will be a radio command
                    commandMsg.clear();
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
            for (int i = 0; i < bytesAvail; i++)
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
            // read into serial buffer
            for (int i = 0; i < bytesAvail; i++)
            {
                commandMsg.append(this->readC());
                if (commandMsg.size >= Message::maxSize)
                    break;
            }
            bytesAvail = this->available();

            if (commandMsg.size >= GSData::headerLen)
            {
                // we can decode the header
                uint8_t type, id, deviceId = 0;
                GSData::decodeHeader(commandMsg.buf, type, id, deviceId, commandSize);
                if (type != APRSCmd::type || id == 0 || commandSize == 0)
                {
                    // this is not an APRSCmd, ignore it
                    this->state = READY;
                }
            }

            if (commandMsg.size - GSData::headerLen > commandSize && commandSize != 0)
            {
                // remove the extra bytes and put them in the serial buffer in case they are part of a different message
                uint16_t removed = (commandMsg.size - GSData::headerLen) - commandSize;
                commandMsg.pop((uint8_t *)this->serialBuf, removed);
                this->serialBufLength += removed;
            }
            if (commandMsg.size - GSData::headerLen == commandSize && commandSize != 0)
            {
                // we have the full command, so decode it
                GSData multiplexedCommand;
                commandMsg.decode(&multiplexedCommand);
                // send the actual command data
                commandMsg.clear();
                commandMsg.fill(multiplexedCommand.buf, multiplexedCommand.size);
                APRSCmd cmd;
                commandMsg.decode(&cmd);
                cmd.config = commandConfig;
                commandMsg.encode(&cmd);
                commandMsg.write(Serial); // TODO: send to radio
                // we are now finished handling the radio command on the Serial side
                this->state = READY;
            }
        }

        // add additional command handling here
    }

    if (this->handshake)
    {
        // output goes here

        // ==========================================================
        // Send sample data
        // ==========================================================
        if (millis() - timer > 1000)
        {
            timer = millis();
            Serial.write(m.buf, m.size);
            telemMetrics.update(m.size * 8, millis(), 0);
        }
        if (millis() - timer2 > 500)
        {
            timer2 = millis();
            Serial.write(m2.buf, m2.size);
            telemMetrics.update(m2.size * 8, millis(), 0);
        }
        if (millis() - timerMetrics > 1000)
        {
            timerMetrics = millis();
            metricsMessage.encode(&telemMetrics);
            metricsGSData.fill(metricsMessage.buf, metricsMessage.size);
            metricsMessage.encode(&metricsGSData);
            Serial.write(metricsMessage.buf, metricsMessage.size);
        }
        // ==========================================================
    }
}

// debug functions
void GSInterface::log(const char *str1, const char *str2, const char *str3)
{
#ifdef ARDUINO
    this->sd->print(str1);
    this->sd->print(str2);
    this->sd->print(str3);
    this->sd->write("\n");
#endif
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
int GSInterface::read(char *s, uint32_t length) {}
char GSInterface::readC()
{
#ifdef ARDUINO
    return this->s->read();
#else
    return 0;
#endif
}