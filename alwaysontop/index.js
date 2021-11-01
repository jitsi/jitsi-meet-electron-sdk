const setupAlwaysOnTopRender = require('./render');
const setupAlwaysOnTopMain = require('./main');
const { popupsConfigRegistry } = require('../popupsconfig');

popupsConfigRegistry.registerPopupConfig('always-on-top', {
    matchPatterns: {
        frameName: 'AlwaysOnTop'
    },
    target: 'electron'
});

module.exports = {
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
};
