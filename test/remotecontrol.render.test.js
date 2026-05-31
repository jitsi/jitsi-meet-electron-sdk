const assert = require('assert');
const Module = require('module');

const REMOTE_CONTROL_MODULE_PATH = '../remotecontrol/render';

function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
}

function loadModuleWithMocks(modulePath, mocks) {
    const resolvedPath = require.resolve(modulePath);
    const originalLoad = Module._load;

    delete require.cache[resolvedPath];

    Module._load = function(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        return require(modulePath);
    } finally {
        Module._load = originalLoad;
    }
}

function createRemoteControlHarness({ invokeResult } = {}) {
    let messageListener;
    const sentMessages = [];
    const invocations = [];
    const robotCalls = [];
    const apiListeners = {};
    const channel = {
        destroy() {},
        listen(method, listener) {
            if (method === 'message') {
                messageListener = listener;
            }
        },
        ready(callback) {
            callback();
        },
        send(message) {
            sentMessages.push(message);
        }
    };
    const iframe = {
        addEventListener(eventName, listener) {
            if (eventName === 'load') {
                this._loadListener = listener;
            }
        },
        contentWindow: {}
    };
    const api = {
        getIFrame() {
            return iframe;
        },
        on(eventName, listener) {
            apiListeners[eventName] = listener;
        }
    };
    const ipcRenderer = {
        invoke(channelName, request) {
            invocations.push({ channelName, request });

            return Promise.resolve(invokeResult || { action: 'grant' });
        },
        on() {},
        removeListener() {},
        sendSync() {
            return {
                bounds: {
                    height: 200,
                    width: 100,
                    x: 10,
                    y: 20
                },
                scaleFactor: 1
            };
        }
    };
    const setupRemoteControlRender = loadModuleWithMocks(REMOTE_CONTROL_MODULE_PATH, {
        '@jitsi/robotjs': {
            dragMouse(x, y) {
                robotCalls.push([ 'dragMouse', x, y ]);
            },
            keyToggle(key, state, modifiers) {
                robotCalls.push([ 'keyToggle', key, state, modifiers ]);
            },
            mouseClick(button, doubleClick) {
                robotCalls.push([ 'mouseClick', button, doubleClick ]);
            },
            mouseToggle(state, button) {
                robotCalls.push([ 'mouseToggle', state, button ]);
            },
            moveMouse(x, y) {
                robotCalls.push([ 'moveMouse', x, y ]);
            },
            scrollMouse(x, y) {
                robotCalls.push([ 'scrollMouse', x, y ]);
            }
        },
        electron: {
            ipcRenderer
        },
        os: {
            type() {
                return 'Linux';
            }
        },
        postis() {
            return channel;
        }
    });
    const remoteControl = setupRemoteControlRender(api);

    iframe._loadListener();

    return {
        apiListeners,
        invocations,
        messageListener,
        remoteControl,
        robotCalls,
        sentMessages
    };
}

describe('remotecontrol/render', () => {
    it('announces support and requires approval before starting', () => {
        const harness = createRemoteControlHarness();

        assert.equal(harness.sentMessages[0].params.data.type, 'supported');

        harness.messageListener({
            data: {
                controllerId: 'controller-1',
                name: 'remote-control',
                sourceId: 'screen:1',
                type: 'start'
            },
            id: 7
        });

        assert.equal(harness.sentMessages[1].params.error, 'Error: Remote control has not been approved for this participant');
        assert.equal(harness.robotCalls.length, 0);
    });

    it('prompts for approval and only accepts input from the approved controller', async () => {
        const harness = createRemoteControlHarness({
            invokeResult: { action: 'grant' }
        });

        harness.messageListener({
            data: {
                action: 'request',
                controllerId: 'controller-1',
                displayName: 'Alice',
                name: 'remote-control',
                screenSharing: false,
                type: 'permissions'
            },
            id: 1
        });

        await flushPromises();

        assert.deepEqual(harness.invocations[0], {
            channelName: 'jitsi-remotecontrol-prompt',
            request: {
                controllerId: 'controller-1',
                displayName: 'Alice',
                participantId: undefined,
                screenSharing: false,
                userId: undefined
            }
        });
        assert.equal(harness.sentMessages[1].params.data.action, 'grant');

        harness.messageListener({
            data: {
                controllerId: 'controller-1',
                name: 'remote-control',
                sourceId: 'screen:1',
                type: 'start'
            },
            id: 2
        });
        harness.messageListener({
            data: {
                controllerId: 'controller-1',
                name: 'remote-control',
                type: 'mousemove',
                x: 0.5,
                y: 0.25
            }
        });
        harness.messageListener({
            data: {
                controllerId: 'controller-2',
                name: 'remote-control',
                type: 'mousemove',
                x: 0.2,
                y: 0.5
            }
        });
        harness.messageListener({
            data: {
                controllerId: 'controller-1',
                name: 'remote-control',
                type: 'stop'
            }
        });
        harness.messageListener({
            data: {
                controllerId: 'controller-1',
                name: 'remote-control',
                type: 'mousemove',
                x: 0.5,
                y: 0.25
            }
        });

        assert.equal(harness.sentMessages[2].params.result, true);
        assert.deepEqual(harness.robotCalls, [
            [ 'moveMouse', 60, 70 ]
        ]);
    });

    it('denies malformed authorization requests', async () => {
        const harness = createRemoteControlHarness();

        harness.messageListener({
            data: {
                action: 'request',
                name: 'remote-control',
                type: 'permissions'
            },
            id: 9
        });

        await flushPromises();

        assert.equal(harness.invocations.length, 0);
        assert.equal(harness.sentMessages[1].params.data.action, 'error');
    });
});
