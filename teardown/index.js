const { teardownGoogleApi } = require('../googleapi');

module.exports = function teardown() {
    teardownGoogleApi();
};
