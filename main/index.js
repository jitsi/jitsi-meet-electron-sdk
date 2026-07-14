const setupPictureInPictureMain = require('../pip/main');
const { getPopupTarget } = require('../popupsconfig/functions');
const initPopupsConfigurationMain = require('../popupsconfig/main');
const popupsConfigRegistry = require('../popupsconfig/PopupsConfigRegistry');
const { cleanupPowerMonitorMain, setupPowerMonitorMain } = require('../powermonitor/main');
const setupRemoteControlMain = require('../remotecontrol/main');
const setupScreenSharingMain = require('../screensharing/main');

/**
 * Main-process entry point for `@jitsi/electron-sdk/main`.
 *
 * These are the setup helpers that run in Electron's main process. The entry
 * point name states where the code runs, mirroring the `/preload` and
 * `/renderer` entries.
 */
module.exports = {
    cleanupPowerMonitorMain,
    getPopupTarget,
    initPopupsConfigurationMain,
    popupsConfigRegistry,
    setupPictureInPictureMain,
    setupPowerMonitorMain,
    setupRemoteControlMain,
    setupScreenSharingMain
};
