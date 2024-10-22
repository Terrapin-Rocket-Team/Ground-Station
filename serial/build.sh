#!/bin/bash

mkdir -p serial
cd ../serial
g++ demux.cpp SerialPort.cpp -lgdi32 -o serial.exe
mv serial.exe ../build/serial
cd ../build