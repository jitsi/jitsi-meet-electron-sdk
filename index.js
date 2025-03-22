import { RemoteControl, RemoteControlMain } from './remotecontrol/index.js';
import { setupScreenSharingRender, setupScreenSharingMain } from './screensharing/index.js';
import {
    cleanupAlwaysOnTopMain,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain
} from './alwaysontop/index.js';
import {
    cleanupPowerMonitorMain,
    setupPowerMonitorRender,
    setupPowerMonitorMain
} from './powermonitor/index.js';
import {
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
} from './popupsconfig/index.js';

export {
    RemoteControl,
    RemoteControlMain,
    cleanupAlwaysOnTopMain,
    cleanupPowerMonitorMain,
    setupScreenSharingRender,
    setupScreenSharingMain,
    setupAlwaysOnTopRender,
    setupAlwaysOnTopMain,
    setupPowerMonitorRender,
    setupPowerMonitorMain,
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
};
