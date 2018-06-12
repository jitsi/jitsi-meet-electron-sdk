const setupAlwaysOnTopRender = require('./render.js');
const setupAlwaysOnTopMain = require('./main.js');
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
