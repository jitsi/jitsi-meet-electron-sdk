const assert = require('assert');

const { fitWithinWorkArea, getRestoredSize } = require('../pip/bounds');
const { PIP_WINDOW_SIZE } = require('../pip/constants');

describe('getRestoredSize', () => {
    it('falls back to the default size when nothing has been persisted', () => {
        assert.deepStrictEqual(getRestoredSize(), PIP_WINDOW_SIZE);
        assert.deepStrictEqual(getRestoredSize({}), PIP_WINDOW_SIZE);
    });

    it('falls back to the default size when the persisted size is incomplete or not numeric', () => {
        assert.deepStrictEqual(getRestoredSize({ width: 640 }), PIP_WINDOW_SIZE);
        assert.deepStrictEqual(getRestoredSize({ height: '360', width: '640' }), PIP_WINDOW_SIZE);
        assert.deepStrictEqual(getRestoredSize({ height: 360, width: NaN }), PIP_WINDOW_SIZE);
    });

    it('returns the persisted size', () => {
        assert.deepStrictEqual(getRestoredSize({ height: 360, width: 640 }), { height: 360, width: 640 });
    });

    it('raises a persisted dimension below the minimum size to it', () => {
        assert.deepStrictEqual(
            getRestoredSize({ height: 360, width: 100 }),
            { height: 360, width: PIP_WINDOW_SIZE.width });
    });
});

describe('fitWithinWorkArea', () => {
    const workArea = { height: 800, width: 1000, x: 100, y: 50 };

    it('leaves a window inside the work area untouched', () => {
        const windowRectangle = { height: 180, width: 320, x: 400, y: 300 };

        assert.deepStrictEqual(fitWithinWorkArea(windowRectangle, workArea), windowRectangle);
    });

    it('moves a window reaching past the right or bottom edge back inside', () => {
        assert.deepStrictEqual(
            fitWithinWorkArea({ height: 180, width: 320, x: 1000, y: 800 }, workArea),
            { height: 180, width: 320, x: 780, y: 670 });
    });

    it('moves a window reaching past the left or top edge back inside', () => {
        assert.deepStrictEqual(
            fitWithinWorkArea({ height: 180, width: 320, x: -50, y: 0 }, workArea),
            { height: 180, width: 320, x: 100, y: 50 });
    });

    it('scales a window larger than the work area down keeping its aspect ratio', () => {
        assert.deepStrictEqual(
            fitWithinWorkArea({ height: 900, width: 1600, x: 0, y: 0 }, workArea),
            { height: 562, width: 1000, x: 100, y: 50 });
    });
});
