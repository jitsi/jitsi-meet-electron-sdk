const popupsConfigRegistry = require('./PopupsConfigRegistry');
const { getPopupWindowOptions } = require('./functions');
const { popupConfigs } = require('./constants');

/**
 * Initializes the popup configuration module.
 *
 * @param {BrowserWindow} jitsiMeetWindow - The window where jitsi meet is rendered.
 * @param {Function} externalWindowOpenHandler - A window open handler that will be called for the window.open
 * requests no registered popup configuration claims. This parameter is useful when the consumer of the api wants to
 * avoid overwriting the host app window open handler.
 * @returns {void}
 */
function initPopupsConfiguration(jitsiMeetWindow, externalWindowOpenHandler) {
    popupsConfigRegistry.registerPopupConfigs(popupConfigs);

    jitsiMeetWindow.webContents.setWindowOpenHandler(details => {
        const overrideBrowserWindowOptions = getPopupWindowOptions(details);

        if (overrideBrowserWindowOptions) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions
            };
        }

        if (externalWindowOpenHandler) {
            try {
                return externalWindowOpenHandler(details);
            } catch (e) {
                console.error(`Error while executing external window open handler: ${e}`);
            }
        }

        return { action: 'deny' };
    });
}

module.exports = initPopupsConfiguration;
