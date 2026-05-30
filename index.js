// Legacy compatibility root entry.
//
// This file preserves the original named exports for existing consumers using
// require('@jitsi/electron-sdk').  New bundler / esbuild users should import
// process-specific sub-paths instead (see README.md), because each feature's
// module imports Electron APIs and/or native addons that esbuild cannot
// statically analyse.
//
// Exports are defined as lazy getters so that feature modules (and their
// Electron / native-addon imports) are only loaded when a specific export is
// first accessed, rather than all at once on package load.

Object.defineProperties(module.exports, {
    // ── Screen sharing ──────────────────────────────────────────────────
    setupScreenSharingMain: {
        enumerable: true,
        get() { return require('./screensharing/main'); }
    },
    setupScreenSharingRender: {
        enumerable: true,
        get() { return require('./screensharing/render'); }
    },

    // ── Power monitor ────────────────────────────────────────────────────
    setupPowerMonitorMain: {
        enumerable: true,
        get() { return require('./powermonitor/main').setupPowerMonitorMain; }
    },
    cleanupPowerMonitorMain: {
        enumerable: true,
        get() { return require('./powermonitor/main').cleanupPowerMonitorMain; }
    },
    setupPowerMonitorRender: {
        enumerable: true,
        get() { return require('./powermonitor/render'); }
    },

    // ── Remote control ───────────────────────────────────────────────────
    setupRemoteControlMain: {
        enumerable: true,
        get() { return require('./remotecontrol/main'); }
    },
    setupRemoteControlRender: {
        enumerable: true,
        get() { return require('./remotecontrol/render'); }
    },

    // ── Popups configuration ─────────────────────────────────────────────
    popupsConfigRegistry: {
        enumerable: true,
        get() { return require('./popupsconfig/PopupsConfigRegistry'); }
    },
    initPopupsConfigurationMain: {
        enumerable: true,
        get() { return require('./popupsconfig/main'); }
    },
    initPopupsConfigurationRender: {
        enumerable: true,
        get() { return require('./popupsconfig/render'); }
    },
    getPopupTarget: {
        enumerable: true,
        get() { return require('./popupsconfig/functions').getPopupTarget; }
    },

    // ── Picture in picture ───────────────────────────────────────────────
    setupPictureInPictureRender: {
        enumerable: true,
        get() { return require('./pip/render'); }
    },
    setupPictureInPictureMain: {
        enumerable: true,
        get() { return require('./pip/main'); }
    }
});
