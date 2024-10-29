#!/bin/bash

mkdir -p icons
cd ../icons
node generateIcons
mv logo.icns ../build/icons
mv logo.ico ../build/icons
mv logo.png ../build/icons
cd ../build