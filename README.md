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
| `@jitsi/electron-sdk/preload` | app **preload** script | `install()` — exposes the SDK bridge on the main world via `contextBridge` |
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
unsubscribe function. Every bridge-backed `setup*Render` reads its fragment off
`window.jitsiElectronSDK`, so the preload must be installed — and the window created with
context isolation — before they are called. (`initPopupsConfigurationRender` is the one
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
bundled (esbuild, webpack, etc.). Call `install()` from it to expose the bridge:

```Javascript
// app preload (bundled)
import { install } from '@jitsi/electron-sdk/preload';

install();
```

`install()` puts the bridge on the main world under an SDK-internal key that the
`/renderer` helpers read for you — your code never names it. Call it once, from a preload
running with `contextIsolation` enabled.

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

**User consent**: every session start is gated on an explicit confirmation collected in the
main process, because the start request reaches the renderer as an iframe → top-frame
`postMessage` and therefore carries no trustworthy identity. By default a native, modal
message box parented to `jitsiMeetWindow` is shown; web content can neither render, click nor
dismiss it. Pass `requestConsent` to provide your own wording (for instance a localized
dialog); it receives `{ sourceId }` and must resolve to `true` only when the user explicitly
allowed the session. Whatever you supply must not be renderable or dismissable by web
content — a prompt inside the meeting page is not a consent gate.

```Javascript
setupRemoteControlMain(jitsiMeetWindow, {
    async requestConsent({ sourceId }) { // eslint-disable-line no-unused-vars
        const { response } = await dialog.showMessageBox(jitsiMeetWindow, {
            type: 'warning',
            buttons: [ t('remoteControl.deny'), t('remoteControl.allow') ],
            defaultId: 0,
            cancelId: 0,
            message: t('remoteControl.message'),
            detail: t('remoteControl.detail')
        });

        return response === 1;
    }
});
```

Passing `requestConsent: false` disables the gate: every requested session starts, with no
prompt and no interaction.

```Javascript
// Starts remote control sessions unconditionally. Read the warning below first.
setupRemoteControlMain(jitsiMeetWindow, { requestConsent: false });
```

> [!WARNING]
> Only do this when you can guarantee that a start request cannot originate from untrusted
> web content — a kiosk or support appliance that loads one deployment you control, and that
> has already obtained consent out of band.

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

**Custom PiP window** (the legacy always-on-top experience): deployments with
`config.pip.mode` unset or set to `'customWindow'` open a small frameless
always-on-top window rendered by the meeting itself instead of the browser's
video-element PiP. jitsi-meet opens it as a named popup
(`JitsiMeetPiPWindow`) from inside the meeting iframe; `setupPictureInPictureMain`
registers the popup configuration and finishes the window setup (always-on-top
level that floats over full screen apps, 16:9 resizing, and reopening where the
previous PiP window was left: the position is kept across meetings and
sessions, the size only until the meeting ends, like the legacy window).
The popup needs no Electron access of its own: the
meeting page renders it and moves it with web platform APIs. Like the OAuth
popups, it relies on the SDK-owned window open handler installed by
`initPopupsConfigurationMain`, so apps using it need no extra wiring.

A double click in the PiP window focuses the window hosting the meeting through
the main process (like the legacy always-on-top window). Apps that need to react
to the window's gestures themselves listen to the External API directly:

```Javascript
// The user double clicked the PiP window ('return to the meeting').
api.on('pipDoubleClicked', () => { /* e.g. focus and bring the meeting view to the front */ });

// PiP was left; `reason` is 'dismissed' (X button), 'focus' or 'requested'.
api.on('pipLeft', ({ mode, reason }) => { /* ... */ });
```

The `pipEntered` / `pipLeft` events carry the implementation in use as `mode`
(`'customWindow'`, `'videoPiP'` or `'documentPiP'`). jitsi-meet does not detect
a denied popup: an app whose window open handler denies it (an SDK older than
this one) shows no PiP at all, so such apps have to request the video-element
PiP by passing `pip: { mode: 'videoPiP' }` in `configOverwrite`. Apps that
sandbox the meeting iframe (the External API's `sandbox` option) must include
`allow-popups`, otherwise the browser itself blocks the popup with the same
result; the OAuth popups already have this requirement. The same symptom has
one more cause on Electron 45 and later, see
[Electron 45 and later](#electron-45-and-later).

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

A popup configuration in `popupsConfigRegistry` may carry `overrideBrowserWindowOptions`: a
`BrowserWindow` options object, or a function receiving the window open handler details and
returning one (or `undefined` to leave the decision to your handler). A matching configuration
with options is allowed with those options; this is how the OAuth popups get
`nodeIntegration: false`.

`initPopupsConfigurationRender(api)` is exported from the renderer entry for API
compatibility but is a no-op.

#### Electron 45 and later

Since Electron 45 a popup is created in its own process, without an opener, when
its sandbox state differs from the sandbox state of the process of the frame that
opens it; `window.open()` then returns `null`. Popups are sandboxed unless a
configuration says otherwise, and the SDK popups set no `sandbox` flag, so they
only open when the meeting iframe runs in a sandboxed process. For the PiP window
this means no PiP at all (jitsi-meet logs "The embedding app denied the PiP
window"); the OAuth popups open without a link to the meeting page.

Whether the meeting iframe runs sandboxed depends on the app, not on the meeting:

- **Works**: the iframe has its own renderer process, which is always sandboxed.
  That is the case whenever the page hosting the meeting is on another site than
  the meeting, for example a `file://` page embedding `https://meet.example.com`
  (jitsi-meet-electron).
- **Works**: the window is created with `sandbox: true`, whatever the page.
- **Fails**: the iframe shares the window's process and that process is not
  sandboxed, i.e. the window has `sandbox: false` (or `nodeIntegration: true`)
  and either the page is on the same site as the meeting
  (`https://app.example.com` embedding `https://meet.example.com`) or the app
  runs with `--disable-site-isolation-trials`.

In the failing case register a configuration that adds `sandbox: false` to the
SDK popups. The options of all matching configurations are merged, so the SDK's
own options are kept. Register it only in that case: on a sandboxed window it
causes the very same failure, because then the popup is the one that differs.

```Javascript
const { popupsConfigRegistry } = require('@jitsi/electron-sdk/main');

popupsConfigRegistry.registerPopupConfig('unsandboxed-popups', {
    matchPatterns: {
        frameName: '^JitsiMeetPiPWindow$',
        url: '^https:\\/\\/(www\\.)?(accounts\\.google\\.com\\/|dropbox\\.com\\/oauth2\\/authorize)'
    },
    overrideBrowserWindowOptions: { webPreferences: { sandbox: false } }
});
```

## Migrating from v9

v10 is a breaking release. The public API functions are the same; what changed is how you
load them and how the window is configured.

- **The default entry is gone.** `require('@jitsi/electron-sdk')` no longer resolves. Import
  from `@jitsi/electron-sdk/main`, `@jitsi/electron-sdk/preload`, or
  `@jitsi/electron-sdk/renderer` depending on where the code runs.
- **The Jitsi Meet window must use `contextIsolation: true`.** Because robotjs left the
  renderer, that window can also run with `sandbox: true`.
- **Install the bridge from the preload.** The app's (bundled) preload must call
  `install()` from `@jitsi/electron-sdk/preload`. Renderer code no longer receives
  `ipcRenderer` and must not assign the SDK helpers onto `window` itself.
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

On every push to the `master` branch, `.github/workflows/ci.yml` creates a new patch version and
publishes to npm. For a major or minor release, manually bump the version in package.json
[gh-action-bump-version workflow](https://github.com/phips28/gh-action-bump-version#workflow).
