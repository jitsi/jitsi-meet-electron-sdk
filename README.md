# Jitsi Meet Electron SDK

SDK for integrating Jitsi Meet into Electron applications.

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
const setupRemoteControlRender = require('@jitsi/electron-sdk/remotecontrol/render');

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
const setupRemoteControlMain = require('@jitsi/electron-sdk/remotecontrol/main');

// jitsiMeetWindow - The BrowserWindow instance of the window where Jitsi Meet is loaded.
setupRemoteControlMain(mainWindow);
```

#### Screen Sharing

**Requirements**:
The screen sharing utility requires iframe HTML Element that will load Jitsi Meet.

**Enable the screen sharing:**

In the **render** electron process of the window where Jitsi Meet is displayed:

```Javascript
const setupScreenSharingRender = require('@jitsi/electron-sdk/screensharing/render');

// api - The Jitsi Meet iframe api object.
setupScreenSharingRender(api);
```
In the **main** electron process:

```Javascript
const setupScreenSharingMain = require('@jitsi/electron-sdk/screensharing/main');

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
const setupPictureInPictureMain = require('@jitsi/electron-sdk/pip/main');

// jitsiMeetWindow - The BrowserWindow instance where Jitsi Meet is loaded.
// loggerTransports - Optional array of logger transports for configuring the logger.
const pipMain = setupPictureInPictureMain(jitsiMeetWindow, loggerTransports);
```

In the **render** electron process of the window where Jitsi Meet is displayed:

```Javascript
const setupPictureInPictureRender = require('@jitsi/electron-sdk/pip/render');

const api = new JitsiMeetExternalAPI(...);

// api - The JitsiMeetExternalAPI instance.
// loggerTransports - Optional array of logger transports for configuring the logger.
const pipRender = setupPictureInPictureRender(api, loggerTransports);
```

#### Popups Configuration

Configures handling of popup windows for OAuth authentication flows (Google, Dropbox). This module sets up a `setWindowOpenHandler` on the Jitsi Meet window to allow OAuth popups while delegating other window.open requests to a custom handler provided by the host application.

**Enable popup configuration:**

In the **main** electron process:

```Javascript
const initPopupsConfigurationMain = require('@jitsi/electron-sdk/popupsconfig/main');

// jitsiMeetWindow - The BrowserWindow instance where Jitsi Meet is loaded.
// OAuth popups (Google, Dropbox) will be allowed, all other window.open requests will be denied.
initPopupsConfigurationMain(jitsiMeetWindow);
```

**With a custom window open handler:**

If your application needs to handle other window.open requests (e.g., opening external links in the default browser), pass your handler as the second parameter:

```Javascript
const { shell } = require('electron');
const initPopupsConfigurationMain = require('@jitsi/electron-sdk/popupsconfig/main');

// Define how to handle non-OAuth window.open requests
const windowOpenHandler = ({ url }) => {
    // Open external links in the default browser
    shell.openExternal(url);
    return { action: 'deny' };
};

// jitsiMeetWindow - The BrowserWindow instance where Jitsi Meet is loaded.
// windowOpenHandler - Called for window.open requests that are not OAuth popups.
initPopupsConfigurationMain(jitsiMeetWindow, windowOpenHandler);
```

The SDK handles OAuth popups (Google, Dropbox) internally, allowing them to open in Electron windows with secure settings. All other window.open requests are passed to your handler, which typically opens them in the system's default browser.

#### Power Monitor

Provides a way to query electron for system idle and receive power monitor events.

**enable power monitor:**
In the **main** electron process:
```Javascript
const { setupPowerMonitorMain } = require('@jitsi/electron-sdk/powermonitor/main');

// jitsiMeetWindow - The BrowserWindow instance
// of the window where Jitsi Meet is loaded.
setupPowerMonitorMain(jitsiMeetWindow);
```

In the **render** electron process of the window where Jitsi Meet is displayed:
```Javascript
const setupPowerMonitorRender = require('@jitsi/electron-sdk/powermonitor/render');

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

## Bundler / esbuild usage

By default `require('@jitsi/electron-sdk')` loads every feature module on
demand (lazy getters), but the modules themselves still contain static
`require('electron')` and native-addon calls that bundlers like esbuild cannot
analyse at build time.

### Use process-specific sub-path imports

Import only the sub-path you need.  This avoids pulling in the opposite
process's dependencies:

```javascript
// Main process only
const setupScreenSharingMain = require('@jitsi/electron-sdk/screensharing/main');
const setupRemoteControlMain  = require('@jitsi/electron-sdk/remotecontrol/main');
const { setupPowerMonitorMain, cleanupPowerMonitorMain } = require('@jitsi/electron-sdk/powermonitor/main');
const initPopupsConfigurationMain = require('@jitsi/electron-sdk/popupsconfig/main');
const setupPictureInPictureMain   = require('@jitsi/electron-sdk/pip/main');

// Renderer process only
const setupScreenSharingRender = require('@jitsi/electron-sdk/screensharing/render');
const setupRemoteControlRender  = require('@jitsi/electron-sdk/remotecontrol/render');
const setupPowerMonitorRender   = require('@jitsi/electron-sdk/powermonitor/render');
const initPopupsConfigurationRender = require('@jitsi/electron-sdk/popupsconfig/render');
const setupPictureInPictureRender   = require('@jitsi/electron-sdk/pip/render');
```

### Mark Electron and native addons as external

Add the following to your esbuild configuration so these modules are not
bundled but instead resolved at runtime by Electron:

```javascript
// esbuild.config.mjs (or equivalent)
import { build } from 'esbuild';

await build({
    // …your other options…
    external: [
        'electron',
        '@jitsi/robotjs',
        'node-gyp-build',
    ],
});
```

### Screen-sharing asset paths

`screensharing/main.js` ships two HTML/JS assets (`preload.js` and
`screenSharingTracker.html`) that must be readable from disk at runtime.
When you bundle the main process, esbuild inlines the JS but cannot relocate
those assets automatically.

Two exported constants tell you where the assets live inside the installed
package:

```javascript
const {
    SCREEN_SHARE_PRELOAD_PATH,
    SCREEN_SHARE_TRACKER_HTML_PATH,
} = require('@jitsi/electron-sdk/screensharing/main');
// or from the feature index:
// require('@jitsi/electron-sdk/screensharing')
```

**Option A – copy assets next to your bundle** (recommended for Electron Forge /
electron-builder):

Configure your bundler / packager to copy the two files into the app bundle,
then pass their new paths via the `options` argument:

```javascript
const path = require('path');

setupScreenSharingMain(jitsiMeetWindow, identity, osxBundleId, {
    preloadPath:    path.join(__dirname, 'assets', 'screensharing', 'preload.js'),
    trackerHtmlPath: path.join(__dirname, 'assets', 'screensharing', 'screenSharingTracker.html'),
});
```

**Option B – use the package path directly** (works when `node_modules` is
available at runtime, e.g. during development or without ASAR packing):

```javascript
// Pass the exported constants – they already point at the installed files.
setupScreenSharingMain(jitsiMeetWindow, identity, osxBundleId, {
    preloadPath:    SCREEN_SHARE_PRELOAD_PATH,
    trackerHtmlPath: SCREEN_SHARE_TRACKER_HTML_PATH,
});
```


## Publishing

On every push to main branch, the .github/workflows/ci.yml will create a new version and publish to npm.

If a major or minor release is required, use respective key words in the commit message, see https://github.com/phips28/gh-action-bump-version#workflow
