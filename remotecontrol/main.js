const {
    app,
    desktopCapturer,
    ipcMain,
    screen,
} = require('electron');
const process = require('process');

const {
    DISPLAY_METRICS_CHANGED,
    DISPLAYS_CHANGED_EVENT,
    GET_DISPLAY_EVENT
} = require('./constants');
const {
    getMacDisplayBySourceId,
    getWindowsDisplayBySourceId
} = require('./displayUtils');

const remoteControlMainInstances = new Map();

function getRemoteControlMain(webContentsId) {
    return remoteControlMainInstances.get(webContentsId);
}

function handleGetDisplayEvent(event, sourceId) {
    const remoteControlMain = getRemoteControlMain(event.sender.id);

    return remoteControlMain
        ? remoteControlMain._getDisplay(sourceId)
        : undefined;
}

/**
 * Module to run on main process to get display dimensions for remote control.
 */
class RemoteControlMain {
    constructor(jitsiMeetWindow) {
        this._jitsiMeetWindow = jitsiMeetWindow;

        this.cleanup = this.cleanup.bind(this);
        this._handleDisplayMetricsChanged = this._handleDisplayMetricsChanged.bind(this);

        if (!remoteControlMainInstances.size) {
            ipcMain.handle(GET_DISPLAY_EVENT, handleGetDisplayEvent);
        }

        remoteControlMainInstances.set(this._jitsiMeetWindow.webContents.id, this);

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
        remoteControlMainInstances.delete(this._jitsiMeetWindow.webContents.id);
        if (!remoteControlMainInstances.size) {
            ipcMain.removeHandler(GET_DISPLAY_EVENT);
        }
        screen.removeListener(DISPLAY_METRICS_CHANGED, this._handleDisplayMetricsChanged);
    }

    /**
     * Handles DISPLAY_METRICS_CHANGED event
     */
    _handleDisplayMetricsChanged() {
        if (!this._jitsiMeetWindow.isDestroyed()) {
            this._jitsiMeetWindow.webContents.send(DISPLAYS_CHANGED_EVENT);
        }
    }

    /**
     * Returns the display metrics(x, y, width, height, scaleFactor, etc...) of the display that will be used for the
     * remote control.
     *
     * @param {string} sourceId - The source id of the desktop sharing stream.
     * @returns {Promise<Object|undefined>} bounds and scaleFactor of display matching sourceId.
     */
    async _getDisplay(sourceId) {
        const displays = screen.getAllDisplays();

        switch(displays.length) {
            case 0:
                return undefined;
            case 1:
                // On Linux probably we'll end up here even if there are
                // multiple monitors.
                return displays[0];
            // eslint-disable-next-line no-case-declarations
            default: { // > 1 display
                if (process.platform === 'win32') {
                    const sources = await desktopCapturer.getSources({
                        thumbnailSize: {
                            height: 0,
                            width: 0
                        },
                        types: [ 'screen' ]
                    });

                    return getWindowsDisplayBySourceId(sourceId, displays, sources);
                } else if (process.platform === 'darwin') {
                    return getMacDisplayBySourceId(sourceId, displays);
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
module.exports = function setupRemoteControlMain(jitsiMeetWindow) {
    return new RemoteControlMain(jitsiMeetWindow);
};