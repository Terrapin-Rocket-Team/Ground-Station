#!/bin/bash

CORES=1

mkdir -p serial
cd serial
cmake ../../serial
make -j $CORES
cd ../serial
cd ..