#!/bin/bash

CORES=1

mkdir -p coders
cd coders
if ! command -v ffmpeg  ; then
    curl -LO https://ffmpeg.org/releases/ffmpeg-7.0.1.tar.xz
    tar -xvf ffmpeg-7.0.1.tar.xz
    rm ffmpeg-7.0.1.tar.xz
fi
if ! command -v dav1d  ; then
    curl -LO https://downloads.videolan.org/pub/videolan/dav1d/1.4.2/dav1d-1.4.2.tar.xz
    tar -xvf dav1d-1.4.2.tar.xz
    rm dav1d-1.4.2.tar.xz
fi

if ! type ffmpeg &> /dev/null ; then
    echo "Unable to locate ffmpeg, will build and install"
    if ! type dav1d &> /dev/null ; then
        echo "Unable to locate dav1d, will build and install"
        mkdir -p dav1d-1.4.2/build && cd dav1d-1.4.2/build && meson setup -Denable_tools=false -Denable_tests=false --default-library=static .. && ninja && ninja install
        cd ../../ffmpeg-7.0.1 && ./configure --enable-libdav1d --disable-avdevice --disable-autodetect --extra-cflags="-I/mingw64/include" --extra-ldflags="-L/mingw64/lib"
        make -j $CORES
    fi
fi