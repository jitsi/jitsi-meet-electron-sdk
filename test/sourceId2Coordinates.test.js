import { describe, it } from 'mocha';
import assert from 'node:assert';
import process from 'node:process';

describe('sourceId2Coordinates', () => {
    describe('native_addon', () => {
        it('returns undefined for fake value', async () => { // Fixed: 'if' → 'it'
            if (process.platform === 'win32') {
                const sourceId2CoordinatesModule = await import('../node_addons/sourceId2Coordinates.js');
                const sourceId2Coordinates = sourceId2CoordinatesModule.default || sourceId2CoordinatesModule;
                const result = sourceId2Coordinates("foo");

                assert.equal(undefined, result);
            }
        });
    });
});
