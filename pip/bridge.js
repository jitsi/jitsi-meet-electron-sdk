const { PIP_CHANNEL } = require('./constants');

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
        }
    };
};
