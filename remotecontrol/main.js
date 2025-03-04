import { app, ipcMain, screen } from 'electron';
import process from 'process';

import { DISPLAY_METRICS_CHANGED, GET_DISPLAY_EVENT } from './constants.js';

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
        const { screen } = require('electron');
        const displays = screen.getAllDisplays();

        switch (displays.length) {
            case 0:
                return undefined;
            case 1:
                return displays[0];
            default: { // > 1 display
                const parsedSourceId = sourceId.replace('screen:', '');

                if (process.platform === 'win32') {
                    const sourceId2Coordinates = require("../node_addons/sourceId2Coordinates").default;
                    const coordinates = sourceId2Coordinates(parsedSourceId);
                    
                    if (coordinates) {
                        const { x, y } = coordinates;
                        const display = screen.getDisplayNearestPoint({ x: x + 1, y: y + 1 });

                        if (display) {
                            const { width, height } = display.bounds;

                            return {
                                bounds: { x, y, width, height },
                                scaleFactor: display.scaleFactor
                            };
                        }
                    }
                } else if (process.platform === 'darwin') {
                    let displayId = Number(parsedSourceId);

                    if (isNaN(displayId)) {
                        const idArr = parsedSourceId.split(":");

                        if (idArr.length <= 1) {
                            return;
                        }

                        displayId = Number(idArr[0]);
                    }
                    return displays.find(display => display.id === displayId);
                }
                return undefined;
            }
        }
    }
}

export default RemoteControlMain;
