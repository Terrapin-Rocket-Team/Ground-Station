#include <Arduino.h>

#include "RadioMessage.h"
#include "GSInterface.h"

#define TELEM_DEVICE_ID 3

// Command handling
Message commandMsg;
APRSConfig commandConfig = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};
uint16_t commandSize = 0;

// Data output storage and control variables
bool hasAvionicsTelem = false;
bool hasPayloadTelem = false;
APRSTelem *telem;

// create Ground Station Interface
GSInterface gsi(115200);

// create streams
GSStream telemAvionics = gsi.createStream(APRSTelem::type, TELEM_DEVICE_ID);
GSStream telemPayload = gsi.createStream(APRSTelem::type, TELEM_DEVICE_ID);

// ==========================================================
// Assemble sample data
// Note: not needed for real implementation
// ==========================================================
uint32_t timer = millis();
uint32_t timer2 = millis();

APRSConfig config = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};
double orientTest[3] = {1.0, 110.0, 65.0};
APRSTelem telem1(config, 39.336896667, -77.337067833, 480.0, 0.0, 31.0, orientTest, (uint32_t)0x15abcdef);

APRSConfig config2 = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};
double orientTest2[3] = {1.0, 110.0, 65.0};
APRSTelem telem2(config2, 39.336896667, -77.337067833, 400.0, 0.0, 3.0, orientTest2, (uint32_t)0x15abcdef);
// ==========================================================

void setup()
{
  // ==========================================================
  // Set up Ground Station Interface
  // ==========================================================
  if (!gsi.begin((HardwareSerial *)&Serial))
  {
    Serial.println("Error: GSI failed to begin");
  }

  if (CrashReport)
    Serial.println(CrashReport);
  // ==========================================================
}

void loop()
{
  // ==========================================================
  // Update GSI, needs to run as fast as possible
  // ==========================================================
  gsi.run();
  // ==========================================================

  // ==========================================================
  // Read data from radio and send to ground station
  // Note: the timers take the place of actually getting data
  // ==========================================================
  if (millis() - timer > 40)
  {
    timer = millis();
    if (gsi.isReady())
      gsi.writeStream(&telemAvionics, &telem1, -50);
  }
  if (millis() - timer2 > 40)
  {
    timer2 = millis();
    if (gsi.isReady())
      gsi.writeStream(&telemPayload, &telem2, -50);
  }
  // ==========================================================

  // ==========================================================
  // Check for commands from Ground Station
  // ==========================================================
  if ((commandSize = gsi.readStream((char *)commandMsg.buf, Message::maxSize)) > 0)
  {
    commandMsg.size = commandSize;
    APRSCmd cmd;
    commandMsg.decode(&cmd);
    cmd.config = commandConfig;
    commandMsg.encode(&cmd);
    // send commandMsg to radio here
  }
  // ==========================================================
}