const { ipcRenderer, remote } = require('electron');


/**
 * Initializes the popup configuration module.
 *
 * @param {JitsiMeetExternalAPI} api - The iframe api instance.
 */
function initPopupsConfiguration(api) {
    function _navigateListener(event, url, frameName, winId) {
        if (url.indexOf('/static/oauth.html#') !== -1) {
            const iframe = api.getIFrame();

            if (!iframe) {
                return;
            }

            const iframeWindow = iframe.contentWindow;
            if(iframeWindow
                && typeof iframeWindow.JitsiMeetJS !== 'undefined'
                && typeof iframeWindow.JitsiMeetJS.app !== 'undefined'
                && typeof iframeWindow.JitsiMeetJS.app.oauthCallbacks
                    !== 'undefined'
                && typeof iframeWindow.JitsiMeetJS.app.oauthCallbacks[frameName]
                    !== 'undefined') {
                iframeWindow.JitsiMeetJS.app.oauthCallbacks[frameName](url);
                const popup = remote.BrowserWindow.fromId(winId);
                if(popup) {
                    popup.close();
                }
            }
        }
    }

    ipcRenderer.on('jitsi-popups-navigate', _navigateListener);
    api.on('_willDispose', () => {
        ipcRenderer.removeListener('jitsi-popups-navigate', _navigateListener);
    });
}

module.exports = initPopupsConfiguration;
