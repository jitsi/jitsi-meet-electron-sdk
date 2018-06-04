const electron = require('electron');
const { BrowserWindow, ipcMain } = electron;

const constants = require('./constants');

/**
 * Options to pass into new {@code BrowserWindow} instances if none are
 * specified.
 *
 * @private
 * @type {Object}
 */
const defaultBrowserWindowOptions = {
    webPreferences: {
        nodeIntegration: false
    }
};

/**
 * The configured {@code BrowserWindow} options to pass in to new BrowserWindow
 * instances. This value can be overridden in {@code setupGoogleApiMain}.
 *
 * @private
 * @type {Object}
 */
let browserWindowOptions = defaultBrowserWindowOptions;

/**
 * A reference to the opened Google authentication window. Kept so the window
 * can be closed on call to {@code teardownGoogleApiMain}.
 *
 * @private
 * @type {BrowserWindow|null}
 */
let googlePopup = null;

/**
 * Opens a new {@code BrowserWindow} instance for Google authentication and
 * listens for redirects to a specified redirect URI.
 *
 * @param {Object} authRequestEvent - The event object passed from Electron.
 * @param {Object} options - The additional arguments from the event.
 * @param {string} options.authUrl - The URL to display for authentication.
 * @param {string} options.redirectUri - The URL that is expected to be
 * displayed after successful authentication.
 * @private
 * @returns {void}
 */
function onAuthRequested(authRequestEvent, options) {
    if (googlePopup) {
        googlePopup.focus();
        return;
    }

    googlePopup = new BrowserWindow(browserWindowOptions);

    googlePopup.loadURL(options.authUrl);

    googlePopup.on('closed', () => {
        // Fire this again in case the user closed the modal without finishing
        // authentication.
        authRequestEvent.sender.send(constants.AUTH_FINISHED);

        googlePopup = null;
    });

    googlePopup.webContents.on('did-navigate', (navEvent, url) => {
        if (url.indexOf(options.redirectUri) === 0) {
            authRequestEvent.sender.send(constants.AUTH_FINISHED, url);
            googlePopup.close();
        }
    });
}

/**
 * Sets listeners on the main Electron process to handle requests to open a
 * {@code BrowserWindow} instance for Google authentication.
 *
 * @param {Object} options - Additional configuration for setting up the
 * listeners.
 * @param {Object} browserWindowOptions - The options to pass into the
 * constructor for {@code BrowserWindow}.
 * @returns {void}
 */
function setupGoogleApiMain(options = {}) {
    teardownGoogleApiMain();

    browserWindowOptions
        = options.browserWindowOptions || defaultBrowserWindowOptions;

    ipcMain.on(constants.AUTH_REQUESTED, onAuthRequested);
}

/**
 * Removes listeners on the main Electron process for opening new windows for
 * getting a Google access token.
 *
 * @returns {void}
 */
function teardownGoogleApiMain() {
    ipcMain.removeAllListeners(constants.AUTH_REQUESTED);
    browserWindowOptions = defaultBrowserWindowOptions;

    if (googlePopup) {
        googlePopup.close();
    }
}

module.exports = {
    setupGoogleApiMain,
    teardownGoogleApiMain
};
