import { app, ipcMain, screen } from 'electron';
import process from 'process';

import { DISPLAY_METRICS_CHANGED, GET_DISPLAY_EVENT } from './constants.js';
import sourceId2Coordinates from '../node_addons/sourceId2Coordinates.js';

/**
 * Module to run on the main process to get display dimensions for remote control.
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

        // Clean up ipcMain handlers to avoid memory leaks.
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Cleanup event listeners.
     */
    cleanup() {
        ipcMain.removeListener(GET_DISPLAY_EVENT, this._handleGetDisplayEvent);
        screen.removeListener(DISPLAY_METRICS_CHANGED, this._handleDisplayMetricsChanged);
    }

    /**
     * Handles GET_DISPLAY_EVENT event.
     * @param {Electron.IpcMainEvent} event - The Electron event.
     * @param {string} sourceId - The source ID of the desktop sharing stream.
     */
    _handleGetDisplayEvent(event, sourceId) {
        event.returnValue = this._getDisplay(sourceId);
    }

    /**
     * Handles DISPLAY_METRICS_CHANGED event.
     */
    _handleDisplayMetricsChanged() {
        if (!this._jitsiMeetWindow.isDestroyed()) {
            this._jitsiMeetWindow.webContents.send('jitsi-remotecontrol-displays-changed');
        }
    }

    /**
     * Returns the display metrics (bounds, scaleFactor, etc.) of the display
     * used for remote control.
     *
     * @param {string} sourceId - The source ID of the desktop sharing stream.
     * @returns {Object|undefined} Bounds and scaleFactor of the matching display.
     */
    _getDisplay(sourceId) {
        const displays = screen.getAllDisplays();
        if (displays.length === 0) return undefined;
        if (displays.length === 1) return displays[0];

        const parsedSourceId = sourceId.replace('screen:', '');

        if (process.platform === 'win32') {
            const coordinates = sourceId2Coordinates(parsedSourceId);
            if (coordinates) {
                const { x, y } = coordinates;
                const display = screen.getDisplayNearestPoint({ x: x + 1, y: y + 1 });

                if (display) {
                    return {
                        bounds: { x, y, width: display.bounds.width, height: display.bounds.height },
                        scaleFactor: display.scaleFactor
                    };
                }
            }
        } else if (process.platform === 'darwin') {
            let displayId = Number(parsedSourceId);
            if (isNaN(displayId)) {
                const idArr = parsedSourceId.split(':');
                if (idArr.length <= 1) return undefined;
                displayId = Number(idArr[0]);
            }
            return displays.find(display => display.id === displayId);
        }
        return undefined;
    }
}

export default RemoteControlMain;
