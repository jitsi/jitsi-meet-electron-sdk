import popupsConfigRegistry from './PopupsConfigRegistry.mjs';
import { testMatchPatterns } from './functions.mjs';
import { popupConfigs } from './constants.mjs';

/**
 * Initializes the popup configuration module.
 *
 * @param {BrowserWindow} jitsiMeetWindow - The window where jitsi meet is rendered.
 * @param {Function} existingWindowOpenHandler - A window open handler that will be called after the local
 * window open handler is executed. This parameter is useful when the consumer of the api wants to avoid overwriting
 * the host app window open handler.
 * @returns {void}
 */
export default function initPopupsConfiguration(jitsiMeetWindow, externalWindowOpenHandler) {
    popupsConfigRegistry.registerPopupConfigs(popupConfigs);

    // Configuration for the google auth popup.
    jitsiMeetWindow.webContents.setWindowOpenHandler(details => {
        const { url, frameName } = details;
        const configGoogle
            = popupsConfigRegistry.getConfigByName('google-auth') || {};
        if (testMatchPatterns(url, frameName, configGoogle.matchPatterns)) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    webPreferences: { nodeIntegration: false }
                }
            };
        }

        const configDropbox
            = popupsConfigRegistry.getConfigByName('dropbox-auth') || {};

        if (testMatchPatterns(url, frameName, configDropbox.matchPatterns)) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    webPreferences: { nodeIntegration: false }
                }
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
