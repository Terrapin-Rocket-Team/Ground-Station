#include <Arduino.h>
#include "RadioMessage.h"

#define TELEM_DEVICE_ID 3

enum InputState
{
  HANDSHAKE,
  COMMAND,
  // add additional states as necessary
  NONE
};

// overall behavior control
bool handshakeSuccess = false;
bool hasDataHeader = false;

// Serial handling control
InputState currState = NONE;

// Serial communication handling
bool foundNewline = false;
int bytesAvail = 0;
char serialBuf[Message::maxSize] = {0};
int serialBufLength = 0;
Message commandMsg;
APRSConfig commandConfig = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};
uint16_t commandSize = 0;

// sample data variables
uint32_t timer = millis();
uint32_t timer2 = millis();
uint32_t timerMetrics = millis();
Message m;
Message m2;

// sample metrics implementation
Message metricsMessage;
Metrics telemMetrics(TELEM_DEVICE_ID);
GSData metricsGSData(Metrics::type, 4, TELEM_DEVICE_ID);

void setup()
{
  // Modify baud rate to match desired bitrate
  Serial.begin(115200);

  if (CrashReport)
  {
    Serial.println(CrashReport);
  }

  // ==========================================================
  // Assemble sample data
  // ==========================================================
  APRSConfig config = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};
  double orientTest[3] = {1.0, 110.0, 65.0};
  APRSTelem telem(config, 39.336896667, -77.337067833, 480.0, 0.0, 31.0, orientTest, (uint32_t)0x15abcdef);

  APRSConfig config2 = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};
  double orientTest2[3] = {1.0, 110.0, 65.0};
  APRSTelem telem2(config2, 39.336896667, -77.337067833, 400.0, 0.0, 3.0, orientTest2, (uint32_t)0x15abcdef);

  Message stageOneM;
  stageOneM.encode(&telem);

  Message stageOneM2;
  stageOneM2.encode(&telem2);

  GSData dataTest(APRSTelem::type, 1, TELEM_DEVICE_ID, stageOneM.buf, stageOneM.size);

  m.encode(&dataTest);

  GSData dataTest2(APRSTelem::type, 2, TELEM_DEVICE_ID, stageOneM2.buf, stageOneM2.size);

  m2.encode(&dataTest2);
  // ==========================================================
}

void loop()
{
  if (((bytesAvail = Serial.available()) > 0))
  {
    // check if a command is being sent
    if (currState == NONE)
    {
      for (int i = 0; i < bytesAvail; i++)
      {
        char c = Serial.read();
        if (c == '\n')
        {
          serialBuf[i] = 0;
          foundNewline = true;
          break;
        }
        serialBuf[i] = c;
        serialBufLength++;
        if (serialBufLength >= (int)sizeof(serialBuf))
          break;
      }
      bytesAvail = Serial.available();

      if (foundNewline)
      {
        if (strcmp(serialBuf, "handshake") == 0)
        {
          // begin the handshake
          handshakeSuccess = false;
          currState = HANDSHAKE;
        }
        else if (strcmp(serialBuf, "handshake succeeded") == 0)
        {
          // the handshake was successful
          handshakeSuccess = true;
          // we will start sending data, so setup metrics
          telemMetrics.setInitialTime(millis());
        }
        else if (strcmp(serialBuf, "handshake failed") == 0)
        {
          // the handshake was not successful
          handshakeSuccess = false;
        }
        else if (strcmp(serialBuf, "command") == 0)
        {
          // the next text will be a radio command
          commandMsg.clear();
          currState = COMMAND;
        }
        // add additional commands as required

        // reset serial buffer
        memset(serialBuf, 0, sizeof(serialBuf));
        foundNewline = false;
      }
    }

    // complete the handshake
    if (currState == HANDSHAKE)
    {
      for (int i = 0; i < bytesAvail; i++)
      {
        char c = Serial.read();
        // skip odd characters that accidently get added
        if (c != 0xff && c != 0)
        {
          Serial.write(c);
          if (c == '\n')
          {
            foundNewline = true;
            break;
          }
        }
      }
      bytesAvail = Serial.available();

      if (foundNewline)
      {
        foundNewline = false;
        currState = NONE;
      }
    }

    // receive the radio command
    if (currState == COMMAND)
    {
      // read into serial buffer
      for (int i = 0; i < bytesAvail; i++)
      {
        commandMsg.append(Serial.read());
        if (commandMsg.size >= Message::maxSize)
          break;
      }
      bytesAvail = Serial.available();

      if (commandMsg.size >= GSData::headerLen)
      {
        // we can decode the header
        uint8_t type, id, deviceId = 0;
        GSData::decodeHeader(commandMsg.buf, type, id, deviceId, commandSize);
        if (type != APRSCmd::type || id == 0 || commandSize == 0)
        {
          // this is not an APRSCmd, ignore it
          currState = NONE;
        }
      }

      if (commandMsg.size - GSData::headerLen > commandSize && commandSize != 0)
      {
        // remove the extra bytes and put them in the serial buffer in case they are part of a different message
        uint16_t removed = (commandMsg.size - GSData::headerLen) - commandSize;
        commandMsg.pop((uint8_t *)serialBuf, removed);
        serialBufLength += removed;
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
        currState = NONE;
      }
    }

    // add additional command handling here
  }

  if (handshakeSuccess)
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