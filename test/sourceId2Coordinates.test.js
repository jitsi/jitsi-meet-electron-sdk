const sourceId2Coordinates = require('../node_addons/sourceId2Coordinates');
const assert = require('assert');


describe('sourceId2Coordinates', () => {
    describe('native_addon', () => {
        it('returns undefined for fake value', () => {
            const result = sourceId2Coordinates("foo");

            assert.equal(undefined, result);
        });
    });
});