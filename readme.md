# Terp Rockets Ground Station
An [Electron](https://www.electronjs.org/) based ground station user interface to display and log radio communications recieved over serial. Supports displaying APRS telemetry and AV1 video from the radio downlink, and sending commands via the radio uplink.

## Installation
The easiest way to install is to download the executable for your platform if it is available for the latest release. However, you can also build the application from source.

First, make sure to install [Node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/). If you are on Windows, you will also need the Mingw64 terminal from the [MSYS environment](https://www.msys2.org/).

Then, open a regular terminal and install depedencies.
```bash
npm install 
```

If you want to generate an installer in addition to the basic zip file, add the maker for your platform from ```makers.txt``` under ```config.makers``` in package.json.
```json
{
//...

"config": {
    "forge": {
      "packagerConfig": {
        "icon": "assets/icon"
      },
      "makers": [
        {
          "name": "@electron-forge/maker-zip"
        }
        // add more makers here
      ]
    }
  },

//...
}
```

The following depedencies are required to build all features of the ground station. The text contained in parenthesis indicates if particular depedencies are only required for specific features, which can optionally not be built.
- GCC, G++
- NASM (video)
- Python3 (video)
- Meson (video)
- Diffutils (video)
- Make (video)

If you are on Linux, or if running directly from the Mingw64 terminal, build the ground station using the following command:
>**Note**
>While Linux support is planned in the near future, the serial driver will currently only compile for Windows. This is planned to be fixed in a future release.
```
chmod +x build.sh
./build.sh all
```
If you are in the Windows command prompt, run the following command:
```
build C:\path\to\mingw all
```
Where ```C:\path\to\mingw``` is the path to the directory where ```mingw64.exe``` is located.

The executable will be located under ```build/src``` and the output from the makers at ```out/make/<name of the maker>```. Additional detail about the build process can be found in the User Guide in ```docs/user_guide.pdf```.

## Usage
To get started, first plug in a device that will send messages over serial in the following format:

```javascript
"s\r\nSource:xxx,Destination:xxx,Path:xxx,Type:xxx,Data:xxx,RSSI:xxx\r\ne\r\n"
```
Where
- The x's represent data from the APRS message
- The RSSI must be a number
>**Note**
> If your radio does not give an RSSI value, simply set it to zero

The "Data" field is expected to be in the format:
```javascript
"!DDMM.hhd/DDDMM.hhd[hhh/sss/A=DDDDDD/S[s]/zzz/yyy/xxx/fff"
```
Where
- Latitude (```DDMM.hhd```): DD is degrees, MM.hh is minutes, and d is North (N) or South (S)
- Longitude (```DDDMM.hhd```): DDD is degrees, MM.hh is minutes, and d is East (E) or West (W)
- Heading (```hhh```): heading as an azimuth (0 to 359 degrees)
- Speed (```sss```): current speed in ft/s
- Altitude (```DDDDDD```): current altitude in ft (```-DDDDDD``` if negative)
- Stage (```S[s]```): the current stage (e.g., stage 0 would be ```S0```)
- Z orientation (```zzz```): current z angle in degrees (0 to 359 degrees)
- Y orientation (```yyy```): current y angle in degrees (0 to 359 degrees)
- X orientation (```xxx```): current x angle in degrees (0 to 359 degrees)
- State flags (```fff```): various user flags that represent the state of the rocket

For further information on data formatting and specifcally how to configure multiplexing see the User Guide.

### Connecting via the Main Window

To connect the application to the device, select it from the dropdown menu in the application's top bar. If your device is transmitting, you should see data begin to appear. You can check if the device is connected by the plug icon in the top bar. You can also see the signal strength of the receiver by the "wifi" icon in the top bar. The information available in main window is further explained in the User Guide.

>**Note**
>If data does not appear, open the debug window using the console icon in the top bar and check for an error message. Make sure the port is not already in use!
>The application's GUI can be reloaded using the reload icon in the top bar.

### Connecting via the Debug Window

The debug window relies on a command based system, similar to that in operating system terminals. To connect to the device from the debug window, use the command

```bash
serial -connect "port-name"
```

Where "port-name" is the name of the serial port (eg. COM5) to connect to without the quotation marks. To see the list of available connections, use the command

```bash
serial -list
```

Other available commands can be seen using the "help" command, and are explained in further detail in the user guide.

### Data
Received data is logged in ```.csv``` format and is placed in the ```/data``` directory under the name ```YYYY-MM-DDTHH-MM-SS.csv```.

## Configuration
Certain application settings can be configured using the settings page (the gear icon in the top bar), commands in the debug window, or by directly editing the ```config.json``` file.

The available configuration options are
- the main window scale, in case the main window is too big/small on different resolution screens
- the debug window scale, in case the debug window is too big/small on different resolution screens
- turn on/off debug mode, which will save recieved messages to test.json so they can be used without connecting to the device physically, log debug statements, and open the chromium dev tools used by Electron
- turn on/off noGUI mode, which will open the debug window instead of the main application window on startup
- turn on/off video mode, which activates the live video functionality (this functionality is documented in the User Guide)
- set the baud rate of the serial port connection for compatibility with different devices
- set the maximum size of the map tile cache so that it does not take up too much storage

## Future development

Features that may be added in the future include:
- Interface overhaul
- Multiplexing bandwidth improvements