/* global __dirname */
import { exec } from 'child_process';
import { BrowserWindow, desktopCapturer, ipcMain, screen, systemPreferences } from 'electron';
import os from 'os';
import path from 'path';

import { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS, SCREEN_SHARE_GET_SOURCES, TRACKER_SIZE } from './constants.js';
import { isMac, isWayland } from './utils.js';
import { windowsEnableScreenProtection } from '../helpers/functions.js';

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
        this._identity = identity;
        this._onScreenSharingEvent = this._onScreenSharingEvent.bind(this);
        this._gdmData = null;

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
                    types: [ 'screen', 'window' ]
                };

                desktopCapturer.getSources(options).then(sources => {
                    const source =  sources[0];

                    if (source) {
                        callback({ video: source });
                    } else {
                        callback(null);
                    }
                });
            } else {
                this._gdmData = {
                    request,
                    callback
                };

                const ev = {
                    data: {
                        name: SCREEN_SHARE_EVENTS.OPEN_PICKER
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
                const { callback } = this._gdmData;

                this._gdmData = null;

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
export default function setupScreenSharingMain(jitsiMeetWindow, identity, osxBundleId) {
    return new ScreenShareMainHook(jitsiMeetWindow, identity, osxBundleId);
};
