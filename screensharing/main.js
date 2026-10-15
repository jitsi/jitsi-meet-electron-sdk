/* global __dirname */
const { exec } = require('child_process');
const {
    BrowserWindow,
    desktopCapturer,
    screen,
    systemPreferences,
    webContents
} = require('electron');
const os = require('os');
const path = require('path');

const { addInvokeRoute, addSendRoute, removeInvokeRoute, removeSendRoute } = require('../helpers/ipcRouter');
const { windowsEnableScreenProtection } = require('../helpers/functions');
const { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS, SCREEN_SHARE_GET_SOURCES, TRACKER_SIZE } = require('./constants');
const { isMac, isWayland } = require('./utils');

/**
 * Active hooks, keyed by the WebContents they were set up for.
 *
 * `setDisplayMediaRequestHandler` is per session, so a single handler sees the
 * getDisplayMedia requests of every window sharing that session. The registry
 * lets the handler hand each request to the hook of the window that made it.
 *
 * @type {Map<Electron.WebContents, ScreenShareMainHook>}
 */
const hooks = new Map();

/**
 * Counter for getDisplayMedia request IDs. Module wide, so that IDs stay unique
 * when a hook is replaced by a new one for the same window.
 *
 * @type {number}
 */
let gdmRequestId = 0;

/**
 * Finds the WebContents that hosts the frame which made a getDisplayMedia
 * request. The frame can be a subframe (the Jitsi Meet iframe).
 *
 * @param {Electron.WebFrameMain|null} frame - The requesting frame.
 * @returns {Electron.WebContents|undefined} The WebContents, if it still exists.
 */
function webContentsForFrame(frame) {
    if (!frame) {
        return undefined;
    }

    if (typeof webContents.fromFrame === 'function') {
        return webContents.fromFrame(frame);
    }

    // Electron versions without webContents.fromFrame: match the top frame.
    const top = frame.top;

    for (const wc of hooks.keys()) {
        if (!wc.isDestroyed() && wc.mainFrame === top) {
            return wc;
        }
    }

    return undefined;
}

/**
 * Session wide getDisplayMedia request handler. It hands the request to the hook
 * of the requesting window, or rejects it when there is no such hook. Without a
 * matching hook nobody can show the picker or answer the request, so rejecting
 * it is the only way to keep getDisplayMedia from waiting forever.
 *
 * @param {Electron.DisplayMediaRequestHandlerHandlerRequest} request - The request.
 * @param {Function} callback - The callback to complete the request.
 * @returns {void}
 */
