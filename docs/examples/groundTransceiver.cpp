/*
EXAMPLE CODE FOR GROUND TRANSCEIVER TEENSY
==========================================
This code is an example of how to use the ground transceiver Teensy. The Teensy is connected to the ground station computer via USB and communicates
with the ground station over serial. It's a transceiver as it may also send data in the case of commands being sent from the ground station to the 
rocket. This code will not work, but is a high-level example of how the Teensy would be used in the ground station.
*/

#include <Arduino.h>
#include <RadioFunctions.h>

// Define configurations for radios and communication settings
InitializeRadioSettings(radio1, freq1, pins1);
InitializeRadioSettings(radio2, freq2, pins2);
InitializeRadioSettings(radio3, freq3, pins3);

// Define headers for different types of data
uint8_t telemetryHeader = 0x01;
uint8_t video1header = 0x02;
uint8_t video2header = 0x03;

// Buffers to hold incoming data
CircularBuffer<uint8_t> buff1, buff2, buff3;

// Setup process
void setup() {

    // Initialize all radios
    if (!radio1.begin()) Print("Radio1 failed");
    if (!radio2.begin()) Print("Radio2 failed");
    if (!radio3.begin()) Print("Radio3 failed");
}

// Main loop
void loop() {
    // Check for incoming data on telemetry radio (radio3)
    if (RadioHasData(radio3)) {
        // Process and send telemetry data to ground station
        ProcessTelemetryData(radio3, buff3);
        SendDataToGroundStation(buff3, telemetryHeader);
    }

    if (RadioHasData(radio2)) {
        // Process and send telemetry data to ground station
        ProcessLiveVideo2(radio2, buff2);
        SendDataToGroundStation(buff2, video2header);
    }

    if (RadioHasData(radio1)) {
        // Process and send telemetry data to ground station
        ProcessLiveVideo1(radio1, buff1);
        SendDataToGroundStation(buff1, video1header);
    }

    // Listen for commands from the ground station
    if (SerialDataAvailable()) {
        // Receive and process the command
        Command cmd = ReceiveCommand();
        ProcessCommand(cmd, radio3);
    }
}

// Function to send data to the ground station
void SendDataToGroundStation(Buffer& buffer, uint8_t header) {
    // Send data to the ground station one byte at a time
    Serial.write(header);
    // pop off the top of the read end of the buffer
    Serial.write(buffer.pop());
}


// Function to process telemetry data
void ProcessTelemetryData(Radio radio, Buffer& buffer) {
    // Read data from radio
    Data telemetry = ReadTelemetryData(radio);
    
    // Convert telemetry data to a serial format
    ConvertToSerialFormat(telemetry, buffer);
}

// Function to receive commands from ground station
Command ReceiveCommand() {
    // Read command data from serial input
    Command cmd = ReadSerialData();
    
    // Return the processed command
    return cmd;
}

// Function to process and send the command via radio3
void ProcessCommand(Command cmd, Radio radio) {
    // Set up radio for command transmission
    PrepareForTransmission(radio, cmd);
    
    // Send the command via radio3
    SendCommand(radio, cmd);
}
