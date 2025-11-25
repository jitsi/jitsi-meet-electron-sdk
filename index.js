const { setupRemoteControlMain, setupRemoteControlRender } = require('./remotecontrol');
const { setupScreenSharingRender, setupScreenSharingMain } = require('./screensharing');
const {
    cleanupPowerMonitorMain,
    setupPowerMonitorRender,
    setupPowerMonitorMain
} = require('./powermonitor');
const {
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
} = require('./popupsconfig');
const {
    setupPictureInPictureRender,
    setupPictureInPictureMain
} = require('./pip');

module.exports = {
    cleanupPowerMonitorMain,
    setupScreenSharingRender,
    setupScreenSharingMain,
    setupPowerMonitorRender,
    setupPowerMonitorMain,
    setupRemoteControlMain,
    setupRemoteControlRender,
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget,
    setupPictureInPictureRender,
    setupPictureInPictureMain
};
