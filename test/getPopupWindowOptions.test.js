const assert = require('assert');

const popupsConfigRegistry = require('../popupsconfig/PopupsConfigRegistry');
const { getPopupWindowOptions } = require('../popupsconfig/functions');

/**
 * Builds window open handler details for a popup with the given frame name.
 * Each test uses its own frame name, because the registry is a singleton that
 * keeps the configurations registered by earlier tests.
 *
 * @param {string} frameName - The popup's frame name.
 * @returns {Object} The details.
 */
function createDetails(frameName) {
    return {
        frameName,
        url: 'about:blank'
    };
}

/**
 * Registers a configuration matching the given frame name exactly.
 *
 * @param {string} name - The configuration name.
 * @param {string} frameName - The frame name to match.
 * @param {Object|Function} overrideBrowserWindowOptions - The options to provide.
 * @returns {void}
 */
function register(name, frameName, overrideBrowserWindowOptions) {
    popupsConfigRegistry.registerPopupConfig(name, {
        matchPatterns: { frameName: `^${frameName}$` },
        overrideBrowserWindowOptions
    });
}

describe('getPopupWindowOptions', () => {
    it('returns undefined when no configuration matches', () => {
        assert.strictEqual(getPopupWindowOptions(createDetails('unknown-popup')), undefined);
    });

    it('ignores matching configurations without options', () => {
        popupsConfigRegistry.registerPopupConfig('target-only', {
            matchPatterns: { frameName: '^target-only-popup$' },
            target: 'electron'
        });

        assert.strictEqual(getPopupWindowOptions(createDetails('target-only-popup')), undefined);
    });

    it('returns the options of a single matching configuration', () => {
        register('single', 'single-popup', { frame: false, width: 320 });

        assert.deepStrictEqual(getPopupWindowOptions(createDetails('single-popup')), { frame: false, width: 320 });
    });

    it('calls an options function with the details and skips it when it declines', () => {
        const details = createDetails('declining-popup');
        let receivedDetails;

        register('declining', 'declining-popup', received => {
            receivedDetails = received;

            return undefined;
        });

        assert.strictEqual(getPopupWindowOptions(details), undefined);
        assert.strictEqual(receivedDetails, details);
    });

    it('merges the options of all matching configurations, later ones winning on the same key', () => {
        register('merge-base', 'merged-popup', { frame: false, show: false, width: 320 });
        register('merge-extra', 'merged-popup', () => ({ show: true, skipTaskbar: true }));

        assert.deepStrictEqual(getPopupWindowOptions(createDetails('merged-popup')), {
            frame: false,
            show: true,
            skipTaskbar: true,
            width: 320
        });
    });

    it('merges webPreferences so an added flag keeps the flags set by another configuration', () => {
        register('prefs-base', 'prefs-popup', { webPreferences: { nodeIntegration: false } });
        register('prefs-extra', 'prefs-popup', { webPreferences: { sandbox: false } });

        assert.deepStrictEqual(getPopupWindowOptions(createDetails('prefs-popup')), {
            webPreferences: {
                nodeIntegration: false,
                sandbox: false
            }
        });
    });
});
