import electron from 'electron';
import process from 'process';

const { app, ipcMain, screen } = electron;
import { DISPLAY_METRICS_CHANGED, GET_DISPLAY_EVENT } from './constants.mjs';
import sourceId2Coordinates from '../node_addons/sourceId2Coordinates/index.mjs';

/**
 * Module to run on main process to get display dimensions for remote control.
 */
class RemoteControlMain {
    constructor(jitsiMeetWindow) {
        this._jitsiMeetWindow = jitsiMeetWindow;

        this.cleanup = this.cleanup.bind(this);
        this._handleDisplayMetricsChanged = this._handleDisplayMetricsChanged.bind(this);
        this._handleGetDisplayEvent = this._handleGetDisplayEvent.bind(this);

        ipcMain.on(GET_DISPLAY_EVENT, this._handleGetDisplayEvent);

        app.whenReady().then(() => {
            screen.on(DISPLAY_METRICS_CHANGED, this._handleDisplayMetricsChanged);
        });

        // Clean up ipcMain handlers to avoid leaks.
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Cleanup any handlers
     */
    cleanup() {
        ipcMain.removeListener(GET_DISPLAY_EVENT, this._handleGetDisplayEvent);
        screen.removeListener(DISPLAY_METRICS_CHANGED, this._handleDisplayMetricsChanged);
    }

    /**
     * Handles GET_DISPLAY_EVENT event
     * @param {IPCMainEvent} event - The electron event
     * @param {string} sourceId - The source id of the desktop sharing stream.
     */
    _handleGetDisplayEvent(event, sourceId) {
        event.returnValue = this._getDisplay(sourceId);
    }

    /**
     * Handles DISPLAY_METRICS_CHANGED event
     */
    _handleDisplayMetricsChanged() {
        if (!this._jitsiMeetWindow.isDestroyed()) {
            this._jitsiMeetWindow.webContents.send('jitsi-remotecontrol-displays-changed');
        }
    }

    /**
     * Returns the display metrics(x, y, width, height, scaleFactor, etc...) of the display that will be used for the
     * remote control.
     *
     * @param {string} sourceId - The source id of the desktop sharing stream.
     * @returns {Object} bounds and scaleFactor of display matching sourceId.
     */
    _getDisplay(sourceId) {
        const displays = screen.getAllDisplays();

        switch (displays.length) {
            case 0:
                return undefined;
            case 1:
                // On Linux probably we'll end up here even if there are
                // multiple monitors.
                return displays[0];
            // eslint-disable-next-line no-case-declarations
            default: { // > 1 display
                // Remove the type part from the sourceId
                const parsedSourceId = sourceId.replace('screen:', '');

                // Currently native code sourceId2Coordinates is only necessary for windows.
                if (process.platform === 'win32') {
                    const coordinates = sourceId2Coordinates(parsedSourceId);
                    if (coordinates) {
                        const { x, y } = coordinates;
                        const display
                            = screen.getDisplayNearestPoint({
                                x: x + 1,
                                y: y + 1
                            });

                        if (typeof display !== 'undefined') {
                            // We need to use x and y returned from sourceId2Coordinates because the ones returned from
                            // Electron don't seem to respect the scale factors of the other displays.
                            const { width, height } = display.bounds;

                            return {
                                bounds: {
                                    x,
                                    y,
                                    width,
                                    height
                                },
                                scaleFactor: display.scaleFactor
                            };
                        } else {
                            return undefined;
                        }
                    }
                } else if (process.platform === 'darwin') {
                    // On Mac OS the sourceId = 'screen' + displayId.
                    // Try to match displayId with sourceId.
                    let displayId = Number(parsedSourceId);

                    if (isNaN(displayId)) {
                        // The source id may have the following format "desktop_id:0".

                        const idArr = parsedSourceId.split(":");

                        if (idArr.length <= 1) {
                            return;
                        }

                        displayId = Number(idArr[0]);
                    }
                    return displays.find(display => display.id === displayId);
                } else {
                    return undefined;
                }
            }
        }
    }
}

/**
 * Initializes the remote control functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which displays the meeting.
 * @returns {RemoteControlMain} - the remote control object.
 */
export default function setupRemoteControlMain(jitsiMeetWindow) {
    return new RemoteControlMain(jitsiMeetWindow);
}
