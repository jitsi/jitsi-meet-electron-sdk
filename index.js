const { ipcMain, ipcRenderer} = require('electron');

if (ipcMain) {
    // we are imported in main process, so export all functions meant for main process
    const { RemoteControlMain } = require('./remotecontrol');
    const { setupScreenSharingMain } = require('./screensharing');
    const {
        cleanupAlwaysOnTopMain,
        setupAlwaysOnTopMain
    } = require('./alwaysontop');
    const {
        cleanupPowerMonitorMain,
        setupPowerMonitorMain
    } = require('./powermonitor');
    const {
        popupsConfigRegistry,
        initPopupsConfigurationMain,
        getPopupTarget
    } = require('./popupsconfig');
    
    module.exports = {
        RemoteControlMain,
        cleanupAlwaysOnTopMain,
        cleanupPowerMonitorMain,
        setupScreenSharingMain,
        setupAlwaysOnTopMain,
        setupPowerMonitorMain,
        popupsConfigRegistry,
        initPopupsConfigurationMain,
        getPopupTarget
    };
} else if (ipcRenderer) {
    // we are imported into renderer, only export functions meant for renderer
    const { RemoteControl } = require('./remotecontrol/render');
    const { setupScreenSharingRender } = require('./screensharing/render');
    const { setupAlwaysOnTopRender } = require('./alwaysontop/render');
    const { getWiFiStats, setupWiFiStats } = require('./wifistats');
    const { setupPowerMonitorRender } = require('./powermonitor/render');
    const { initPopupsConfigurationRender } = require('./popupsconfig/render');
    
    module.exports = {
        RemoteControl,
        setupScreenSharingRender,
        setupAlwaysOnTopRender,
        setupPowerMonitorRender,
        getWiFiStats,
        setupWiFiStats,
        initPopupsConfigurationRender
    };
}