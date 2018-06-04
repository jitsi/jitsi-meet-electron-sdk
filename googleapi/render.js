const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;

const constants = require('./constants');

/**
 * A private reference to the iframe with the Jitsi Meet meeting.
 *
 * @private
 * @type {InlineFrameElement}
 */
let iframe = null;

/**
 * A helper object for performing interactions with the Google API that may not
 * be possible otherwise in Electron with the Google JS Client.
 *
 * @type {Object}
 */
const googleApi = {
    /**
     * Sends a request to the main process to open the passed in Google auth
     * URL and sets a listener for the main process's response.
     *
     * @param {Object} options - An object describing how to handle the auth
     * flow.
     * @param {string} options.authUrl - The Google oauth URL to visit to ask
     * for access to the user's account.
     * @param {string} options.rediredirectUrl - The URL that is expected to be
     * visited after the Google oauth process is complete.
     * @returns {Promise}
     */
    requestToken(options) {
        return new Promise(resolve => {
            ipcRenderer.once(constants.AUTH_FINISHED, (event, url) => {
                resolve(url);
            });

            ipcRenderer.send(constants.AUTH_REQUESTED, options);
        });
    }
};

/**
 * Sets {@code googleApi} on a global variable for Jitsi Meet to access.
 *
 * @private
 * @returns {void}
 */
function setGlobalGoogleApiVariable() {
    if (!iframe) {
        return;
    }

    iframe.contentWindow.JitsiMeetElectron
        = iframe.contentWindow.JitsiMeetElectron || {};

    iframe.contentWindow.JitsiMeetElectron.googleApi = googleApi;
}

/**
 * Sets a global variable on the Jitsi Meet iFrame to expose Google API
 * functionality that needs to be executed in Electron's main context.
 *
 * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
 * @returns {void}
 */
function setupGoogleApiRender(api) {
    teardownGoogleApiRender();

    iframe = api.getIFrame();

    iframe && iframe.addEventListener('load', setGlobalGoogleApiVariable);
}

/**
 * Removes listeners that may have been set for interacting with the Google API.
 *
 * @returns {void}
 */
function teardownGoogleApiRender() {
    if (iframe) {
        iframe.removeEventListener('load', setGlobalGoogleApiVariable);

        if (iframe.contentWindow && iframe.contentWindow.JitsiMeetElectron) {
            delete iframe.contentWindow.JitsiMeetElectron.googleApi;
        }

        iframe = null;
    }

    if (ipcRenderer) {
        ipcRenderer.removeAllListeners(constants.AUTH_FINISHED);
    }
}

module.exports = {
    setupGoogleApiRender,
    teardownGoogleApiRender
};
