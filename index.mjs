// ES Module entry point for @jitsi/electron-sdk
// Provides full ES module support alongside CommonJS (index.js)

export { setupRemoteControlMain, setupRemoteControlRender } from './remotecontrol/index.mjs';
export { setupScreenSharingRender, setupScreenSharingMain } from './screensharing/index.mjs';
export {
    cleanupPowerMonitorMain,
    setupPowerMonitorRender,
    setupPowerMonitorMain
} from './powermonitor/index.mjs';
export {
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
} from './popupsconfig/index.mjs';
export {
    setupPictureInPictureRender,
    setupPictureInPictureMain
} from './pip/index.mjs';

