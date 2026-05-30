const { exec } = require('child_process');
const {
    BrowserWindow,
    desktopCapturer,
    ipcMain,
    screen,
    systemPreferences
} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS, SCREEN_SHARE_GET_SOURCES, TRACKER_SIZE } = require('./constants');
const { isMac, isWayland } = require('./utils');
const { windowsEnableScreenProtection } = require('../helpers/functions');

/**
 * Builds the source code for the tracker window's preload script.
 * Constants are baked in so the generated file has no `require()` calls
 * other than the always-available `require('electron')`.
 *
 * @returns {string} JavaScript source ready to be written to disk.
 */
function buildPreloadContent() {
    return [
        "const { contextBridge, ipcRenderer } = require('electron');",
        `const EVENTS = ${JSON.stringify(SCREEN_SHARE_EVENTS)};`,
        `const CHANNEL = ${JSON.stringify(SCREEN_SHARE_EVENTS_CHANNEL)};`,
        "contextBridge.exposeInMainWorld('JitsiScreenSharingTracker', {",
        '    EVENTS,',
        '    sendEvent: function(ev) {',
        '        if (Object.values(EVENTS).includes(ev)) {',
        '            ipcRenderer.send(CHANNEL, { data: { name: ev } });',
        '        }',
        '    }',
        '});'
    ].join('\n');
}

/**
 * Builds the HTML content for the screen-sharing tracker window.
 * The tracker JS is inlined so no separate file is needed.  The identity
 * string is embedded safely via JSON so HTML-special characters cannot
 * break out of the script context.
 *
 * @param {string} identity - Application name shown in the tracker bar.
 * @returns {string} Full HTML document ready to be loaded via a data: URI.
 */
function buildTrackerHtml(identity) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Screen Sharing Tracker</title>
  <style>
    html {
      background-color: #303135e6;
    }

    body {
      align-items: center;
      color: #e4e4e4;
      display: flex;
      justify-content: space-between;
      margin: 0;
      padding: 6px 16px;
      -webkit-user-select: none;
      -webkit-app-region: drag;
    }

    button {
      background-color: #b8b8b8;
      border: 0;
      border-radius: 4px;
      color: #282a2f;
      height: 28px;
      margin-right: 16px;
      -webkit-app-region: no-drag;
    }

    #text-container {
      font-family:Arial, Helvetica, sans-serif;
      font-size: 13px;
      display: flex;
    }

    #double-line {
      font-size: 15px;
      font-weight:bolder;
    }

    #screen-share-marker-minimize {
      color: #ababab;
      font-family:Arial, Helvetica, sans-serif;
      font-size: 13px;
      -webkit-app-region: no-drag;
    }

    #sharing-identity {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 170px;
    }
  </style>
</head>
<body>
  <span id="double-line">‖</span>
  <div id="text-container">
    <span id="sharing-identity"></span><span id="static-text">&nbsp;is sharing your screen.</span>
  </div>
  <div>
    <button id="screen-share-marker-stop">Stop sharing</button>
    <a id="screen-share-marker-minimize">Hide</a>
  </div>
  <script>
    document.getElementById('sharing-identity').textContent = ${JSON.stringify(identity || '')};
    var tracker = window.JitsiScreenSharingTracker;
    document.getElementById('screen-share-marker-minimize').addEventListener('click', function() {
      tracker.sendEvent(tracker.EVENTS.HIDE_TRACKER);
    });
    document.getElementById('screen-share-marker-stop').addEventListener('click', function() {
      tracker.sendEvent(tracker.EVENTS.STOP_SCREEN_SHARE);
    });
  </script>
