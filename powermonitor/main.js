const { app, powerMonitor } = require('electron');

const { addInvokeRoute, removeInvokeRoute } = require('../helpers/ipcRouter');
const {
    METHODS,
    POWER_MONITOR_EVENTS,
    POWER_MONITOR_EVENTS_CHANNEL,
    POWER_MONITOR_QUERIES_CHANNEL
} = require('./constants');

/**
 * Live hooks, so the module-level {@link cleanupPowerMonitorMain} can tear down
 * every power monitor set up in this process.
 * @type {Set<PowerMonitorMainHook>}
 */
const _instances = new Set();

/**
 * Main process component that bridges Electron's `powerMonitor` to the Jitsi
 * Meet window: it answers system-idle queries and forwards power events.
 *
 * Each instance is scoped to a single window. Queries are answered over an
 * `ipcMain.handle` route so the reply flows back to the invoking window with no
 * module-level window reference, and event pushes target this instance's own
 * `webContents` — which is what lets several windows use the power monitor at
 * once.
 */
class PowerMonitorMainHook {
    /**
     * Creates a PowerMonitorMainHook linked to the jitsi meet window.
     *
     * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
     * displays Jitsi Meet.
     */
    constructor(jitsiMeetWindow) {
        this._jitsiMeetWindow = jitsiMeetWindow;
        this._webContents = jitsiMeetWindow.webContents;

        // powerMonitor event name -> bound listener, kept so they can be
        // detached on cleanup.
        this._powerMonitorListeners = new Map();

        this.cleanup = this.cleanup.bind(this);
        this._handleQuery = this._handleQuery.bind(this);

        // Queries are request/response: routing by sender sends the reply back
        // to the invoking window automatically, so there is no module-level
        // browserWindow and no webContents.send for responses.
        addInvokeRoute(POWER_MONITOR_QUERIES_CHANNEL, {
            owner: this._webContents,
            handler: this._handleQuery
        });

        app.whenReady().then(() => this._attachEvents());

        this._jitsiMeetWindow.on('closed', this.cleanup);

        _instances.add(this);
    }

    /**
     * Attaches listeners for every POWER_MONITOR_EVENTS event, forwarding each
     * to this instance's window.
     *
     * @returns {void}
     */
    _attachEvents() {
        Object.values(POWER_MONITOR_EVENTS).forEach(event => {
            const listener = () => {
                if (!this._webContents.isDestroyed()) {
                    this._webContents.send(POWER_MONITOR_EVENTS_CHANNEL, { event });
                }
            };

            this._powerMonitorListeners.set(event, listener);
            powerMonitor.on(event, listener);
        });
    }

    /**
     * Answers a system idle query. The returned object is delivered to the
     * renderer as the `ipcRenderer.invoke` result.
     *
     * @param {IpcMainInvokeEvent} event - The electron event.
     * @param {Object} message - The query ({ id, data: { type, idleThreshold } }).
     * @returns {Object} `{ id, result | error, type: 'response' }`.
     */
    _handleQuery(event, message) {
        const { id, data } = message || {};

        switch (data && data.type) {
            case METHODS.queryIdleState:
                return { id, result: powerMonitor.getSystemIdleState(data.idleThreshold), type: 'response' };
            case METHODS.queryIdleTime:
                return { id, result: powerMonitor.getSystemIdleTime(), type: 'response' };
            default: {
                const error = 'Unknown event type!';

                console.error(error);

                return { id, error, type: 'response' };
            }
        }
    }

    /**
     * Cleans up the query route, the powerMonitor listeners and the window close
     * listener. Called automatically when the window is closed.
     *
     * @returns {void}
     */
    cleanup() {
        removeInvokeRoute(POWER_MONITOR_QUERIES_CHANNEL, this._webContents);

        this._powerMonitorListeners.forEach((listener, event) => {
            powerMonitor.removeListener(event, listener);
        });
        this._powerMonitorListeners.clear();

        if (this._jitsiMeetWindow && !this._jitsiMeetWindow.isDestroyed()) {
            this._jitsiMeetWindow.removeListener('closed', this.cleanup);
        }

        _instances.delete(this);
    }
}

/**
 * Initializes the power monitor functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which
 * displays Jitsi Meet.
 * @returns {PowerMonitorMainHook} the power monitor hook instance.
 */
function setupPowerMonitorMain(jitsiMeetWindow) {
    return new PowerMonitorMainHook(jitsiMeetWindow);
}

/**
 * Tears down every power monitor hook set up in this process. Individual hooks
 * also clean themselves up when their window closes; this is kept for API
 * compatibility and manual teardown.
 *
 * @returns {void}
 */
function cleanupPowerMonitorMain() {
    _instances.forEach(instance => instance.cleanup());
}

module.exports = {
    cleanupPowerMonitorMain,
    setupPowerMonitorMain
};
