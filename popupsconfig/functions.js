import popupsConfigRegistry from './PopupsConfigRegistry.js';  // Adjust path if necessary

/**
 * Finds a config object from the popup config registry that will match the
 * passed URL or frame name.
 *
 * @param {string} url - The URL.
 * @param {string} frameName - The frame name.
 * @returns {Object|undefined} - A config object from the popup config registry
 * or undefined if no config object has been found.
 */
function _findConfig(url, frameName) {
    return popupsConfigRegistry.getAllConfigs().find(({ matchPatterns }) =>
        testMatchPatterns(url, frameName, matchPatterns));
}

/**
 * Tests passed regular expressions against the url and frameName parameters.
 *
 * @param {string} url - The URL.
 * @param {string} frameName - The frame name.
 * @param {Object} matchPatterns - An object with regular expressions for url
 * and/or frame name
 * @param {string} matchPatterns.url
 * @param {string} matchPatterns.frameName
 * @returns {boolean} - Returns true if url or frameName match the passed
 * regular expressions.
 */
function testMatchPatterns(url, frameName, matchPatterns = {}) {
    let urlMatched = false;
    let frameNameMatched = false;

    if (typeof matchPatterns.url !== 'undefined' && typeof url !== 'undefined') {
        try {
            urlMatched = RegExp(matchPatterns.url).test(url);
        } catch (error) {
            console.error('Invalid URL regex pattern:', matchPatterns.url);
        }
    }

    if (typeof matchPatterns.frameName !== 'undefined' && typeof frameName !== 'undefined') {
        try {
            frameNameMatched = RegExp(matchPatterns.frameName).test(frameName);
        } catch (error) {
            console.error('Invalid frameName regex pattern:', matchPatterns.frameName);
        }
    }

    return urlMatched || frameNameMatched;
}

/**
 * Returns the target property from the config object that corresponds to the
 * passed url and frameName.
 *
 * @param {string} url - The URL.
 * @param {string} frameName - The frame name.
 * @returns {string|undefined} - Returns the target property from the found
 * config object or undefined if a matching config object hasn't been found.
 */
function getPopupTarget(url, frameName) {
    let config = _findConfig(url, frameName) || {};
    return config.target;
}

export {
    getPopupTarget,
    testMatchPatterns
};
