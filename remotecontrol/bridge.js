const { EVENTS, RC_EVENT, RC_START, RC_STOP } = require('./constants');

/**
 * Whitelists a remote control event before forwarding it to the main process.
 * Only known event types and the recognized, cloneable fields are kept, as
 * defense-in-depth against a compromised main world synthesizing arbitrary OS
 * input.
 *
 * @param {Object} event - The event payload from the main world.
 * @returns {Object|null} A sanitized payload, or null when the event is invalid.
 */
function sanitizeEvent(event) {
    if (!event || typeof event !== 'object') {
        return null;
    }

    const { type } = event;

    if (!Object.values(EVENTS).includes(type)) {
        return null;
    }

    const sanitized = { type };

    if (typeof event.x === 'number') {
        sanitized.x = event.x;
    }
    if (typeof event.y === 'number') {
        sanitized.y = event.y;
    }
    if ('button' in event) {
        sanitized.button = event.button;
    }
    if (typeof event.key === 'string') {
        sanitized.key = event.key;
    }
    if (Array.isArray(event.modifiers)) {
        sanitized.modifiers = event.modifiers.filter(modifier => typeof modifier === 'string');
    }

    return sanitized;
}

/**
 * Builds the remote control fragment of the `window.jitsiElectronSDK` bridge.
 * The renderer never touches robotjs: it only starts/stops a session and
 * forwards sanitized events; the main process executes them.
 *
 * @param {Object} context - Preload helpers.
 * @param {Electron.IpcRenderer} context.ipcRenderer - The ipcRenderer instance.
 * @returns {Object} The remote control bridge API.
 */
module.exports = function createRemoteControlBridge({ ipcRenderer }) {
    return {
        /**
         * Starts a remote control session for the shared desktop. The main
         * process resolves the display and replies with the result.
         *
         * @param {string} sourceId - The source id of the desktop sharing stream.
         * @returns {Promise<Object>} `{ result: true }` on success, else `{ error }`.
         */
        start: sourceId => {
            if (typeof sourceId !== 'string') {
                return Promise.resolve({ error: 'Error: invalid sourceId' });
            }

            return ipcRenderer.invoke(RC_START, sourceId);
        },

        /**
         * Stops the active remote control session.
         *
         * @returns {void}
         */
        stop: () => ipcRenderer.send(RC_STOP),

        /**
         * Forwards a single mouse/keyboard event to the main process, where it
         * is executed via robotjs.
         *
         * @param {Object} event - The remote control event.
         * @returns {void}
         */
        sendEvent: event => {
            const sanitized = sanitizeEvent(event);

            if (sanitized) {
                ipcRenderer.send(RC_EVENT, sanitized);
            }
        }
    };
};
