const setupAlwaysOnTopRender = require('./render');
const { cleanupAlwaysOnTopMain, setupAlwaysOnTopMain } = require('./main');

module.exports = {
    cleanupAlwaysOnTopMain,
    setupAlwaysOnTopMain,
    setupAlwaysOnTopRender
};
