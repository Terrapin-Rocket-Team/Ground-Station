#!/bin/bash

CORES=1

mkdir -p serial
cd serial
rm CMakeCache.txt
cmake ../../serial
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  cmake --build ./ --target DemuxShell
  mkdir -p pipes
else
  cmake --build ./ --target DemuxWindows
fi
echo "FINISHED CMAKE BUILD"
cd ../serial
cd ..
