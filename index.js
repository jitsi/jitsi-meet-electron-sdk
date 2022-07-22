const { RemoteControl, RemoteControlMain } = require('./remotecontrol');
const { setupScreenSharingRender, setupScreenSharingMain } = require('./screensharing');
const {
    attachAlwaysOnTopToWindow,
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
    attachAlwaysOnTopToWindow,
    getWiFiStats,
    RemoteControl,
    RemoteControlMain,
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
