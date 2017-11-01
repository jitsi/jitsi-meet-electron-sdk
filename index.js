const RemoteControl = require('./remotecontrol');
const setupScreenSharingForWindow = require('./screensharing');
const {
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
} = require('./alwaysontop');
const { getWiFiStats, setupWiFiStats } = require('./wifistats');

module.exports = {
    getWiFiStats,
    RemoteControl,
    setupScreenSharingForWindow,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain,
    setupWiFiStats
};
