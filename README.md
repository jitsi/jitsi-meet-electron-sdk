# Jitsi Meet Electron SDK

SDK for integrating Jitsi Meet into Electron applications.

The SDK is built for `contextIsolation: true` (and, where possible, `sandbox: true`)
on the window that hosts Jitsi Meet, following Electron's security guidelines. Native
code that used to run in the renderer (remote control via robotjs) now runs only in the
main process, and every renderer ↔ main message goes through a single, validated
`contextBridge` surface.

> **Upgrading from v9?** The single `require('@jitsi/electron-sdk')` entry has been
> removed and replaced by three context-specific entry points. See
> [Migrating from v9](#migrating-from-v9).

## Installation

Install from npm:

    npm install @jitsi/electron-sdk

Note: This package contains native code on Windows for the remote control module. Binary
prebuilds are packaged with prebuildify as part of the npm package. `@jitsi/robotjs` is a
dependency but is only ever loaded in the main process.

## Architecture

The SDK ships three entry points, each named after the Electron context its code runs in.
There is **no default (`.`) entry** — importing `@jitsi/electron-sdk` directly fails with a
module-resolution error by design.

| Entry point | Runs in | Exposes |
| --- | --- | --- |
| `@jitsi/electron-sdk/main` | Electron **main process** | `setupRemoteControlMain`, `setupScreenSharingMain`, `setupPowerMonitorMain`, `cleanupPowerMonitorMain`, `setupPictureInPictureMain`, `initPopupsConfigurationMain`, `getPopupTarget`, `popupsConfigRegistry` |
| `@jitsi/electron-sdk/preload` | app **preload** script | side-effect import that installs `window.jitsiElectronSDK` via `contextBridge` |
| `@jitsi/electron-sdk/renderer` | the **page** ("main world") | `setupRemoteControlRender`, `setupScreenSharingRender`, `setupPowerMonitorRender`, `setupPictureInPictureRender`, `initPopupsConfigurationRender` |

```
╔═ renderer process ═══════════════════════════════════════════════╗
║  page / "main world"  →  @jitsi/electron-sdk/renderer             ║
║    owns api.* events + postis; no electron/node/native requires   ║
║                     │  window.jitsiElectronSDK (validated bridge) ║
║  preload / isolated  →  @jitsi/electron-sdk/preload               ║
║    thin ipcRenderer wrappers, per-feature, payload-validated      ║
╚═════════════════════│═════════════════════════════════════════════╝
                      │  IPC — namespaced, sender-validated channels
┌═ main process ══════┴═════════════════════════════════════════════┐
│  @jitsi/electron-sdk/main  →  setup*Main (+ robotjs execution)     │
└───────────────────────────────────────────────────────────────────┘
```

### The bridge (`window.jitsiElectronSDK`)

The preload entry exposes one namespaced object to the page. Renderer code never touches
`ipcRenderer` directly — it talks to the main process only through this surface. Only
cloneable data crosses the bridge; callbacks are supported as subscriptions that return an
unsubscribe function. The object carries an `apiVersion`; every bridge-backed `setup*Render`
throws a descriptive error if the preload is missing, was created without context isolation,
or its `apiVersion` does not match the renderer build — so a stale or absent preload fails
fast instead of silently doing nothing. (`initPopupsConfigurationRender` is the one
exception: it is a no-op and does not use the bridge.)

## Setup

### 1. Window configuration

Create the window that hosts Jitsi Meet with context isolation on and a preload that
installs the bridge:

```Javascript
const jitsiMeetWindow = new BrowserWindow({
    webPreferences: {
        contextIsolation: true,
        sandbox: true, // robotjs no longer runs in the renderer, so the page can be sandboxed
        preload: '/absolute/path/to/your/bundled/preload.js'
    }
});
```

### 2. Preload script

A sandboxed preload cannot `require` from `node_modules`, so the app's preload must be
bundled (esbuild, webpack, etc.). Import the SDK preload for its side effect:

```Javascript
// app preload (bundled)
import '@jitsi/electron-sdk/preload';
```

### 3. Main process

Set up the main-process components **before** the renderer components, and clean handlers
up on window close to prevent leaks:

```Javascript
const { setupScreenSharingMain } = require('@jitsi/electron-sdk/main');

setupScreenSharingMain(jitsiMeetWindow, appName, osxBundleId);
```

### 4. Renderer

Bundle the renderer entry into the app's page code and call the `setup*Render` helpers with
the live `JitsiMeetExternalAPI` instance:

```Javascript
import { setupScreenSharingRender } from '@jitsi/electron-sdk/renderer';

// api - the JitsiMeetExternalAPI instance created by the page.
setupScreenSharingRender(api);
```

## Usage

The `setup*` function names and signatures are unchanged from v9 — only the entry point you
import them from has changed.

### Remote Control

Enables remote desktop control during a Jitsi Meet session. Mouse/keyboard events are
forwarded over the bridge and executed in the main process by robotjs; the renderer never
loads a native module.

**Requirements**:
1. Jitsi Meet must be initialized through the [iframe API](https://github.com/jitsi/jitsi-meet/blob/master/doc/api.md).
2. `setupRemoteControlRender` requires the Jitsi Meet iframe API object.

In the **main** process:

```Javascript
const { setupRemoteControlMain } = require('@jitsi/electron-sdk/main');

// jitsiMeetWindow - the BrowserWindow where Jitsi Meet is loaded.
setupRemoteControlMain(jitsiMeetWindow);
```

In the **renderer** (page hosting Jitsi Meet):

```Javascript
import { setupRemoteControlRender } from '@jitsi/electron-sdk/renderer';

// api - the Jitsi Meet iframe api object.
const remoteControl = setupRemoteControlRender(api);
```

To disable remote control:

```Javascript
remoteControl.dispose();
```

NOTE: `dispose` is called automatically on the Jitsi Meet API `readyToClose` event or when
the iframe API's own `dispose` method runs.

### Screen Sharing

Custom screen/window picker plus an always-on-top "X is sharing your screen" tracker window.

In the **main** process:

```Javascript
const { setupScreenSharingMain } = require('@jitsi/electron-sdk/main');

// jitsiMeetWindow - the BrowserWindow where Jitsi Meet is loaded.
// appName     - shown in the tracker window: "{appName} is sharing your screen".
// osxBundleId - macOS bundle id; screen-capture permissions are reset if the user denied them.
setupScreenSharingMain(jitsiMeetWindow, appName, osxBundleId);
```

In the **renderer**:

```Javascript
import { setupScreenSharingRender } from '@jitsi/electron-sdk/renderer';

// api             - the Jitsi Meet iframe api object.
// loggerTransports - optional array of @jitsi/logger transports.
setupScreenSharingRender(api, loggerTransports);
```

### Picture in Picture

Enables the browser's native picture-in-picture for the active speaker video, so users can
keep it in a floating window while using other applications.

**Requirements**:
1. Jitsi Meet must be initialized through the [iframe API](https://github.com/jitsi/jitsi-meet/blob/master/doc/api.md).
2. The main process executes the PiP request with userGesture privileges to bypass browser
   transient-activation restrictions.

In the **main** process:

```Javascript
const { setupPictureInPictureMain } = require('@jitsi/electron-sdk/main');

// jitsiMeetWindow  - the BrowserWindow where Jitsi Meet is loaded.
// loggerTransports - optional array of @jitsi/logger transports.
const pipMain = setupPictureInPictureMain(jitsiMeetWindow, loggerTransports);
```

In the **renderer**:

```Javascript
import { setupPictureInPictureRender } from '@jitsi/electron-sdk/renderer';

// api              - the JitsiMeetExternalAPI instance.
// loggerTransports - optional array of @jitsi/logger transports.
const pipRender = setupPictureInPictureRender(api, loggerTransports);
```

### Power Monitor

Query Electron for system idle state and receive power-monitor events (suspend, resume,
lock, unlock).

In the **main** process:

```Javascript
const { setupPowerMonitorMain, cleanupPowerMonitorMain } = require('@jitsi/electron-sdk/main');

// jitsiMeetWindow - the BrowserWindow where Jitsi Meet is loaded.
setupPowerMonitorMain(jitsiMeetWindow);

// On shutdown, tear down all power-monitor hooks:
// cleanupPowerMonitorMain();
```

In the **renderer**:

```Javascript
import { setupPowerMonitorRender } from '@jitsi/electron-sdk/renderer';

setupPowerMonitorRender(api);
```

### Popups Configuration

Configures handling of popup windows for OAuth authentication flows (Google, Dropbox). It
sets a `setWindowOpenHandler` on the Jitsi Meet window that allows OAuth popups and delegates
all other `window.open` requests to a handler you provide.

In the **main** process:

```Javascript
const { shell } = require('electron');
const { initPopupsConfigurationMain } = require('@jitsi/electron-sdk/main');

// Called for window.open requests that are not OAuth popups.
const windowOpenHandler = ({ url }) => {
    shell.openExternal(url); // open external links in the default browser
    return { action: 'deny' };
};

// jitsiMeetWindow    - the BrowserWindow where Jitsi Meet is loaded.
// windowOpenHandler  - optional; if omitted, non-OAuth window.open requests are denied.
initPopupsConfigurationMain(jitsiMeetWindow, windowOpenHandler);
```

`initPopupsConfigurationRender(api)` is exported from the renderer entry for API
compatibility but is a no-op.

## Migrating from v9

v10 is a breaking release. The public API functions are the same; what changed is how you
load them and how the window is configured.

- **The default entry is gone.** `require('@jitsi/electron-sdk')` no longer resolves. Import
  from `@jitsi/electron-sdk/main`, `@jitsi/electron-sdk/preload`, or
  `@jitsi/electron-sdk/renderer` depending on where the code runs.
- **The Jitsi Meet window must use `contextIsolation: true`.** Because robotjs left the
  renderer, that window can also run with `sandbox: true`.
- **Add the preload import.** The app's (bundled) preload must
  `import '@jitsi/electron-sdk/preload'` so `window.jitsiElectronSDK` is installed. Renderer
  code no longer receives `ipcRenderer` and must not assign the SDK helpers onto `window`
  itself.
- **Move `setup*Render` calls into the app's renderer bundle** and call them directly with
  the `JitsiMeetExternalAPI` instance (instead of via a `window.*` object bridged from the
  preload). The signatures are unchanged.

Apps that must stay on `contextIsolation: false` can pin to `@jitsi/electron-sdk@9`.

## Example

For a full integration example see the
[Jitsi Meet Electron](https://github.com/jitsi/jitsi-meet-electron) project.

## Development

Enable husky to avoid accidental pushes to the main branch:

    npx husky install

To rebuild the native code (Windows), use:

    npx node-gyp rebuild

## Publishing

On every push to the `master` branch, `.github/workflows/ci.yml` creates a new version and
publishes to npm. For a major or minor release, use the respective keywords in the commit
message — see the
[gh-action-bump-version workflow](https://github.com/phips28/gh-action-bump-version#workflow).
</content>
</invoke>
