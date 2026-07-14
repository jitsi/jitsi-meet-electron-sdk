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

/**
 * The single `window` property the SDK preload exposes and the SDK renderer
 * reads. It is an SDK-internal detail: embedders install it through the
 * preload's `install()` and reach it only through the `setup*Render` helpers,
 * so they never name this key themselves. Kept here as the one source of truth
 * so the preload and renderer halves cannot drift.
 *
 * @type {string}
 */
const BRIDGE_GLOBAL_KEY = 'jitsiElectronSDK';

module.exports = { BRIDGE_API_VERSION, BRIDGE_GLOBAL_KEY };
