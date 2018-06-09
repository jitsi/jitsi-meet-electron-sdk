const { teardownGoogleApiMain } = require('./main');
const { teardownGoogleApiRender } = require('./render');

/**
 * Executes teardown that undoes setup that may have been performed by the
 * googleapi module.
 *
 * @returns {void}
 */
module.exports = function teardownGoogleApi() {
    teardownGoogleApiMain();
    teardownGoogleApiRender();
};
