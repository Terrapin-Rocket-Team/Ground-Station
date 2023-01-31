# Terp Rockets Ground Station
A Node.js/[Electron](https://www.electronjs.org/) ground station user interface to display and log APRS messages recieved over serial

## Installation
The easiest way to install is to download the executable for your platform from the latest release. If you wish, you can also build the application from source.

Make sure to install [Node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/).

Then install depedencies.
```bash
npm install 
```

If you want to generate an installer in addtion to the basic zip file, add the maker for your platform from makers.txt under config.makers in package.json.
```json
{
...
"config": {
    "forge": {
      "packagerConfig": {
        "icon": "assets/icon"
      },
      "makers": [
        {
          "name": "@electron-forge/maker-zip"
        }
      ]
    }
  },
...
}
```

Then make the app using npm.
```bash
npm run make
```

The executable will be located under out/Terp Rockets Ground Station and the output from the makers at out/make/"name of the maker".

## Usage
To get started, first plug in a device that will send messages over serial in the following format:

```javascript
"s\r\nSource:xxx,Destination:xxx,Path:xxx,Type:xxx,Data:xxx,RSSI:xxx\r\ne\r\n"
```
Where
- The x's represent data from the APRS message
- The RSSI must be a number
>**Note**
> If you do not have an RSSI, simply set it to zero

Data is expected to be in the format:
```javascript
"!DDMM.hhd/DDDMM.hhd[hhh/sss/A=aaaaaa/Sx/HH:MM:SS"
```
Where 
- DDMM.hhd is latitude in degrees(DD), minutes(MM.hh), and N or S(d)
- DDDMM.hhd is latatude in the same format but with 3 digits for degrees
- hhh is the heading
- sss is the speed
- aaaaaa is the altitude (-aaaaaa if negative)
- Sx is the current stage (ex. S0 for stage 0)
- HH:MM:SS is the t0 time that format

To connect the application to the device, select it from the dropdown menu in the application's top bar. If your device is transmitting, you should see data begin to appear.

>**Note**
>If data does not appear, open the debug window using the console icon in the top bar and check for an error message. Make sure the port is not already in use!
>If the UI stops working the application can be reloaded without closing using the reload icon in the top bar.

The data is logged in .csv format and is placed in the same directory as the application.

## Configuration
There are a few configuration options available in the config.json file, which is also in the same directory as the application.

From here, you can modify
- the application window and debug window scale (in case the application windows are too big/small on different resolution screens)
- turn on debug mode (which will save recieved messages to test.json so they can be used without connecting to the device physically, logs debug statements, and opens the chromium dev tools used by Electron)
- and turn on noGUI mode (which will only open the debug window)

## Future development

Plans for future development include
- Add APRS IGate capability
- Separate processes so that data will still be logged even if the main application crashes
- Expand configuration options and add settings menu