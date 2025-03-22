import { app, ipcMain, powerMonitor } from 'electron';
import { METHODS, POWER_MONITOR_EVENTS, POWER_MONITOR_EVENTS_CHANNEL, POWER_MONITOR_QUERIES_CHANNEL } from './constants.js';

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
        powerMonitor.on(event, () => {
            if (browserWindow && !browserWindow.isDestroyed()) {
                browserWindow.webContents.send(POWER_MONITOR_EVENTS_CHANNEL, { event });
            }
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
 *
 * @param {IPCMainEvent} event - electron.ipcMain event
 * @param {Object} powerMonitor event data
 */
function handlePowerMonitorQuery(event, { id, data }) {
    switch(data.type) {
        case METHODS.queryIdleState:
            systemIdleResult(id, powerMonitor.getSystemIdleState(data.idleThreshold));
            break;
        case METHODS.queryIdleTime:
            systemIdleResult(id, powerMonitor.getSystemIdleTime());
            break;
        default: {
            const error = 'Unknown event type!';

            console.error(error);
            systemIdleErrorResult(id, error);
        }
    }
}

/**
 * Cleanup any handlers
 */
function cleanup() {
    ipcMain.removeListener(POWER_MONITOR_QUERIES_CHANNEL, handlePowerMonitorQuery);
}

/**
 * Initializes the power monitor functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
 * displays Jitsi Meet
 */
function setupPowerMonitorMain(jitsiMeetWindow) {
    app.whenReady().then(() => {
        _attachEvents(jitsiMeetWindow);
    });

    ipcMain.on(POWER_MONITOR_QUERIES_CHANNEL, handlePowerMonitorQuery);

    jitsiMeetWindow.on('close', cleanup);
}

export {
    cleanup as cleanupPowerMonitorMain,
    setupPowerMonitorMain
};
