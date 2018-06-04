const { setupGoogleApiMain } = require('./main');
const { setupGoogleApiRender } = require('./render');
const teardownGoogleApi = require('./teardown');

module.exports = {
    setupGoogleApiMain,
    setupGoogleApiRender,
    teardownGoogleApi
};
