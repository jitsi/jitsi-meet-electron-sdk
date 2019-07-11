const electron = require('electron');
const { app, ipcMain } = electron;
const {
    METHODS,
    POWER_MONITOR_EVENTS,
    POWER_MONITOR_EVENTS_CHANNEL,
    POWER_MONITOR_QUERIES_CHANNEL
} = require('./constants');

let browserWindow;

/**
 * Attaches listening to all events from POWER_MONITOR_EVENTS on powerMonitor.
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
 * displays Jitsi Meet.
 * @private
 */
function _attachEvents(jitsiMeetWindow) {
    browserWindow = jitsiMeetWindow;
    Object.values(POWER_MONITOR_EVENTS).forEach(event => {
        electron.powerMonitor.on(event, () => {
            jitsiMeetWindow.webContents.send(POWER_MONITOR_EVENTS_CHANNEL, { event });
        });
    });
}

/**
 * The result from the querySystemIdleState or querySystemIdleTime to pass back
 * to Jitsi Meet.
 * @param id - Id of the request.
 * @param idleState - The result state retrieved.
 */
function systemIdleResult(id, idleState) {
    browserWindow.webContents.send(POWER_MONITOR_QUERIES_CHANNEL, {
        id,
        result: idleState,
        type: 'response'
    });
}

/**
 * The error result to pass back to Jitsi Meet.
 * @param id - Id of the request.
 * @param error - The error to send.
 */
function systemIdleErrorResult(id, error) {
    browserWindow.webContents.send(POWER_MONITOR_QUERIES_CHANNEL, {
        id,
        error,
        type: 'response'
    });
}

/**
 * Initializes the power monitor functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
 * displays Jitsi Meet
 */
module.exports = function setupPowerMonitorMain(jitsiMeetWindow) {
    if (app.isReady()) {
        _attachEvents(jitsiMeetWindow);
    } else {
        app.on('ready', () => _attachEvents(jitsiMeetWindow));
    }

    ipcMain.on(POWER_MONITOR_QUERIES_CHANNEL, (source, { id, data }) => {
        switch(data.type) {
            case METHODS.queryIdleState:
                electron.powerMonitor.querySystemIdleState(
                    data.idleThreshold,
                    idleState => {
                        systemIdleResult(id, idleState);
                    });
                break;
            case METHODS.queryIdleTime:
                    electron.powerMonitor.querySystemIdleTime(
                        idleTime => {
                            systemIdleResult(id, idleTime);
                        });
                break;
            default: {
                const error = 'Unknown event type!';

                console.error(error);
                systemIdleErrorResult(id, error);
            }
        }
    });
};
