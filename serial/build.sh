#!/bin/bash

CORES=1

mkdir -p serial
cd serial
cmake ../../serial
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  cmake --build ./ --target DemuxLinux
  mkdir pipes
else
  cmake --build ./ --target DemuxWindows
fi
echo "FINISHED CMAKE BUILD"
cd ../serial
cd ..
