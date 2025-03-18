import { describe, it } from 'mocha';
import assert from 'node:assert';
import process from 'node:process';
import sourceId2Coordinates from '../node_addons/sourceId2Coordinates/index.js'; 

describe('sourceId2Coordinates', () => {
    describe('native_addon', () => {
        it('returns undefined for fake value', () => {
            if (process.platform === 'win32') {
                const result = sourceId2Coordinates("foo");
                assert.equal(undefined, result);
            }
        });
    });
});