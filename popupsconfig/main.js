const electron = require('electron');
const { BrowserWindow } = electron;
const popupsConfigRegistry = require('./PopupsConfigRegistry');
const { testMatchPatterns } = require('./functions');
const { popupConfigs } = require('./constants');

/**
 * Initializes the popup configuration module.
 *
 * @param {BrowserWindow} jitsiMeetWindow - The window where jitsi meet is
 * rendered
 */
function initPopupsConfiguration(jitsiMeetWindow) {
    popupsConfigRegistry.registerPopupConfigs(popupConfigs);

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
                    contextIsolation: true,
                    enableBlinkFeatures: undefined,
                    enableRemoteModule: false,
                    nodeIntegration: false,
                    preload: false,
                    webSecurity: true
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
                        contextIsolation: true,
                        enableBlinkFeatures: undefined,
                        enableRemoteModule: false,
                        nodeIntegration: false,
                        preload: false,
                        webSecurity: true,
                        sandbox: true
                    }
                }));

            const closeHandler = () => {
                if (win) {
                    win.close();
                }
            };

            electron.ipcMain.on('jitsi-popups-close', closeHandler);
            win.on('close', () => {
                electron.ipcMain.removeListener('jitsi-popups-close', closeHandler);
            });

            win.webContents.on('did-navigate', (event, url) => {
                jitsiMeetWindow.webContents.send(
                    'jitsi-popups-navigate', url, frameName);
            });
        }
    });
}

module.exports = initPopupsConfiguration;
