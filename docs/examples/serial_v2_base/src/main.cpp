#include <Arduino.h>
#include "RadioMessage.h"

uint32_t timer = millis();
uint32_t timer2 = millis();
Message m;
Message m2;

bool handshakeSuccess = false;
bool handshakeAttempt = false;
bool foundNewline = false;
int bytesAvail = 0;
char serialBuf[25] = {0}; // Note: this length is used in some if conditions

void setup()
{
  Serial.begin(115200);

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

  GSData dataTest(APRSTelem::TYPE, 1, stageOneM.buf, stageOneM.size);

  m.encode(&dataTest);

  GSData dataTest2(APRSTelem::TYPE, 2, stageOneM2.buf, stageOneM2.size);

  m2.encode(&dataTest2);
}

void loop()
{
  // check if handshake is being initiated
  if (!handshakeAttempt && ((bytesAvail = Serial.available()) > 0))
  {
    if (foundNewline)
      memset(serialBuf, 0, sizeof(serialBuf));
    foundNewline = false;
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
    }
    if (foundNewline)
    {
      if (strcmp(serialBuf, "handshake") == 0)
      {
        memset(serialBuf, 0, sizeof(serialBuf));
        handshakeSuccess = false;
        handshakeAttempt = true;
      }
      if (strcmp(serialBuf, "success") == 0)
      {
        memset(serialBuf, 0, sizeof(serialBuf));
        handshakeSuccess = true;
      }
      foundNewline = false;
    }
  }

  // complete the handshake
  if (handshakeAttempt && ((bytesAvail = Serial.available()) > 0))
  {
    foundNewline = false;
    for (int i = 0; i < bytesAvail; i++)
    {
      char c = Serial.read();
      if (c != '\0')
      {
        Serial.write(c);
        if (c == '\n')
        {
          foundNewline = true;
          break;
        }
      }
    }
    if (foundNewline)
    {
      handshakeAttempt = false;
    }
  }

  if (handshakeSuccess)
  {
    if (millis() - timer > 1000)
    {
      timer = millis();
      Serial.write(m.buf, m.size);
    }
    if (millis() - timer2 > 500)
    {
      timer2 = millis();
      Serial.write(m2.buf, m2.size);
    }
  }
}