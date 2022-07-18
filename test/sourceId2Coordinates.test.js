const assert = require('assert');
const process = require('process');


describe('sourceId2Coordinates', () => {
    describe('native_addon', () => {
        it('returns undefined for fake value', () => {
            if (process.platform === 'win32') {
                const sourceId2Coordinates = require('../node_addons/sourceId2Coordinates');
                const result = sourceId2Coordinates("foo");

                assert.equal(undefined, result);
            }
        });
    });
});