function onDisplayMediaRequest(request, callback) {
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
        }).catch(error => {
            console.warn(`[screensharing] Failed to get the Wayland source: ${error}`);
            callback(null);
        });

        return;
    }

    const requester = webContentsForFrame(request.frame);
    const hook = requester && hooks.get(requester);

    if (!hook) {
        console.warn('[screensharing] Rejecting getDisplayMedia request from '
            + `${request.securityOrigin}: the requesting window has no screen sharing hook. `
            + 'Make sure setupScreenSharingMain() was called with the window which hosts the meeting '
            + `(hooks are set up for ${hooks.size} other window(s)).`);
        callback(null);

        return;
    }

    hook._onDisplayMediaRequest(request, callback);
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
     */
    constructor(jitsiMeetWindow, identity, osxBundleId) {
        this._jitsiMeetWindow = jitsiMeetWindow;
        this._webContents = jitsiMeetWindow.webContents;
        this._identity = identity;
        this._onScreenSharingEvent = this._onScreenSharingEvent.bind(this);
        this._acceptsEventSender = this._acceptsEventSender.bind(this);
        this._pendingGdmRequests = new Map();

        this._rejectPendingGdmRequests = this._rejectPendingGdmRequests.bind(this);

        this.cleanup = this.cleanup.bind(this);

        if (osxBundleId && isMac()) {
            this._verifyScreenCapturePermissions(osxBundleId);
        }

        // A new hook for the same window replaces the old one. Clean up the old one first, so its pending
        // requests are rejected instead of being left without anybody to answer them.
        const previousHook = hooks.get(this._webContents);

        if (previousHook) {
            previousHook.cleanup();
        }

        hooks.set(this._webContents, this);

        // Handle getDisplayMedia requests.
        this._webContents.session.setDisplayMediaRequestHandler(onDisplayMediaRequest,
            { useSystemPicker: false /* TODO: enable this when not experimental. It's macOS >= 15 only for now. */ }
        );

        // Listen for events coming in from the main render window and the screen share tracker window.
        addSendRoute(SCREEN_SHARE_EVENTS_CHANNEL, {
            owner: this._webContents,
            accepts: this._acceptsEventSender,
            handler: this._onScreenSharingEvent
        });

        // getSources may only be requested by this window's renderer, and only
        // while a screen share the user actually started is in progress.
        addInvokeRoute(SCREEN_SHARE_GET_SOURCES, {
            owner: this._webContents,
            handler: (_event, opts) => this._getSources(opts)
        });

        // Release pending requests when the renderer that must answer them goes away.
        this._webContents.on('did-navigate', this._rejectPendingGdmRequests);
        this._webContents.on('render-process-gone', this._rejectPendingGdmRequests);

        // Clean up ipcMain handlers to avoid leaks.
        this._webContents.on('destroyed', this.cleanup);
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Handles a getDisplayMedia request made by this hook's window: asks the renderer to open the picker
     * and waits for the DO_GDM reply.
     *
     * @param {Electron.DisplayMediaRequestHandlerHandlerRequest} request - The request.
     * @param {Function} callback - The callback to complete the request.
     * @returns {void}
     */
    _onDisplayMediaRequest(request, callback) {
        if (this._webContents.isDestroyed()) {
            console.warn('[screensharing] Rejecting getDisplayMedia request: the window is destroyed');
            callback(null);

            return;
        }

        // Generate unique ID for this request to handle multiple simultaneous requests
        const requestId = ++gdmRequestId;

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

        this._webContents.send(SCREEN_SHARE_EVENTS_CHANNEL, ev);
    }

    /**
     * Rejects all pending getDisplayMedia requests.
     *
     * @returns {void}
     */
    _rejectPendingGdmRequests() {
        this._pendingGdmRequests.forEach((gdmData, requestId) => {
            console.warn(`[screensharing] Rejecting pending request ${requestId}`);
            gdmData.callback(null);
        });
        this._pendingGdmRequests.clear();
    }

    /**
     * Decides whether an incoming screen sharing event belongs to this hook.
     * Events legitimately arrive from the meeting window's renderer and from the
     * always-on-top tracker window this hook creates; everything else is
     * rejected.
     *
     * @param {Electron.WebContents} sender - The event sender.
     * @returns {boolean} True when the sender is trusted.
     */
    _acceptsEventSender(sender) {
        return sender === this._webContents
            || Boolean(this._screenShareTracker
                && !this._screenShareTracker.isDestroyed()
                && sender === this._screenShareTracker.webContents);
    }

    /**
     * Returns the available desktop capture sources, but only while a screen
     * share request the user actually initiated is awaiting a source selection.
     *
     * Source access is tied to the visible, user-triggered picker flow: a
     * pending `getDisplayMedia` request is the only thing that populates
     * `_pendingGdmRequests`, so the sources can only be read while the user is
     * choosing what to share.
     *
     * @param {Object} opts - Sanitized desktopCapturer.getSources options.
     * @returns {Promise<Array<Electron.DesktopCapturerSource>>} The sources.
     */
    _getSources(opts) {
        if (this._pendingGdmRequests.size === 0) {
            return Promise.reject(new Error('No screen sharing request in progress'));
        }

        return desktopCapturer.getSources(opts);
    }

    /**
     * Cleanup any handlers
     */
    cleanup() {
        if (this._cleanedUp) {
            return;
        }
        this._cleanedUp = true;

        // Reject all pending getDisplayMedia requests
        this._rejectPendingGdmRequests();

        if (hooks.get(this._webContents) === this) {
            hooks.delete(this._webContents);
        }

        this._webContents.removeListener('did-navigate', this._rejectPendingGdmRequests);
        this._webContents.removeListener('render-process-gone', this._rejectPendingGdmRequests);
        this._webContents.removeListener('destroyed', this.cleanup);
        this._jitsiMeetWindow.removeListener('closed', this.cleanup);

        removeSendRoute(SCREEN_SHARE_EVENTS_CHANNEL, this._webContents);
        removeInvokeRoute(SCREEN_SHARE_GET_SOURCES, this._webContents);
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
                preload: path.resolve(__dirname, './preload.js'),
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

        this._screenShareTracker
            .loadURL(`file://${__dirname}/screenSharingTracker.html?sharingIdentity=${this._identity}`);
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
 * @param {string} bundleId- OSX Application BundleId
 */
module.exports = function setupScreenSharingMain(jitsiMeetWindow, identity, osxBundleId) {
    return new ScreenShareMainHook(jitsiMeetWindow, identity, osxBundleId);
};
