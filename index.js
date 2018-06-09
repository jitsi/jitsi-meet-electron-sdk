const {
    setupGoogleApiMain,
    setupGoogleApiRender,
    teardownGoogleApi
} = require('./googleapi');
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
    setupGoogleApiMain,
    setupGoogleApiRender,
    setupScreenSharingForWindow,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain,
    setupWiFiStats,
    teardownGoogleApi
};
