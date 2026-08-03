const { EVENTS, KEY_MODIFIERS, KEY_NAMES, MOUSE_BUTTONS, RC_EVENT, RC_START, RC_STOP } = require('./constants');

/**
 * Checks whether a mouse button is one robotjs understands.
 *
 * @param {*} button - The button from the main world event.
 * @returns {boolean} True if the button maps to a robotjs button.
 */
function isValidButton(button) {
    return Object.prototype.hasOwnProperty.call(MOUSE_BUTTONS, button);
}

/**
 * Checks whether a key is one robotjs understands: either a single printable
 * ASCII character or one of the named keys. Anything else makes robotjs throw
 * in the main process.
 *
 * @param {*} key - The key from the main world event.
 * @returns {boolean} True if the key can be handed to robotjs.
 */
function isValidKey(key) {
    if (typeof key !== 'string') {
        return false;
    }

    if (key.length === 1) {
        const code = key.charCodeAt(0);

        return code >= 0x20 && code <= 0x7e;
    }

    return KEY_NAMES.includes(key);
}

/**
 * Whitelists a remote control event before forwarding it to the main process.
 * Only known event types and the recognized, cloneable fields are kept, and
 * every value is checked against what robotjs actually accepts, as
 * defense-in-depth against a compromised main world synthesizing arbitrary OS
 * input (or making robotjs throw in the main process). Anything that doesn't
 * fully validate is dropped rather than partially forwarded, so a bad `button`
 * cannot silently turn a right click into a left click.
 *
 * @param {Object} event - The event payload from the main world.
 * @returns {Object|null} A sanitized payload, or null when the event is invalid.
 */
function sanitizeEvent(event) {
    if (!event || typeof event !== 'object') {
        return null;
    }

    const { button, key, modifiers, type, x, y } = event;

    switch (type) {
    case EVENTS.mousemove:
    case EVENTS.mousescroll:
        // NOTE: Number.isFinite rather than typeof: NaN and Infinity are both
        // 'number' and would flow straight into robotjs.
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }

        return { type, x, y };
    case EVENTS.mousedown:
    case EVENTS.mouseup:
    case EVENTS.mousedblclick:
        // The button is optional; robotjs defaults to the left one.
        if (typeof button === 'undefined') {
            return { type };
        }

        return isValidButton(button) ? { type, button } : null;
    case EVENTS.keydown:
    case EVENTS.keyup: {
        if (!isValidKey(key)) {
            return null;
        }

        // The modifiers are optional.
        if (typeof modifiers === 'undefined') {
            return { type, key };
        }

        if (!Array.isArray(modifiers) || !modifiers.every(modifier => KEY_MODIFIERS.includes(modifier))) {
            return null;
        }

        return { type, key, modifiers: [ ...modifiers ] };
    }
    default:
        return null;
    }
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
