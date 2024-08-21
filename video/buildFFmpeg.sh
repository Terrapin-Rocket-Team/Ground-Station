#!/bin/bash

pacman -S gcc yasm nasm mingw-w64-x86_64-python3 mingw-w64-x86_64-meson diffutils make
cd video
curl -LO https://ffmpeg.org/releases/ffmpeg-7.0.1.tar.xz
tar -xvf ffmpeg-7.0.1.tar.xz
rm ffmpeg-7.0.1.tar.xz
curl -LO https://downloads.videolan.org/pub/videolan/dav1d/1.4.2/dav1d-1.4.2.tar.xz
tar -xvf dav1d-1.4.2.tar.xz
rm dav1d-1.4.2.tar.xz
mkdir dav1d-1.4.2/build && cd dav1d-1.4.2/build && meson.exe setup -Denable_tools=false -Denable_tests=false --default-library=static .. && ninja.exe && ninja.exe install
cd ../../ffmpeg-7.0.1 && ./configure --enable-libdav1d  --disable-avdevice --extra-cflags="-I/c/Utilities/mysys2/mingw64/include" --extra-ldflags="-L/c/Utilities/mysys2/mingw64/lib"
make