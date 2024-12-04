#!/bin/bash

rm -rf src
mkdir -p src
# electron doesn't like copying pipes, so remove them if they exist
rm -rf serial/pipes/*
cd ..
npx electron-forge package
mv out/Terp\ Rockets\ Ground\ Station*/* build/src/
cd build/src/resources/app
rm -rf ./*.log
rm -f test.csv
rm -f config.json
rm -rf data
rm -rf src/cachedtiles
rm -f ./*.av1
rm -rf build/src
cd ../../../ # now in build
rm -rf ../out