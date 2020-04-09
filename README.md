# jitsi-meet-electron-utils
Utilities for jitsi-meet-electron project.

## Installation
jitsi-meet-electron-utils contains native code for some utilities. You'll need [node-gyp](https://github.com/nodejs/node-gyp) to build it and also you'll need to rebuild the package for Electron. For more information see [Using Native Node Modules](https://github.com/electron/electron/blob/master/docs/tutorial/using-native-node-modules.md) and [electron-rebuild](https://github.com/electron/electron-rebuild).

NOTE: For Linux install libxtst-dev and libpng++-dev (`sudo apt-get install libxtst-dev libpng++-dev`). This dependancies are related to RobotJS which is a dependency of jitsi-meet-electron-utils. You can see the build instructions for RobotJS [here](https://github.com/jitsi/robotjs/tree/jitsi#building)

## Usage
#### Remote Control

**Requirements**:
The remote control utility requires iframe HTML Element that will load Jitsi Meet.

**Enable the remote control:**
```Javascript
const {
    RemoteControl
} = require("jitsi-meet-electron-utils");

// iframe - the Jitsi Meet iframe
const remoteControl = new RemoteControl(iframe);
```

To disable the remote control:
```Javascript
remoteControl.dispose();
```

NOTE: `dispose` method will be called automatically when the Jitsi Meet iframe unload.

#### Screen Sharing

**Requirements**:
The screen sharing utility requires iframe HTML Element that will load Jitsi Meet.

**Enable the screen sharing:**

In the **render** electron process of the window where Jitsi Meet is displayed:

```Javascript
const {
    setupScreenSharingRender
} = require("jitsi-meet-electron-utils");

// api - The Jitsi Meet iframe api object.
setupScreenSharingRender(api);
```
In the **main** electron process:

```Javascript
const {
    setupScreenSharingMain
} = require("jitsi-meet-electron-utils");

// jitsiMeetWindow - The BrowserWindow instance of the window where Jitsi Meet is loaded.
// appName - Application name which will be displayed inside the content sharing tracking window
// i.e. [appName] is sharing your screen.
// osxBundleId - Mac Application bundleId for which screen capturer permissions will be reset if user denied them.  
setupScreenSharingMain(mainWindow, appName, osxBundleId);
```


#### Always On Top
Displays a small window with the current active speaker video when the main Jitsi Meet window is not focused.

**Requirements**:
1. Jitsi Meet should be initialized through our [iframe API](https://github.com/jitsi/jitsi-meet/blob/master/doc/api.md)
2. The `BrowserWindow` instance where Jitsi Meet is displayed should use the [Chrome's window.open implementation](https://github.com/electron/electron/blob/master/docs/api/window-open.md#using-chromes-windowopen-implementation) (set `nativeWindowOpen` option of `BrowserWindow`'s constructor to `true`).
3. If you have a custom handler for opening windows you have to filter the always on top window. You can do this by its `frameName` argument which will be set to `AlwaysOnTop`.
4. Electron version `>=1.7.x`.

**Enable the aways on top:**

In the **main** electron process:
```Javascript
const {
    setupAlwaysOnTopMain
} = require("jitsi-meet-electron-utils");

// jitsiMeetWindow - The BrowserWindow instance
// of the window where Jitsi Meet is loaded.
setupAlwaysOnTopMain(jitsiMeetWindow);
```

In the **render** electron process of the window where Jitsi Meet is displayed:
```Javascript
const {
    setupAlwaysOnTopRender
} = require("jitsi-meet-electron-utils");

const api = new JitsiMeetExternalAPI(...);
const alwaysOnTop = setupAlwaysOnTopRender(api);

alwaysOnTop.on('will-close', handleAlwaysOnTopClose);
```

`setupAlwaysOnTopRender` return an instance of EventEmitter with the following events:

* _dismissed_ - emitted when the always on top window is explicitly dismissed via its close button

* _will-close_ - emitted right before the always on top window is going to close

#### WiFi Stats
Provides a function to query for wifi stats on the host computer. Returns information like interface name, addresses, signal quality, noise (not available on all OS).

**WiFi Stats:**

In the **render** electron process of the window where Jitsi Meet is displayed:
```Javascript
const {
    setupWiFiStats
} = require("jitsi-meet-electron-utils");

const api = new JitsiMeetExternalAPI(...);
setupWiFiStats(api.getIFrame());
```

#### Power Monitor
Provides a way to query electron for system idle and receive power monitor events.

**enable power monitor:**
In the **main** electron process:
```Javascript
const {
    setupPowerMonitorMain
} = require("jitsi-meet-electron-utils");

// jitsiMeetWindow - The BrowserWindow instance
// of the window where Jitsi Meet is loaded.
setupPowerMonitorMain(jitsiMeetWindow);
```

In the **render** electron process of the window where Jitsi Meet is displayed:
```Javascript
const {
    setupPowerMonitorRender
} = require("jitsi-meet-electron-utils");

const api = new JitsiMeetExternalAPI(...);
setupPowerMonitorRender(api);
```

### NOTE:
If you are using electron 5 you'll need to add 'disable-site-isolation-trials' switch because of [https://github.com/electron/electron/issues/18214](https://github.com/electron/electron/issues/18214):
```
app.commandLine.appendSwitch('disable-site-isolation-trials')
```

## Example

For examples of installation and usage checkout the [Jitsi Meet Electron](https://github.com/jitsi/jitsi-meet-electron) project.
