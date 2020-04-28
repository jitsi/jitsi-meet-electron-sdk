const electron = require('electron');
const { BrowserWindow, ipcMain } = electron;
const popupsConfigRegistry = require('./PopupsConfigRegistry');
const { testMatchPatterns } = require('./functions');

/**
 * Initializes the popup configuration module.
 *
 * @param {BrowserWindow} jitsiMeetWindow - The window where jitsi meet is
 * rendered
 */
function initPopupsConfiguration(jitsiMeetWindow) {
    ipcMain.on('jitsi-popups-configuration', (event, configs = {}) => {
        popupsConfigRegistry.registerPopupConfigs(configs);
    });

    // Remove X-Frame-Option and CSP frame-anchestor headers from responses, to
    // allow us to show login pages from the server, even if it sets those
    // headers. This is for example often needed for Shiboleth authentication.
    var onHeadersReceived=(detail, callback) => {
        const xFrameOriginKey = Object.keys(detail.responseHeaders).find(
          header => String(header).match(/^x-frame-options$/i));
        const cspKey = Object.keys(detail.responseHeaders).find(
          header => String(header).match(/^content-security-policy$/i));
        if (xFrameOriginKey) {
            delete detail.responseHeaders[xFrameOriginKey];
        }
        if (cspKey) {
            detail.responseHeaders[cspKey] = detail.responseHeaders[cspKey]
                .toString().replace(/frame-ancestors [^;]*;/, "");
        }
        callback({cancel: false, responseHeaders: detail.responseHeaders});
    }
    jitsiMeetWindow.webContents.session.webRequest.onHeadersReceived(
        onHeadersReceived);

    // Configuration for the google auth popup.
    jitsiMeetWindow.webContents.on('new-window', (
            event,
            url,
            frameName,
            disposition,
            options) => {
        const configGoogle
            = popupsConfigRegistry.getConfigByName('google-auth') || {};
        if (testMatchPatterns(url, frameName, configGoogle.matchPatterns)) {
            event.preventDefault();
            event.newGuest = new BrowserWindow(Object.assign(options, {
                titleBarStyle: undefined,
                webPreferences: {
                    contextIsolation: false,
                    nodeIntegration: false,
                    webviewTag: true
                }
            }));
        }

        const configDropbox
            = popupsConfigRegistry.getConfigByName('dropbox-auth') || {};

        if (testMatchPatterns(url, frameName, configDropbox.matchPatterns)) {
            event.preventDefault();
            const win
                = event.newGuest = new BrowserWindow(Object.assign(options, {
                    titleBarStyle: undefined,
                    webPreferences: {
                        nodeIntegration: false,
                        webSecurity: false,
                        sandbox: true
                    }
                }));
            win.webContents.on('did-navigate', (event, url) => {
                jitsiMeetWindow.webContents.send(
                    'jitsi-popups-navigate', url, frameName, win.id);
            });
        }
    });
}

module.exports = initPopupsConfiguration;
