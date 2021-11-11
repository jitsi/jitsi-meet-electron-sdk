import { RemoteControl, RemoteControlMain } from './remotecontrol';
import { setupScreenSharingRender, setupScreenSharingMain } from './screensharing';
import { setupAlwaysOnTopRender, setupAlwaysOnTopMain } from './alwaysontop';
import { getWiFiStats, setupWiFiStats } from './wifistats';
import { setupPowerMonitorRender, setupPowerMonitorMain } from './powermonitor';
import {
    popupsConfigRegistry,
    initPopupsConfigurationMain,
    initPopupsConfigurationRender,
    getPopupTarget
} from './popupsconfig';

export default {
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
