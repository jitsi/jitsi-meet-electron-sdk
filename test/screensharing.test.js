const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

const { SCREEN_SHARE_EVENTS, SCREEN_SHARE_EVENTS_CHANNEL } = require('../screensharing/constants');

/**
 * Minimal stand-in for the parts of the electron module used by screensharing/main.js.
 */
class FakeIpcMain extends EventEmitter {
    handle() {}
    removeHandler() {}
}

const fakeElectron = {
    BrowserWindow: class {},
    desktopCapturer: { getSources: () => Promise.resolve([]) },
    ipcMain: new FakeIpcMain(),
    screen: {},
    systemPreferences: {},
    webContents: { fromFrame: frame => frame.webContents }
};

/**
 * Loads a module with `require('electron')` resolved to the fake electron module.
 *
 * @param {string} path - The module path.
 * @returns {*} The module exports.
 */
function requireWithFakeElectron(path) {
    const originalLoad = Module._load;

    Module._load = function(request, ...args) {
        return request === 'electron' ? fakeElectron : originalLoad.call(this, request, ...args);
    };

    try {
        return require(path);
    } finally {
        Module._load = originalLoad;
    }
}

const setupScreenSharingMain = requireWithFakeElectron('../screensharing/main');

/**
 * Waits for pending promise callbacks to run.
 *
 * @returns {Promise<void>}
 */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Creates a fake BrowserWindow whose WebContents uses the given session.
 *
 * @param {Object} session - The (possibly shared) fake session.
 * @returns {Object} The fake window.
 */
function createWindow(session) {
    const wc = new EventEmitter();

    wc.session = session;
    wc.sent = [];
    wc.destroyed = false;
    wc.isDestroyed = () => wc.destroyed;
    wc.send = (channel, ev) => wc.sent.push({ channel, ev });
    wc.mainFrame = { webContents: wc };

    const win = new EventEmitter();

    win.webContents = wc;

    return win;
}

/**
 * Creates a fake session which records the display media request handler.
 *
 * @returns {Object} The fake session.
 */
function createSession() {
    return {
        setDisplayMediaRequestHandler(handler) {
            this.handler = handler;
        }
    };
}

/**
 * Makes a getDisplayMedia request from the main frame of the given window.
 *
 * @param {Object} win - The fake window making the request.
 * @returns {Object} Holder whose `result` is set once the callback is called.
 */
function requestGdm(win) {
    const holder = { called: false };

    win.webContents.session.handler({ frame: win.webContents.mainFrame, securityOrigin: 'https://meet.example' },
        result => {
            holder.called = true;
            holder.result = result;
        });

    return holder;
}

/**
 * Returns the requestId of the last OPEN_PICKER event sent to the window.
 *
 * @param {Object} win - The fake window.
 * @returns {number} The request ID.
 */
function lastPickerRequestId(win) {
    const { ev } = win.webContents.sent[win.webContents.sent.length - 1];

    assert.equal(ev.data.name, SCREEN_SHARE_EVENTS.OPEN_PICKER);

    return ev.data.requestId;
}

