const { POWER_MONITOR_EVENTS_CHANNEL, POWER_MONITOR_QUERIES_CHANNEL } = require('./constants');

/**
 * Whitelists a power monitor query before forwarding it to the main process.
 * Only the request id and the recognized query fields are kept.
 *
 * @param {Object} message - The query message coming from the iframe.
 * @returns {Object|null} A sanitized query, or null when invalid.
 */
function sanitizeQuery(message) {
    if (!message || typeof message !== 'object') {
        return null;
    }

    const { data, id } = message;
    const sanitized = { id };

    if (data && typeof data === 'object') {
        sanitized.data = { type: data.type };

        if ('idleThreshold' in data) {
            sanitized.data.idleThreshold = data.idleThreshold;
        }
    }

    return sanitized;
}

/**
 * Builds the power monitor fragment of the `window.jitsiElectronSDK` bridge.
 *
 * @param {Object} context - Preload helpers.
 * @param {Electron.IpcRenderer} context.ipcRenderer - The ipcRenderer instance.
 * @param {Function} context.subscribe - Channel subscription helper.
 * @returns {Object} The power monitor bridge API.
 */
module.exports = function createPowerMonitorBridge({ ipcRenderer, subscribe }) {
    return {
        /**
         * Sends a system idle query to the main process. The response arrives
         * asynchronously through `onQueryResponse`.
         *
         * @param {Object} message - The query message.
         * @returns {void}
         */
        sendQuery: message => {
            const sanitized = sanitizeQuery(message);

            if (sanitized) {
                ipcRenderer.send(POWER_MONITOR_QUERIES_CHANNEL, sanitized);
            }
        },

        /**
         * Subscribes to query responses pushed from the main process.
         *
         * @param {Function} callback - Invoked with the response payload.
         * @returns {Function} An unsubscribe function.
         */
        onQueryResponse: callback => subscribe(POWER_MONITOR_QUERIES_CHANNEL, callback),

        /**
         * Subscribes to power monitor events pushed from the main process.
         *
         * @param {Function} callback - Invoked with the event payload.
         * @returns {Function} An unsubscribe function.
         */
        onEvent: callback => subscribe(POWER_MONITOR_EVENTS_CHANNEL, callback)
    };
};
