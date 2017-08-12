# jitsi-meet-electron-utils
Utilities for jitsi-meet-electron project.

## Installation
jitsi-meet-electron-utils contains native code for some utilities. You'll need [node-gyp](https://github.com/nodejs/node-gyp) to build it and also you'll need to rebuild the package for Electron. For more information see [Using Native Node Modules](https://github.com/electron/electron/blob/master/docs/tutorial/using-native-node-modules.md) and [electron-rebuild](https://github.com/electron/electron-rebuild).

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
```Javascript
const {
    setupScreenSharingForWindow
} = require("jitsi-meet-electron-utils");

// iframe - the Jitsi Meet iframe
setupScreenSharingForWindow(iframe);
```

#### Always On Top
Displays a small window with the current active speaker video when the main Jitsi Meet window is not focused.

**Requirements**:
1. Jitsi Meet should be initialized through our [iframe API](https://github.com/jitsi/jitsi-meet/blob/master/doc/api.md)
2. The `BrowserWindow` instance where Jitsi Meet is displayed should use the [Chrome's window.open implementation](https://github.com/electron/electron/blob/master/docs/api/window-open.md#using-chromes-windowopen-implementation) (set `nativeWindowOpen` option of `BrowserWindow`'s constructor to `true`).
3. If you have a custom handler for opening windows you have to filter the always on top window. You can do this by its `frameName` argument which will be set to `AlwaysOnTop`.

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
setupAlwaysOnTopRender(api);
```
## Example

For examples of installation and usage checkout the [Jitsi Meet Electron](https://github.com/jitsi/jitsi-meet-electron) project.
