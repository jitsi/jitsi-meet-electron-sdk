# jitsi-meet-electron-utils
Utilities for jitsi-meet-electron project.

## Installation
jitsi-meet-electron-utils contains native code for some utilities. You'll need [node-gyp](https://github.com/nodejs/node-gyp) to build it and also you'll need to rebuild the package for Electron. For more information see [Using Native Node Modules](https://github.com/electron/electron/blob/master/docs/tutorial/using-native-node-modules.md) and [electron-rebuild](https://github.com/electron/electron-rebuild).

## Usage
```Javascript
const utils = require("jitsi-meet-electron-utils");
const {
    RemoteControl,
    setupScreenSharingForWindow
} = utils;
```

* **Remote Control** - The remote control utility requires iframe HTML Element with loaded Jitsi Meet.
```Javascript
const remoteControl = new RemoteControl(iframe/* the Jitsi Meet iframe */);
...
...
...
remoteControl.dispose();
```
* **Desktop Sharing**
```Javascript
setupScreenSharingForWindow(window/* the Jitsi Meet window object */);
```
If Jitsi Meet is loaded in an iframe HTML element which is stored in the `iframe` variable, the code will look like:
```Javascript
setupScreenSharingForWindow(iframe.contentWindow);
```

## Example

For examples of installation and usage checkout the [Jitsi Meet Electron](https://github.com/jitsi/jitsi-meet-electron) project.

## Discuss
Please use the [Jitsi dev mailing list](http://lists.jitsi.org/pipermail/dev/) to discuss feature requests before opening an issue on Github.