</body>
</html>`;
}

/**
 * Path of the preload script written to the OS temp directory.
 * Populated on first call to {@link getInlinedPreloadPath}.
 * @type {string|null}
 */
let _inlinedPreloadPath = null;

/**
 * Returns the path of the inlined preload script, writing it to the OS temp
 * directory on the first call and caching the result.
 *
 * @returns {string} Absolute path to the preload script.
 */
function getInlinedPreloadPath() {
    if (!_inlinedPreloadPath) {
        const tmpPath = path.join(os.tmpdir(), 'jitsi-screensharing-preload.js');

        fs.writeFileSync(tmpPath, buildPreloadContent(), 'utf8');
        _inlinedPreloadPath = tmpPath;
    }

    return _inlinedPreloadPath;
}


/**
 * Main process component that sets up electron specific screen sharing functionality, like screen sharing
 * tracker and window selection.
 * The class will process events from {@link ScreenShareRenderHook} initialized in the renderer, and the
 * always on top screen sharing tracker window.
 */
class ScreenShareMainHook {
    /**
     * Create ScreenShareMainHook linked to jitsiMeetWindow.
     *
     * @param {BrowserWindow} jitsiMeetWindow - BrowserWindow where jitsi-meet api is loaded.
     * @param {string} identity - Name of the application doing screen sharing, will be displayed in the
     * screen sharing tracker window text i.e. {identity} is sharing your screen.
     * @param {string} osxBundleId - macOS bundle ID used to reset screen capture permissions.
     * @param {Object} options - Optional overrides.
     * @param {string} [options.preloadPath] - Absolute path to a custom tracker preload script.
     *   When omitted, a preload script is generated and written to the OS temp directory.
     * @param {string} [options.trackerHtmlPath] - Absolute path to a custom tracker HTML file.
     *   When omitted, the tracker HTML is generated inline and loaded via a data: URI.
     */
    constructor(jitsiMeetWindow, identity, osxBundleId, options = {}) {
        this._jitsiMeetWindow = jitsiMeetWindow;
        this._identity = identity;
        this._options = options;
        this._onScreenSharingEvent = this._onScreenSharingEvent.bind(this);
        this._gdmRequestId = 0;
        this._pendingGdmRequests = new Map();

        this.cleanup = this.cleanup.bind(this);

        if (osxBundleId && isMac()) {
            this._verifyScreenCapturePermissions(osxBundleId);
        }

        // Handle getDisplayMedia requests.
        jitsiMeetWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
            // On Wayland the native picker will show up and will resolve to what the user selected, so there
            // is no need to use the Jitsi picker.
            if (isWayland()) {
                const options = {
                    types: ['screen', 'window']
                };

                desktopCapturer.getSources(options).then(sources => {
                    const source = sources[0];

                    if (source) {
                        callback({ video: source });
                    } else {
                        callback(null);
                    }
                });
            } else {
                // Generate unique ID for this request to handle multiple simultaneous requests
                const requestId = ++this._gdmRequestId;

                this._pendingGdmRequests.set(requestId, {
                    request,
                    callback
                });

                const ev = {
                    data: {
                        name: SCREEN_SHARE_EVENTS.OPEN_PICKER,
                        requestId
                    }
                };

                this._jitsiMeetWindow.webContents.send(SCREEN_SHARE_EVENTS_CHANNEL, ev);
            }
        }, { useSystemPicker: false /* TODO: enable this when not experimental. It's macOS >= 15 only for now. */ }
        );

        // Listen for events coming in from the main render window and the screen share tracker window.
        ipcMain.on(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        ipcMain.handle(SCREEN_SHARE_GET_SOURCES, (_event, opts) => desktopCapturer.getSources(opts));

        // Clean up ipcMain handlers to avoid leaks.
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Cleanup any handlers
     */
    cleanup() {
        // Reject all pending getDisplayMedia requests
        this._pendingGdmRequests.forEach((gdmData, requestId) => {
            console.warn(`[screensharing] Cleaning up pending request ${requestId}`);
            gdmData.callback(null);
        });
        this._pendingGdmRequests.clear();

        ipcMain.removeListener(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        ipcMain.removeHandler(SCREEN_SHARE_GET_SOURCES);
    }

    /**
     * Listen for events coming on the screen sharing event channel.
     *
     * @param {Object} event - Electron event data.
     * @param {Object} data - Channel specific data.
     */
    _onScreenSharingEvent(event, { data }) {
        switch (data.name) {
            case SCREEN_SHARE_EVENTS.OPEN_TRACKER:
                this._createScreenShareTracker();
                break;
            case SCREEN_SHARE_EVENTS.CLOSE_TRACKER:
                if (this._screenShareTracker) {
                    this._screenShareTracker.close();
                    this._screenShareTracker = undefined;
                }
                break;
            case SCREEN_SHARE_EVENTS.HIDE_TRACKER:
                if (this._screenShareTracker) {
                    this._screenShareTracker.minimize();
                }
                break;
            case SCREEN_SHARE_EVENTS.STOP_SCREEN_SHARE:
                this._jitsiMeetWindow.webContents.send(SCREEN_SHARE_EVENTS_CHANNEL, { data });
                break;
            case SCREEN_SHARE_EVENTS.DO_GDM: {
                const { requestId } = data;

                if (!requestId || !this._pendingGdmRequests.has(requestId)) {
                    console.warn(`[screensharing] DO_GDM received for unknown/expired requestId: ${requestId}`);
                    break;
                }

                const { callback } = this._pendingGdmRequests.get(requestId);
                this._pendingGdmRequests.delete(requestId);

                if (!data.source) {
                    callback(null);
                    break;
                }

                const constraints = {
                    video: data.source
                };

                // Setting `audio` to `undefined` throws an exception.
                if (data.screenShareAudio) {
                    // TODO: maybe make this configurable somehow in case
                    // someone wants to use `loopbackWithMute`?
                    constraints.audio = 'loopback';
                }

                callback(constraints);

                break;
            }
            default:
                console.warn(`Unhandled ${SCREEN_SHARE_EVENTS_CHANNEL}: ${data}`);
        }
    }

    /**
     * Opens an always on top window, in the bottom center of the screen, that lets a user know
     * a content sharing session is currently active.
     *
     * @return {void}
     */
    _createScreenShareTracker() {
        if (this._screenShareTracker) {
            return;
        }

        // Display always on top screen sharing tracker window in the center bottom of the screen.
        const display = screen.getPrimaryDisplay();
        const preloadPath = this._options.preloadPath || getInlinedPreloadPath();

        this._screenShareTracker = new BrowserWindow({
            height: TRACKER_SIZE.height,
            width: TRACKER_SIZE.width,
            x: (display.workArea.width - TRACKER_SIZE.width) / 2,
            y: display.workArea.height - TRACKER_SIZE.height - 5,
            transparent: true,
            minimizable: true,
            maximizable: false,
            resizable: false,
            alwaysOnTop: true,
            fullscreen: false,
            fullscreenable: false,
            skipTaskbar: false,
            frame: false,
            show: false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: preloadPath,
                sandbox: false
            }
        });

        // for Windows OS, only enable protection for builds higher or equal to Windows 10 Version 2004
        // which have the flag WDA_EXCLUDEFROMCAPTURE(which makes the window completely invisible on capture)
        // For older Windows versions, we leave the window completely visible, including content, on capture,
        // otherwise we'll have a black content window on share.
        if (os.platform() !== 'win32' || windowsEnableScreenProtection(os.release())) {
            // Avoid this window from being captured.
            this._screenShareTracker.setContentProtection(true);
        }

        this._screenShareTracker.on('closed', () => {
            this._screenShareTracker = undefined;
        });

        // Prevent newly created window to take focus from main application.
        this._screenShareTracker.once('ready-to-show', () => {
            if (this._screenShareTracker && !this._screenShareTracker.isDestroyed()) {
                this._screenShareTracker.showInactive();
            }
        });

        if (this._options.trackerHtmlPath) {
            this._screenShareTracker
                .loadURL(`file://${this._options.trackerHtmlPath}?sharingIdentity=${this._identity}`);
        } else {
            const html = buildTrackerHtml(this._identity);

            this._screenShareTracker
                .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        }
    }

    /**
     * Verifies whether app has already asked for capture permissions.
     * If it did but the user denied, resets permissions for the app
     *
     * @param {string} bundleId- OSX Application BundleId
     */
    _verifyScreenCapturePermissions(bundleId) {
        const hasPermission = systemPreferences.getMediaAccessStatus('screen') === 'granted';
        if (!hasPermission) {
            exec('tccutil reset ScreenCapture ' + bundleId);
        }
    }
}

/**
 * Initializes the screen sharing electron specific functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which displays Jitsi Meet
 * @param {string} identity - Name of the application doing screen sharing, will be displayed in the
 * screen sharing tracker window text i.e. {identity} is sharing your screen.
 * @param {string} osxBundleId - OSX Application BundleId
 * @param {Object} [options] - Optional configuration overrides.
 * @param {string} [options.preloadPath] - Absolute path to a custom tracker preload script.
 *   When omitted, a preload script is generated and written to the OS temp directory.
 * @param {string} [options.trackerHtmlPath] - Absolute path to a custom tracker HTML file.
 *   When omitted, the tracker HTML is generated inline and loaded via a data: URI.
 * @returns {ScreenShareMainHook}
 */
function setupScreenSharingMain(jitsiMeetWindow, identity, osxBundleId, options = {}) {
    return new ScreenShareMainHook(jitsiMeetWindow, identity, osxBundleId, options);
}

module.exports = setupScreenSharingMain;
