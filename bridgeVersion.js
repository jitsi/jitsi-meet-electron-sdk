/**
 * Version of the `window.jitsiElectronSDK` bridge contract exposed by
 * `@jitsi/electron-sdk/preload` and consumed by `@jitsi/electron-sdk/renderer`.
 *
 * The preload and renderer entries of the SDK ship in lockstep, so a mismatch
 * at runtime means the app bundled incompatible builds of the two entries. The
 * renderer entry uses this value to fail fast with a descriptive error.
 *
 * @type {number}
 */
const BRIDGE_API_VERSION = 1;

module.exports = { BRIDGE_API_VERSION };
