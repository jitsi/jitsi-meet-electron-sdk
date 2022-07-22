const setupAlwaysOnTopRender = require('./render');
const { attachAlwaysOnTopToWindow, setupAlwaysOnTopMain } = require('./main');
const { popupsConfigRegistry } = require('../popupsconfig');

popupsConfigRegistry.registerPopupConfig('always-on-top', {
    matchPatterns: {
        frameName: 'AlwaysOnTop'
    },
    target: 'electron'
});

module.exports = {
    attachAlwaysOnTopToWindow,
    setupAlwaysOnTopMain,
    setupAlwaysOnTopRender
};
