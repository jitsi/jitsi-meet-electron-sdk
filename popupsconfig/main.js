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
    jitsiMeetWindow.webContents.setWindowOpenHandler(({url, frameName}) => {
        const configGoogle
            = popupsConfigRegistry.getConfigByName('google-auth') || {};
        if (testMatchPatterns(url, frameName, configGoogle.matchPatterns)) {
            return { action: 'allow' };
        }

        const configDropbox
            = popupsConfigRegistry.getConfigByName('dropbox-auth') || {};

        if (testMatchPatterns(url, frameName, configDropbox.matchPatterns)) {
            return { action: 'allow' };
        }

        return { action: 'deny' };
    });
}

module.exports = initPopupsConfiguration;
