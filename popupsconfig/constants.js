/**
 * BrowserWindow options for the OAuth popups: a plain page with no Node access.
 */
const OAUTH_POPUP_WINDOW_OPTIONS = {
    webPreferences: { nodeIntegration: false }
};

const popupConfigs = {
    'google-auth': {
        matchPatterns: {
            url: '^https:\\/\\/(www\\.)?accounts\\.google\\.com\\/'
        },
        overrideBrowserWindowOptions: OAUTH_POPUP_WINDOW_OPTIONS,
        target: 'electron'
    },
    'dropbox-auth': {
        matchPatterns: {
            url: '^https:\\/\\/(www\\.)?dropbox\\.com\\/oauth2\\/authorize'
        },
        overrideBrowserWindowOptions: OAUTH_POPUP_WINDOW_OPTIONS,
        target: 'electron'
    }
};

module.exports = {
    popupConfigs
};
