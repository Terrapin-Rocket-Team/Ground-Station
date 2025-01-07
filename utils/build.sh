#!/bin/bash

CORES=1

cd ../utils

# build gsm utils
cd gsm
mkdir -p build 
cd build
cmake ..
make -j $CORES
cd ../../

cd ../build
