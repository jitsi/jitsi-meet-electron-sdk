const popupsConfigRegistry = require('./PopupsConfigRegistry');

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
 * Tests passed regular expressions agains the url and frameName parameters.
 *
 * @param {string} url - The URL.
 * @param {string} frameName - The frame name.
 * @param {Object} matchPatterns - An object with regular expresions for url
 * and/or frame name
 * @param {string} matchPatterns.url
 * @param {string} matchPatterns.frameName
 * @returns {boolean} - Returns true if url or frameName match the passed
 * regular expresions.
 */
function testMatchPatterns(url, frameName, matchPatterns = {}) {
    let urlMatched = false;
    let frameNameMatched = false;

    if (typeof matchPatterns.url !== 'undefined'
        && typeof url !== 'undefined') {
        urlMatched = RegExp(matchPatterns.url).test(url);
    }

    if (typeof matchPatterns.frameName !== 'undefined'
        && typeof frameName !== 'undefined') {
        frameNameMatched
            = RegExp(matchPatterns.frameName).test(frameName);
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

module.exports = {
    getPopupTarget,
    testMatchPatterns
};
