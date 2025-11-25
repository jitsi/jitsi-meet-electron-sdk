const { setupRemoteControlMain, setupRemoteControlRender } = require('./remotecontrol');
const { setupScreenSharingRender, setupScreenSharingMain } = require('./screensharing');
const {
    cleanupAlwaysOnTopMain,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
} = require('./alwaysontop');
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

module.exports = {
    cleanupAlwaysOnTopMain,
    cleanupPowerMonitorMain,
    setupScreenSharingRender,
    setupScreenSharingMain,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain,
    setupPowerMonitorRender,
    setupPowerMonitorMain,
    setupRemoteControlMain,
    setupRemoteControlRender,
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
};
