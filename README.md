# jitsi-meet-electron-utils
Utilities for jitsi-meet-electron project.

## Installation
jitsi-meet-electron-utils contains native code for some utilities. You'll need [node-gyp](https://github.com/nodejs/node-gyp) to build it and also you'll need to rebuild the package for Electron. For more information see [Using Native Node Modules](https://github.com/electron/electron/blob/master/docs/tutorial/using-native-node-modules.md) and [electron-rebuild](https://github.com/electron/electron-rebuild).

## Usage
```Javascript
const {
    RemoteControl,
    setupScreenSharingForWindow
} = require("jitsi-meet-electron-utils");
```

* **Remote Control** - The remote control utility requires iframe HTML Element that will load Jitsi Meet.

Enable the remote control:
```Javascript
const remoteControl = new RemoteControl(iframe/* the Jitsi Meet iframe */);
```

To disable the remote control:
```Javascript
remoteControl.dispose();
```

NOTE: `dispose` method will be called automatically when the Jitsi Meet iframe unload.

* **Desktop Sharing**
```Javascript
setupScreenSharingForWindow(iframe.contentWindow);
```

## Example

For examples of installation and usage checkout the [Jitsi Meet Electron](https://github.com/jitsi/jitsi-meet-electron) project.
