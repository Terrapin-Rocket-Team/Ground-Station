#!/bin/bash

CORES=1

mkdir -p serial
cd serial

rm -f CMakeCache.txt
cmake ../../serial
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  mkdir -p pipes
fi
make -j $CORES
echo "FINISHED CMAKE BUILD"
cd ../serial
cd ..
