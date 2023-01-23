# Jitsi Meet Electron SDK

SDK for integrating Jitsi Meet into Electron applications.

Supported Electron versions: >= 16.

## Installation

Install from npm:

    npm install @jitsi/electron-sdk

Note: This package contains native code on Windows for the remote control module. Binary prebuilds are packaged with prebuildify as part of the npm package.

## Usage
#### Remote Control

**Requirements**:
The remote control utility requires iframe HTML Element that will load Jitsi Meet.

**Enable the remote control:**

In the **render** electron process of the window where Jitsi Meet is displayed:

```Javascript
const {
    RemoteControl
} = require("@jitsi/electron-sdk");

// iframe - the Jitsi Meet iframe
const remoteControl = new RemoteControl(iframe);
```

To disable the remote control:
```Javascript
remoteControl.dispose();
```

NOTE: `dispose` method will be called automatically when the Jitsi Meet iframe unload.

In the **main** electron process:

```Javascript
const {
    RemoteControlMain
} = require("@jitsi/electron-sdk");

// jitsiMeetWindow - The BrowserWindow instance of the window where Jitsi Meet is loaded.
const remoteControl = new RemoteControlMain(mainWindow);
```

#### Screen Sharing

**Requirements**:
The screen sharing utility requires iframe HTML Element that will load Jitsi Meet.

**Enable the screen sharing:**

In the **render** electron process of the window where Jitsi Meet is displayed:

```Javascript
const {
    setupScreenSharingRender
} = require("@jitsi/electron-sdk");

// api - The Jitsi Meet iframe api object.
setupScreenSharingRender(api);
```
In the **main** electron process:

```Javascript
const {
    setupScreenSharingMain
} = require("@jitsi/electron-sdk");

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

**Enable the aways on top:**

In the **main** electron process:
```Javascript
const {
    setupAlwaysOnTopMain
} = require("@jitsi/electron-sdk");

// jitsiMeetWindow - The BrowserWindow instance
// of the window where Jitsi Meet is loaded.
setupAlwaysOnTopMain(jitsiMeetWindow);
```

In the **render** electron process of the window where Jitsi Meet is displayed:
```Javascript
const {
    setupAlwaysOnTopRender
} = require("@jitsi/electron-sdk");

const api = new JitsiMeetExternalAPI(...);
const alwaysOnTop = setupAlwaysOnTopRender(api);

alwaysOnTop.on('will-close', handleAlwaysOnTopClose);
```

`setupAlwaysOnTopRender` return an instance of EventEmitter with the following events:

* _dismissed_ - emitted when the always on top window is explicitly dismissed via its close button

* _will-close_ - emitted right before the always on top window is going to close


#### Power Monitor

Provides a way to query electron for system idle and receive power monitor events.

**enable power monitor:**
In the **main** electron process:
```Javascript
const {
    setupPowerMonitorMain
} = require("@jitsi/electron-sdk");

// jitsiMeetWindow - The BrowserWindow instance
// of the window where Jitsi Meet is loaded.
setupPowerMonitorMain(jitsiMeetWindow);
```

In the **render** electron process of the window where Jitsi Meet is displayed:
```Javascript
const {
    setupPowerMonitorRender
} = require("@jitsi/electron-sdk");

const api = new JitsiMeetExternalAPI(...);
setupPowerMonitorRender(api);
```

### NOTE:
You'll need to add 'disable-site-isolation-trials' switch because of [https://github.com/electron/electron/issues/18214](https://github.com/electron/electron/issues/18214):
```
app.commandLine.appendSwitch('disable-site-isolation-trials')
```

## Example

For examples of installation and usage checkout the [Jitsi Meet Electron](https://github.com/jitsi/jitsi-meet-electron) project.

## Development

Enable husky to avoid accidental pushes to the main branch:

    npx husky install

To rebuild the native code, use:

    npx node-gyp rebuild

## Publishing

On every push to main branch, the .github/workflows/ci.yml will create a new version and publish to npm.

If a major or minor release is required, use respective key words in the commit message, see https://github.com/phips28/gh-action-bump-version#workflow
