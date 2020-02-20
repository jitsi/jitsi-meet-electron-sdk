const RemoteControl = require('./remotecontrol');
const { setupScreenSharingRender, setupScreenSharingMain } = require('./screensharing');
const {
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
} = require('./alwaysontop');
const { getWiFiStats, setupWiFiStats } = require('./wifistats');
const { setupPowerMonitorRender, setupPowerMonitorMain } = require('./powermonitor');
const {
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
} = require('./popupsconfig');

module.exports = {
    getWiFiStats,
    RemoteControl,
    setupScreenSharingRender,
    setupScreenSharingMain,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain,
    setupPowerMonitorRender,
    setupPowerMonitorMain,
    setupWiFiStats,
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
};
