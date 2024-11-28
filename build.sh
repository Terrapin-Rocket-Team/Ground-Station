#!/bin/bash

ALL=0
SRC=0
VIDEO=0
SERIAL=0
ICONS=0

if [ $# = 0 ] || [ $1 = "help" ] ; then
    echo "Usage: $0 [build_ags...]"
    echo "The following are valid build arguments:"
    echo "  all     : build all required dependencies and the main application (recommended)"
    echo "  src     : build the main application"
    echo "  coders  : build the video decoding dependencies"
    echo "  serial  : build the serial driver"
    echo "  icons   : build the icons"
    echo "  help    : display this message and exit"
    exit 0
fi

unlink ./build/serial/pipes/terpFcCommands
unlink ./build/serial/pipes/terpTelemetry
unlink ./build/serial/pipes/ffmpegVideoOne
unlink ./build/serial/pipes/ffmpegVideoTwo

while [ $# -gt 0 ] ; do

    case $1 in

    all)
        ALL=1
        shift
        ;;
    src)
        SRC=1
        shift
        ;;
    video)
        VIDEO=1
        shift
        ;;
    serial)
        SERIAL=1
        shift
        ;;
    icons)
        ICONS=1
        shift
        ;;
    *)
        echo "Unrecognized input, ignoring..."
        shift
        ;;
    esac
done

if [ $((($ALL + $SRC + $VIDEO + $SERIAL + $ICONS))) -gt 0 ] ; then

echo "Checking for build dependencies"
if ! type gcc &> /dev/null ; then
    echo "ERROR: Unable to locate gcc"
    exit 1
fi
if ! type g++ &> /dev/null ; then
    echo "ERROR: Unable to locate g++"
    exit 1
fi
if ! type nasm &> /dev/null ; then
    echo "ERROR: Unable to locate nasm"
    exit 1
fi
if ! type python &> /dev/null ; then
    echo "ERROR: Unable to locate python"
    exit 1
fi
if ! type meson &> /dev/null ; then
    echo "ERROR: Unable to locate meson"
    exit 1
fi
if ! type cmp &> /dev/null || ! type diff &> /dev/null ; then
    echo "ERROR: Unable to locate standard diffutils"
    exit 1
fi
if ! type make &> /dev/null ; then
    echo "ERROR: Unable to locate make"
    exit 1
fi
if ! type npm &> /dev/null ; then
    echo "ERROR: Unable to locate npm"
    exit 1
fi
if ! type node &> /dev/null ; then
    echo "ERROR: Unable to locate node"
    exit 1
fi

echo "Fetching packages"
npm install

echo "Starting build system"
mkdir -p build
cd build

# update perms
chmod +x ../icons/build.sh
chmod +x ../serial/build.sh
chmod +x ../coders/build.sh
chmod +x ../src/build.sh

# build dependencies first

if [ $ALL = 1 ] || [ $ICONS = 1 ] ; then ../icons/build.sh ; fi
if [ $ALL = 1 ] || [ $SERIAL = 1 ] ; then ../serial/build.sh ; fi
if [ $ALL = 1 ] || [ $VIDEO = 1 ] ; then ../coders/build.sh ; fi

# then build main
if [ $ALL = 1 ] || [ $SRC = 1 ] ; then ../src/build.sh ; fi

else

echo "No valid arguments provided, run $0 help for more information"
exit 1
fi