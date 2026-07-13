const { BRIDGE_API_VERSION } = require('../bridgeVersion');

/**
 * Retrieves a feature fragment from the `window.jitsiElectronSDK` bridge,
 * verifying that the SDK preload is installed and speaks a compatible protocol.
 *
 * @param {string} feature - The bridge fragment name (e.g. 'screenSharing').
 * @returns {Object} The requested bridge fragment.
 * @throws {Error} If the preload is missing, out of date, or lacks the feature.
 */
function getBridge(feature) {
    const sdk = typeof window === 'undefined' ? undefined : window.jitsiElectronSDK;

    if (!sdk) {
        throw new Error(
            '[@jitsi/electron-sdk] window.jitsiElectronSDK is not available. Ensure the app\'s preload '
            + 'script imports \'@jitsi/electron-sdk/preload\' and that the window is created with '
            + 'contextIsolation enabled.'
        );
    }

    if (sdk.apiVersion !== BRIDGE_API_VERSION) {
        throw new Error(
            `[@jitsi/electron-sdk] bridge apiVersion mismatch: preload exposes ${sdk.apiVersion}, `
            + `renderer expects ${BRIDGE_API_VERSION}. The @jitsi/electron-sdk preload and renderer `
            + 'builds are out of sync.'
        );
    }

    const fragment = sdk[feature];

    if (!fragment) {
        throw new Error(
            `[@jitsi/electron-sdk] the '${feature}' bridge fragment is missing from window.jitsiElectronSDK.`
        );
    }

    return fragment;
}

module.exports = { getBridge };
