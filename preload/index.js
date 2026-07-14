const { contextBridge, ipcRenderer } = require('electron');

const { BRIDGE_API_VERSION, BRIDGE_GLOBAL_KEY } = require('../bridgeVersion');
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

/**
 * Installs the SDK bridge onto the main world. Call this once from the app's
 * preload script (which must run with contextIsolation enabled). It is an
 * explicit call rather than an import side effect so the embedder controls when
 * the bridge is installed. The window key it uses is an SDK-internal detail
 * (see {@link BRIDGE_GLOBAL_KEY}); embedders reach the bridge only through the
 * `@jitsi/electron-sdk/renderer` `setup*Render` helpers, never by name.
 *
 * @returns {void}
 */
function install() {
    const context = { ipcRenderer, subscribe };

    // The single, namespaced bridge object the SDK exposes to the main world.
    const jitsiElectronSDK = {
        apiVersion: BRIDGE_API_VERSION,
        pip: createPipBridge(context),
        powerMonitor: createPowerMonitorBridge(context),
        remoteControl: createRemoteControlBridge(context),
        screenSharing: createScreenSharingBridge(context)
    };

    try {
        contextBridge.exposeInMainWorld(BRIDGE_GLOBAL_KEY, jitsiElectronSDK);
    } catch (error) {
        // exposeInMainWorld throws if the key is already registered (install was
        // called more than once in the same context) or if contextBridge is
        // unavailable (the window was created without contextIsolation). Both are
        // non-fatal here: the first registration stands.
        console.warn(
            '[@jitsi/electron-sdk] Could not expose the SDK bridge. Ensure the window is '
            + 'created with contextIsolation enabled and that install() is called only once.',
            error && error.message
        );
    }
}

module.exports = { install };
