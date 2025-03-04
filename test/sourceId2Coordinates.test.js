import assert from 'assert';
import process from 'process';

describe('sourceId2Coordinates', () => {
    describe('native_addon', () => {
        it('returns undefined for fake value', async () => {
            if (process.platform === 'win32') {
                const sourceId2CoordinatesModule = await import('../node_addons/sourceId2Coordinates.js');
                const sourceId2Coordinates = sourceId2CoordinatesModule.default || sourceId2CoordinatesModule;
                const result = sourceId2Coordinates("foo");

                assert.equal(undefined, result);
            }
        });
    });
});
