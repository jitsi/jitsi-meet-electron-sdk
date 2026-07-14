const setupPictureInPictureRender = require('../pip/renderer');
const initPopupsConfigurationRender = require('../popupsconfig/renderer');
const setupPowerMonitorRender = require('../powermonitor/renderer');
const setupRemoteControlRender = require('../remotecontrol/renderer');
const setupScreenSharingRender = require('../screensharing/renderer');

/**
 * Renderer entry point for `@jitsi/electron-sdk/renderer`.
 *
 * These helpers run in the page ("main world") next to the app's web code and
 * `JitsiMeetExternalAPI`. They are browser-safe (no `electron`, `os`, or native
 * modules) and reach the main process only through the `window.jitsiElectronSDK`
 * bridge installed by `@jitsi/electron-sdk/preload`. Remote control forwards its
 * mouse/keyboard events to the main process, where robotjs executes them.
 */
module.exports = {
    initPopupsConfigurationRender,
    setupPictureInPictureRender,
    setupPowerMonitorRender,
    setupRemoteControlRender,
    setupScreenSharingRender
};
