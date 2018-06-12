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

    // Configuration for the google auth popup.
    jitsiMeetWindow.webContents.on('new-window', (
            event,
            url,
            frameName,
            disposition,
            options) => {
                console.log(popupsConfigRegistry);
        const config
            = popupsConfigRegistry.getConfigByName('google-auth') || {};
        if (testMatchPatterns(url, frameName, config.matchPatterns)) {
            event.preventDefault();
            event.newGuest = new BrowserWindow(Object.assign(options, {
                titleBarStyle: undefined,
                webPreferences: {
                    nodeIntegration: false
                }
            }));
        }
    });
}

module.exports = initPopupsConfiguration;
