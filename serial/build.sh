#!/bin/bash

CORES=1

mkdir -p serial
cd serial

rm CMakeCache.txt
cmake ../../serial
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  mkdir -p pipes
fi
cmake --build ./
echo "FINISHED CMAKE BUILD"
cd ../serial
cd ..
