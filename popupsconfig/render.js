const { ipcRenderer } = require('electron');

/**
 * Initializes the popup configuration module.
 *
 * @param {JitsiMeetExternalAPI} api - The iframe api instance.
 */
function initPopupsConfiguration(api) {
    if (typeof api._getElectronPopupsConfig === 'function') {
        api._getElectronPopupsConfig()
            .then(configs => {
                ipcRenderer.send('jitsi-popups-configuration', configs);
            })
            .catch(error => console.log(error));
    }
}

module.exports = initPopupsConfiguration;
