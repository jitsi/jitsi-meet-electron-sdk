const { PIP_CHANNEL, PIP_FOCUS_MAIN_CHANNEL, PIP_RESET_WINDOW_SIZE_CHANNEL } = require('./constants');

/**
 * Builds the picture-in-picture fragment of the `window.jitsiElectronSDK`
 * bridge.
 *
 * @param {Object} context - Preload helpers.
 * @param {Electron.IpcRenderer} context.ipcRenderer - The ipcRenderer instance.
 * @returns {Object} The picture-in-picture bridge API.
 */
module.exports = function createPipBridge({ ipcRenderer }) {
    return {
        /**
         * Requests the main process to trigger picture-in-picture for the given
         * frame. Non-string frame names are ignored (the main process guards
         * against a falsy frame name anyway).
         *
         * @param {string} frameName - The name of the iframe requesting PiP.
         * @returns {void}
         */
        request: frameName => {
            if (typeof frameName === 'string') {
                ipcRenderer.send(PIP_CHANNEL, frameName);
            }
        },

        /**
         * Asks the main process to focus the window hosting the meeting. Sent
         * when the user double clicks the custom PiP window (the legacy
         * always-on-top double-click behavior).
         *
         * @returns {void}
         */
        focusMainWindow: () => {
            ipcRenderer.send(PIP_FOCUS_MAIN_CHANNEL);
        },

        /**
         * Tells the main process that the meeting is over, so that the next
         * PiP window opens at the default size again instead of the size the
         * user picked during the meeting.
         *
         * @returns {void}
         */
        resetWindowSize: () => {
            ipcRenderer.send(PIP_RESET_WINDOW_SIZE_CHANNEL);
        }
    };
};
