# Terp Rockets Ground Station
An [Electron](https://www.electronjs.org/) based ground station user interface to display and log radio communications recieved over Serial. It supports displaying APRS telemetry and AV1 video from the radio downlink, and sending commands via the radio uplink. It provides high flexibility by allowing for the configuration of a variable number of data input streams of multiple different types.

## Installation
The easiest way to install is to download the executable for your platform if it is available for the latest release. However, you can also build the application from source.

First, make sure to install [Node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/). If you are on Windows, you will also need the Mingw64 terminal from the [MSYS environment](https://www.msys2.org/).

When cloning the ground station, be sure to run ```git clone``` or ```git pull``` with the ```--recurse-submodules``` option, as the ground station requires some submodules in order to build. The following depedencies are required to build all features of the ground station. The text contained in parenthesis indicates if particular depedencies are only required for specific optional features, which do not have to be built.
- GCC, G++
- CMake
- NASM (video)
- Python3 (video)
- Meson (video)
- Diffutils (video)
- Make (video)

These dependencies need to be installed and available in your terminal on Linux, or in the MSYS Mingw environment on Windows.

>**Note**
>The ground station has been tested on Windows 11 and some Linux distros (Fedora and Manjaro) and is expected to work in these environments. Other environments may work but have not been tested (including MacOS).

If you are on Linux, or if running directly from the Mingw64 terminal, navigate to the ground station source directory and build using the following command:

```
chmod +x build.sh
./build.sh all
```
If you are in the Windows command prompt, run the following command:
```
build C:\path\to\mingw all
```
Where ```C:\path\to\mingw``` is the path to the directory where ```mingw64.exe``` is located.

The executable will be located under ```build/src```. Additional detail about the build process can be found in the User Guide in ```docs/user_guide.pdf```.

## Usage
To get started, first plug in a device that will send messages over Serial in the multiplexing format specified by the Message library. In addition to the proper multiplexing format, the device will also need to respond to a handshake sequence before any data is read. An example implementation of available features is available in ```docs/examples/serial_v2_base```.

The following input types are currently supported by the ground station:
- APRSTelem
- APRSText
- VideoData
- Metrics

The following output types are currently supported by the ground station:
- APRSCmd

For further information on data formatting and how to configure multiplexing see the User Guide.

### Connecting via the Main Window

To connect the application to the device, select it from the dropdown menu in the application's top bar. If your device is transmitting, you should see data begin to appear. You can check if the device is connected by the plug icon in the top bar. You can also see the signal strength of individual receivers by the "wifi" icons at the bottom of the main window. The information available in main window is further explained in the User Guide.

>**Note**
>If data does not appear, ensure the connection to your Serial device was successful by making sure there is not an X on the plug icon in the top bar. For additional troubleshooting, look for error messages in the ```debug.log``` and ```log/serial_driver_debug.log``` files.
>The application's GUI can be reloaded using the reload icon in the top bar.

### Data
Received data is logged for each stream in ```.csv``` format and is placed in the ```/data``` directory under the name ```[stream-name]_YYYY-MM-DDTHH-MM-SS.csv```. Where ```[stream-name]``` corresponds to the name and index of each stream.

## Configuration
Certain application settings can be configured using the streams page and the settings page. The streams page can be used to configure the number of incoming data streams and the type of each data stream. The settings page is used to configure general application settings.

### The Streams Page

The streams page allows adding, removing, and configuring the available data streams read from the multiplexed Serial input. For each stream the following options can be configured:
- Name
- Type
- Stream ID

Additionally, for telemetry streams, a maximum of 32 bits of stateflags can be configured per stream by clicking on the gear icon.

The streams page also allows the user to configure the commands available in the main page and the stateflags available for each telemetry stream. Each command has options to configure the:
- Name
- Function Name (to be used in the flight computer)
- Up to 16 arguments of up to 16 bits total

Each stateflag can be configured with its:
- Name
- Width (in bits)
- Function Name

Example configuration files for commands and stateflags are available in ```docs/configs```.

### The Settings Page

The available configuration options are:
- the main window scale, in case the main window is too big/small on different resolution screens
- turn on/off debug mode, which logs debug statements, and opens the chromium dev tools used by Electron
- turn on/off data debug mode, which reads data from ```.csv``` fils on the local machine as if it were coming from a Serial device
- turn on/off Serial driver debug mode, which reads data from a ```.gsm``` file to test the Serial driver and simulate reading multiplexed data
- turn on/off video mode, which activates the live video functionality (this functionality is documented in the User Guide)
- set the baud rate of the Serial port connection for compatibility with different devices
- set the maximum size of the map tile cache so that it does not take up too much storage

## Future development

Features that may be added in the future include:
- Video window overhaul
- Additional information tabs
- Additional visualizations