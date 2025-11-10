# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jitsi Meet Electron SDK provides utilities for integrating Jitsi Meet into Electron applications. The SDK supports Electron >= 16 and includes native code (C++) on Windows for remote control functionality, distributed as prebuilt binaries via prebuildify.

## Development Commands

### Setup
```bash
npx husky install           # Enable git hooks to prevent accidental pushes to main
npm ci                      # Install dependencies
```

### Building and Testing
```bash
npm run lint                # Run ESLint checks
npm test                    # Run mocha tests
npm run validate            # Validate dependency tree
npx node-gyp rebuild        # Rebuild native code (Windows only)
npm run prebuild            # Prebuildify native addons for distribution
```

### CI Workflow
The `.github/workflows/ci.yml` runs on every PR and push to master:
- Builds native code for Windows (x86, x64, arm64)
- Runs lint and tests on all platforms
- Auto-publishes to npm on master branch pushes with automatic version bumping (patch by default, use keywords in commit message for major/minor)

## Architecture

### Module Structure
The SDK is organized into feature-based modules that expose both **main process** and **renderer process** APIs:

```
index.js (main export)
├── remotecontrol/       # Remote desktop control via robotjs
├── screensharing/       # Screen sharing with desktop picker and tracker
├── alwaysontop/         # Floating active speaker window
├── powermonitor/        # System idle and power events
├── popupsconfig/        # Popup window configuration registry
├── node_addons/         # Native C++ addons (Windows only)
└── helpers/             # Shared utility functions
```

### Main/Renderer Process Pattern
Each feature module follows a consistent pattern:
- **`main.js`**: Code running in Electron's main process (privileged access to OS APIs)
- **`render.js`**: Code running in Electron's renderer process (iframe/web context)
- **`index.js`**: Exports both main and render components
- **`constants.js`**: Shared IPC event names and constants

Communication between processes uses Electron's IPC (ipcMain/ipcRenderer) and postis for iframe messaging.

### Core Features

#### Remote Control (`remotecontrol/`)
Enables remote desktop control during Jitsi Meet sessions:
- `RemoteControlMain`: Runs in main process, handles display metrics and IPC
- `RemoteControl`: Runs in renderer, uses robotjs to execute mouse/keyboard events from remote participants
- Windows native addon `sourceId2Coordinates` converts screen source IDs to coordinates

#### Screen Sharing (`screensharing/`)
Custom screen/window picker and sharing tracker:
- `setupScreenSharingMain`: Sets up `desktopCapturer`, handles getDisplayMedia requests, manages screen sharing tracker window
- `setupScreenSharingRender`: Interfaces with Jitsi Meet iframe API
- Special handling for Wayland (uses native picker) and macOS (permission checks)
- `screenSharingTracker.js`: Small always-visible window showing "X is sharing your screen"

#### Always On Top (`alwaysontop/`)
Floating window showing active speaker when main window loses focus:
- Uses Chrome's window.open implementation (requires `nativeWindowOpen: true`)
- Window identified by `frameName: 'AlwaysOnTop'`
- EventEmitter API with `dismissed` and `will-close` events

#### Power Monitor (`powermonitor/`)
Queries system idle state and power events:
- Bridges Electron's powerMonitor API to Jitsi Meet iframe
- Used for presence detection and power-saving features

#### Popups Config (`popupsconfig/`)
Registry pattern for managing popup window configurations:
- `PopupsConfigRegistry`: Singleton storing popup configs by name
- Decouples popup configuration from popup handling logic

### Native Code
- **Windows only**: `node_addons/sourceId2Coordinates/` contains C++ code (N-API) for remote control
- Built with node-gyp, configured in `binding.gyp`
- Prebuilt binaries generated via prebuildify and included in npm package

### Dependencies
- `@jitsi/robotjs`: Fork of robotjs for remote control functionality
- `electron-store`: Persistent storage
- `postis`: Cross-origin iframe messaging
- `@jitsi/logger`: Logging utility

## Code Style

### ESLint Configuration
Follow the rules in `.eslintrc.js`:
- ECMAScript 9 syntax
- Semicolons required
- `new-cap` enforced (except capIsNew)
- Console statements allowed (stripped before production)
- JSDoc plugin enabled

### JSDoc Requirements
All exports and class members require JSDoc comments explaining purpose and parameters.

## Testing

Tests are located in `test/` and run with mocha. Currently covers:
- `sourceId2Coordinates.test.js`: Native addon functionality (Windows)

## Integration

Apps using this SDK must:
1. Initialize Jitsi Meet via iframe API
2. Set up main process components before renderer components
3. Add `'disable-site-isolation-trials'` switch (see [Electron issue #18214](https://github.com/electron/electron/issues/18214))
4. Clean up handlers on window close to prevent leaks

Example integrations: [jitsi-meet-electron](https://github.com/jitsi/jitsi-meet-electron)

## Publishing

Automated via GitHub Actions:
- Every push to `master` triggers version bump and npm publish
- Prebuilt native addons from all Windows platforms are downloaded and bundled
- Published with npm provenance for supply chain security
