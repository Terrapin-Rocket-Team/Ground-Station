#include <Arduino.h>

#include "RadioMessage.h"
#include "GSInterface.h"

#define TELEM_DEVICE_ID 3

// Command handling
Message commandMsg;
APRSConfig commandConfig = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};

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

APRSTelem telem1((APRSConfig){"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'},
                 39.336896667, -77.337067833, 480.0, 0.0, 31.0, (double[]){1.0, 110.0, 65.0}, (uint32_t)0x15abcdef);

APRSTelem telem2((APRSConfig){"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'},
                 39.336896667, -77.337067833, 400.0, 0.0, 3.0, (double[]){1.0, 110.0, 65.0}, (uint32_t)0x15abcdef);

APRSCmd cmd;
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
  // Note: data that needs manual handling may be deleted if
  //       not handled this loop
  // ==========================================================
  if (gsi.run())
  {
    // there is data that needs manual handling

    // check if that data is an APRSCmd
    if (gsi.input.dataType == APRSCmd::type)
    {
      gsi.readInput(&cmd);
      cmd.config = commandConfig;
      commandMsg.encode(&cmd);
      gsi.logM(LL_DEBUG, (char *)commandMsg.buf);
      // send commandMsg to radio here
    }

    // add more handlers here
  }
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
}