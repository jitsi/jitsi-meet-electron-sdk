const assert = require('assert');

const {
    buildDisplayMetrics,
    getMacDisplayBySourceId,
    getWindowsDisplayBySourceId
} = require('../remotecontrol/displayUtils');

describe('displayUtils', () => {
    describe('buildDisplayMetrics', () => {
        it('uses nativeOrigin when requested', () => {
            const metrics = buildDisplayMetrics({
                bounds: {
                    height: 900,
                    width: 1600,
                    x: 1280,
                    y: 0
                },
                nativeOrigin: {
                    x: 1920,
                    y: 0
                },
                scaleFactor: 1.5
            }, true);

            assert.deepEqual(metrics, {
                bounds: {
                    height: 900,
                    width: 1600,
                    x: 1920,
                    y: 0
                },
                scaleFactor: 1.5
            });
        });
    });

    describe('getWindowsDisplayBySourceId', () => {
        it('matches screen sources by display_id', () => {
            const metrics = getWindowsDisplayBySourceId('screen:2:0', [
                {
                    bounds: {
                        height: 1080,
                        width: 1920,
                        x: 0,
                        y: 0
                    },
                    id: 1,
                    nativeOrigin: {
                        x: 0,
                        y: 0
                    },
                    scaleFactor: 1
                },
                {
                    bounds: {
                        height: 960,
                        width: 1536,
                        x: 1280,
                        y: 0
                    },
                    id: 2,
                    nativeOrigin: {
                        x: 1920,
                        y: 0
                    },
                    scaleFactor: 1.25
                }
            ], [
                {
                    display_id: '2',
                    id: 'screen:2:0'
                }
            ]);

            assert.deepEqual(metrics, {
                bounds: {
                    height: 960,
                    width: 1536,
                    x: 1920,
                    y: 0
                },
                scaleFactor: 1.25
            });
        });

        it('returns undefined when the source cannot be matched', () => {
            const metrics = getWindowsDisplayBySourceId('screen:3:0', [], []);

            assert.equal(metrics, undefined);
        });
    });

    describe('getMacDisplayBySourceId', () => {
        it('matches plain screen ids', () => {
            const display = getMacDisplayBySourceId('screen:42', [
                { id: 1 },
                { id: 42 }
            ]);

            assert.deepEqual(display, { id: 42 });
        });

        it('matches desktop ids with capture suffix', () => {
            const display = getMacDisplayBySourceId('screen:99:0', [
                { id: 42 },
                { id: 99 }
            ]);

            assert.deepEqual(display, { id: 99 });
        });
    });
});
