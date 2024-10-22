#!/bin/bash

CORES=1

mkdir -p serial
cd serial
rm CMakeCache.txt
cmake ../../serial
make -j $CORES
cd ../serial
cd ..