const assert = require('assert');
const { EventEmitter } = require('events');

const log = require('@jitsi/logger');

const setupPictureInPictureRender = require('../pip/renderer');

describe('PictureInPictureRenderHook', () => {
    let api;
    let bridgeCalls;

    // Keep the hook's informational logging out of the test output.
    before(() => log.setLogLevel(log.levels.ERROR));
    after(() => log.setLogLevel(log.levels.TRACE));

    beforeEach(() => {
        api = new EventEmitter();
        api.getIFrame = () => ({ name: 'jitsiConferenceFrame0' });
        bridgeCalls = [];

        // The hook reaches the preload bridge through the main world global.
        global.window = {
            jitsiElectronSDK: {
                pip: {
                    focusMainWindow: () => bridgeCalls.push('focusMainWindow'),
                    request: frameName => bridgeCalls.push(`request:${frameName}`),
                    resetWindowSize: () => bridgeCalls.push('resetWindowSize')
                }
            }
        };
    });

    afterEach(() => {
        delete global.window;
    });

    it('asks the main process to forget the PiP window size when the meeting is ready to close', () => {
        setupPictureInPictureRender(api);

        api.emit('readyToClose');

        assert.deepStrictEqual(bridgeCalls, [ 'resetWindowSize' ]);
    });

    it('forgets the PiP window size and stops listening when the API is disposed', () => {
        setupPictureInPictureRender(api);

        api.emit('_willDispose');

        assert.deepStrictEqual(bridgeCalls, [ 'resetWindowSize' ]);
        assert.strictEqual(api.eventNames().length, 0);

        api.emit('readyToClose');
        api.emit('pipDoubleClicked');

        assert.deepStrictEqual(bridgeCalls, [ 'resetWindowSize' ]);
    });

    it('survives the end of the meeting when the SDK bridge is not installed', () => {
        global.window = {};
        setupPictureInPictureRender(api);

        assert.doesNotThrow(() => {
            api.emit('readyToClose');
            api.emit('_willDispose');
        });
    });
});
