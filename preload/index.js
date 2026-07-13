const { contextBridge, ipcRenderer } = require('electron');

const { BRIDGE_API_VERSION } = require('../bridgeVersion');
const createPipBridge = require('../pip/bridge');
const createPowerMonitorBridge = require('../powermonitor/bridge');
const createRemoteControlBridge = require('../remotecontrol/bridge');
const createScreenSharingBridge = require('../screensharing/bridge');

/**
 * Subscribes to an ipcRenderer channel, stripping the non-cloneable
 * `IpcRendererEvent` so only the payload crosses the contextBridge. The
 * returned function removes the listener.
 *
 * @param {string} channel - The IPC channel to listen on.
 * @param {Function} callback - Invoked with the payload for each message.
 * @returns {Function} An unsubscribe function.
 */
function subscribe(channel, callback) {
    const listener = (_event, payload) => callback(payload);

    ipcRenderer.on(channel, listener);

    return () => ipcRenderer.removeListener(channel, listener);
}

const context = { ipcRenderer, subscribe };

/**
 * The single, namespaced bridge object the SDK exposes to the main world. The
 * renderer entry (`@jitsi/electron-sdk/renderer`) talks to the main process
 * only through this surface.
 */
const jitsiElectronSDK = {
    apiVersion: BRIDGE_API_VERSION,
    pip: createPipBridge(context),
    powerMonitor: createPowerMonitorBridge(context),
    remoteControl: createRemoteControlBridge(context),
    screenSharing: createScreenSharingBridge(context)
};

try {
    contextBridge.exposeInMainWorld('jitsiElectronSDK', jitsiElectronSDK);
} catch (error) {
    // exposeInMainWorld throws if the key is already registered (this module was
    // evaluated more than once in the same context) or if contextBridge is
    // unavailable (the window was created without contextIsolation). Both are
    // non-fatal here: the first, identical registration stands.
    console.warn(
        '[@jitsi/electron-sdk] Could not expose the jitsiElectronSDK bridge. Ensure the window is '
        + 'created with contextIsolation enabled and that the SDK preload is loaded only once.',
        error && error.message
    );
}
