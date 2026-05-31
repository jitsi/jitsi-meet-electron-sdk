const assert = require('assert');
const Module = require('module');

const REMOTE_CONTROL_MAIN_PATH = '../remotecontrol/main';

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

function createMainHarness(options) {
    const onHandlers = new Map();
    const invokeHandlers = new Map();
    const removedHandlers = [];
    const dialogCalls = [];
    const screenListeners = [];
    const windowListeners = {};
    const jitsiMeetWindow = {
        isDestroyed() {
            return false;
        },
        on(eventName, listener) {
            windowListeners[eventName] = listener;
        },
        removeListener(eventName, listener) {
            if (windowListeners[eventName] === listener) {
                delete windowListeners[eventName];
            }
        },
        webContents: {
            send() {}
        }
    };
    const electronMock = {
        app: {
            whenReady() {
                return Promise.resolve();
            }
        },
        dialog: {
            showMessageBox(window, config) {
                dialogCalls.push({ config, window });

                return Promise.resolve({ response: 0 });
            }
        },
        ipcMain: {
            handle(channel, handler) {
                invokeHandlers.set(channel, handler);
            },
            on(channel, handler) {
                onHandlers.set(channel, handler);
            },
            removeHandler(channel) {
                removedHandlers.push(channel);
                invokeHandlers.delete(channel);
            },
            removeListener(channel, handler) {
                if (onHandlers.get(channel) === handler) {
                    onHandlers.delete(channel);
                }
            }
        },
        screen: {
            getAllDisplays() {
                return [];
            },
            on(eventName, listener) {
                screenListeners.push({ eventName, listener });
            },
            removeListener() {}
        }
    };
    const setupRemoteControlMain = loadModuleWithMocks(REMOTE_CONTROL_MAIN_PATH, {
        electron: electronMock,
        process: {
            platform: 'linux'
        }
    });

    return {
        dialogCalls,
        jitsiMeetWindow,
        onHandlers,
        removedHandlers,
        screenListeners,
        setupRemoteControlMain,
        windowListeners,
        invokeHandler: channel => invokeHandlers.get(channel),
        options
    };
}

describe('remotecontrol/main', () => {
    it('shows the default host prompt for remote control requests', async () => {
        const harness = createMainHarness();

        harness.setupRemoteControlMain(harness.jitsiMeetWindow);

        const result = await harness.invokeHandler('jitsi-remotecontrol-prompt')(
            { sender: harness.jitsiMeetWindow.webContents },
            { displayName: 'Alice', screenSharing: false }
        );

        assert.equal(result.action, 'grant');
        assert.equal(harness.dialogCalls.length, 1);
        assert.equal(harness.dialogCalls[0].window, harness.jitsiMeetWindow);
        assert.match(harness.dialogCalls[0].config.detail, /Alice wants to control your shared screen/);
        assert.match(harness.dialogCalls[0].config.detail, /Approving will start sharing your entire screen if needed/);
    });

    it('supports a custom approval callback', async () => {
        const harness = createMainHarness();
        let receivedRequest;

        harness.setupRemoteControlMain(harness.jitsiMeetWindow, {
            async onRemoteControlRequest(request) {
                receivedRequest = request;

                return { approved: true };
            }
        });

        const result = await harness.invokeHandler('jitsi-remotecontrol-prompt')(
            { sender: harness.jitsiMeetWindow.webContents },
            { displayName: 'Bob', screenSharing: true }
        );

        assert.equal(result.action, 'grant');
        assert.equal(receivedRequest.displayName, 'Bob');
        assert.equal(receivedRequest.window, harness.jitsiMeetWindow);
        assert.equal(harness.dialogCalls.length, 0);
    });

    it('denies prompt requests from other renderers', async () => {
        const harness = createMainHarness();

        harness.setupRemoteControlMain(harness.jitsiMeetWindow);

        const result = await harness.invokeHandler('jitsi-remotecontrol-prompt')(
            { sender: {} },
            { displayName: 'Mallory', screenSharing: true }
        );

        assert.equal(result.action, 'deny');
        assert.match(result.error, /Unauthorized/);
    });
});