describe('screensharing main', () => {
    let hooks;
    let originalWarn;

    beforeEach(() => {
        hooks = [];
        originalWarn = console.warn;
        console.warn = () => {};
    });

    afterEach(() => {
        hooks.forEach(hook => hook.cleanup());
        console.warn = originalWarn;
    });

    const setup = win => {
        const hook = setupScreenSharingMain(win, 'Test');

        hooks.push(hook);

        return hook;
    };

    it('opens the picker in the requesting window and completes on DO_GDM', () => {
        const win = createWindow(createSession());

        setup(win);

        const gdm = requestGdm(win);
        const requestId = lastPickerRequestId(win);

        fakeElectron.ipcMain.emit(SCREEN_SHARE_EVENTS_CHANNEL, { sender: win.webContents }, {
            data: { name: SCREEN_SHARE_EVENTS.DO_GDM, requestId, source: { id: 'screen:1' } }
        });

        assert.deepEqual(gdm, { called: true, result: { video: { id: 'screen:1' } } });
    });

    it('rejects requests from a window without a hook in the same session', () => {
        const session = createSession();
        const staleWindow = createWindow(session);
        const meetingWindow = createWindow(session);

        setup(staleWindow);

        const gdm = requestGdm(meetingWindow);

        assert.deepEqual(gdm, { called: true, result: null });
        assert.equal(staleWindow.webContents.sent.length, 0);
        assert.equal(meetingWindow.webContents.sent.length, 0);
    });

    it('routes requests to the hook of the requesting window when several share a session', () => {
        const session = createSession();
        const winA = createWindow(session);
        const winB = createWindow(session);

        setup(winA);
        setup(winB);

        requestGdm(winA);

        assert.equal(winA.webContents.sent.length, 1);
        assert.equal(winB.webContents.sent.length, 0);
    });

    it('rejects requests whose frame is gone', () => {
        const win = createWindow(createSession());

        setup(win);

        const gdm = { called: false };

        win.webContents.session.handler({ frame: null }, result => {
            gdm.called = true;
            gdm.result = result;
        });

        assert.deepEqual(gdm, { called: true, result: null });
    });

    for (const eventName of [ 'did-navigate', 'render-process-gone', 'destroyed' ]) {
        it(`rejects pending requests on ${eventName}`, () => {
            const win = createWindow(createSession());

            setup(win);

            const gdm = requestGdm(win);

            assert.equal(gdm.called, false);

            win.webContents.emit(eventName, {}, {});

            assert.deepEqual(gdm, { called: true, result: null });
        });
    }

    it('rejects requests after the window is destroyed', () => {
        const win = createWindow(createSession());

        setup(win);
        win.webContents.destroyed = true;
        win.emit('closed');

        assert.deepEqual(requestGdm(win), { called: true, result: null });
    });

    it('rejects the pending requests of a replaced hook', () => {
        const win = createWindow(createSession());

        setup(win);

        const first = requestGdm(win);

        setup(win);

        assert.deepEqual(first, { called: true, result: null });

        // The new hook still works.
        const second = requestGdm(win);
        const requestId = lastPickerRequestId(win);

        fakeElectron.ipcMain.emit(SCREEN_SHARE_EVENTS_CHANNEL, { sender: win.webContents }, {
            data: { name: SCREEN_SHARE_EVENTS.DO_GDM, requestId, source: null }
        });

        assert.deepEqual(second, { called: true, result: null });
    });

    it('does not remove the routes of a new hook when an old hook is cleaned up again', () => {
        const win = createWindow(createSession());
        const oldHook = setup(win);

        setup(win);
        oldHook.cleanup();

        const gdm = requestGdm(win);
        const requestId = lastPickerRequestId(win);

        fakeElectron.ipcMain.emit(SCREEN_SHARE_EVENTS_CHANNEL, { sender: win.webContents }, {
            data: { name: SCREEN_SHARE_EVENTS.DO_GDM, requestId, source: { id: 'window:1' } }
        });

        assert.deepEqual(gdm, { called: true, result: { video: { id: 'window:1' } } });
    });
});

describe('screensharing renderer', () => {
    let setupScreenSharingRender;
    let sentEvents;
    let onEvent;
    let api;
    let resolvePicker;

    before(() => {
        setupScreenSharingRender = require('../screensharing/renderer');
    });

    beforeEach(() => {
        sentEvents = [];
        global.window = {
            jitsiElectronSDK: {
                screenSharing: {
                    getDesktopSources: () => Promise.resolve([]),
                    onEvent: cb => {
                        onEvent = cb;

                        return () => {
                            onEvent = undefined;
                        };
                    },
                    sendEvent: data => sentEvents.push(data)
                }
            }
        };

        api = new EventEmitter();
        api.executeCommand = () => {};
        api._openDesktopPicker = () => new Promise(resolve => {
            resolvePicker = resolve;
        });
    });

    afterEach(() => {
        delete global.window;
    });

    const doGdmEvents = () => sentEvents.filter(e => e.name === SCREEN_SHARE_EVENTS.DO_GDM);

    it('releases an in-flight picker request when the api is disposed', async () => {
        setupScreenSharingRender(api);

        onEvent({ data: { name: SCREEN_SHARE_EVENTS.OPEN_PICKER, requestId: 7 } });
        await Promise.resolve();

        api.emit('_willDispose');

        assert.deepEqual(doGdmEvents(), [ { name: SCREEN_SHARE_EVENTS.DO_GDM, requestId: 7, source: null } ]);

        // A late picker result is not sent a second time.
        resolvePicker({ source: { id: 'screen:1' } });
        await flush();

        assert.equal(doGdmEvents().length, 1);
    });

    it('sends the picker result once', async () => {
        setupScreenSharingRender(api);

        onEvent({ data: { name: SCREEN_SHARE_EVENTS.OPEN_PICKER, requestId: 8 } });
        await Promise.resolve();
        resolvePicker({ source: { id: 'screen:1' } });
        await flush();

        api.emit('_willDispose');

        assert.deepEqual(doGdmEvents(), [
            { name: SCREEN_SHARE_EVENTS.DO_GDM, requestId: 8, source: { id: 'screen:1' } }
        ]);
    });

    it('releases the request when the picker throws synchronously', async () => {
        api._openDesktopPicker = () => {
            throw new Error('boom');
        };

        setupScreenSharingRender(api);

        onEvent({ data: { name: SCREEN_SHARE_EVENTS.OPEN_PICKER, requestId: 9 } });
        await flush();

        assert.deepEqual(doGdmEvents(), [ { name: SCREEN_SHARE_EVENTS.DO_GDM, requestId: 9, source: null } ]);
    });
});
