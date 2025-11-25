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
1. Jitsi Meet should be initialized through our [iframe API](https://github.com/jitsi/jitsi-meet/blob/master/doc/api.md)
2. The remote control utility requires the Jitsi Meet iframe API object.

**Enable the remote control:**

In the **render** electron process of the window where Jitsi Meet is displayed:

```Javascript
const {
    setupRemoteControlRender
} = require("@jitsi/electron-sdk");

// api - The Jitsi Meet iframe api object.
const remoteControl = setupRemoteControlRender(api);
```

To disable the remote control:
```Javascript
remoteControl.dispose();
```

NOTE: `dispose` method will be called automatically when the Jitsi Meet API  `readyToClose` event or when the `dispose` method of the Jitsi Meet iframe API object.

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

#### Picture in Picture

Enables the browser's native picture-in-picture functionality for the active speaker video. This allows users to keep the active speaker video visible in a floating window while using other applications.

**Requirements**:
1. Jitsi Meet should be initialized through the [iframe API](https://github.com/jitsi/jitsi-meet/blob/master/doc/api.md)
2. The feature requires Electron's main process to execute the PiP request with userGesture privileges to bypass browser security restrictions

**Enable picture in picture:**

In the **main** electron process:

```Javascript
const {
    setupPictureInPictureMain
} = require("@jitsi/electron-sdk");

// jitsiMeetWindow - The BrowserWindow instance where Jitsi Meet is loaded.
// loggerTransports - Optional array of logger transports for configuring the logger.
const pipMain = setupPictureInPictureMain(jitsiMeetWindow, loggerTransports);
```

In the **render** electron process of the window where Jitsi Meet is displayed:

```Javascript
const {
    setupPictureInPictureRender
} = require("@jitsi/electron-sdk");

const api = new JitsiMeetExternalAPI(...);
const pipRender = setupPictureInPictureRender(api);
```

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
