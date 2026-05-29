const setupScreenSharingMain = require('./main');
const setupScreenSharingRender = require('./render');

const {
    SCREEN_SHARE_PRELOAD_PATH,
    SCREEN_SHARE_TRACKER_HTML_PATH
} = setupScreenSharingMain;

module.exports = {
    setupScreenSharingMain,
    setupScreenSharingRender,
    SCREEN_SHARE_PRELOAD_PATH,
    SCREEN_SHARE_TRACKER_HTML_PATH
};
