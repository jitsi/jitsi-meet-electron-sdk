const setupPictureInPictureRender = require('../pip/renderer');
const initPopupsConfigurationRender = require('../popupsconfig/renderer');
const setupPowerMonitorRender = require('../powermonitor/renderer');
const setupScreenSharingRender = require('../screensharing/renderer');

/**
 * Renderer entry point for `@jitsi/electron-sdk/renderer`.
 *
 * These helpers run in the page ("main world") next to the app's web code and
 * `JitsiMeetExternalAPI`. They are browser-safe (no `electron`, `os`, or native
 * modules) and reach the main process only through the `window.jitsiElectronSDK`
 * bridge installed by `@jitsi/electron-sdk/preload`.
 *
 * Remote control is intentionally not exported here yet: it still executes
 * robotjs in the renderer and therefore cannot run under context isolation.
 */
module.exports = {
    initPopupsConfigurationRender,
    setupPictureInPictureRender,
    setupPowerMonitorRender,
    setupScreenSharingRender
};
