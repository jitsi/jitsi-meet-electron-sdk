const {
    app,
    dialog,
    screen,
} = require('electron');
const process = require('process');

const { addInvokeRoute, addSendRoute, removeInvokeRoute, removeSendRoute } = require('../helpers/ipcRouter');
const {
    DISPLAY_METRICS_CHANGED,
    EVENTS,
    KEY_ACTIONS_FROM_EVENT_TYPE,
    MOUSE_ACTIONS_FROM_EVENT_TYPE,
    MOUSE_BUTTONS,
    RC_EVENT,
    RC_START,
    RC_STOP
} = require('./constants');

/**
 * Module to run on the main process. It owns the remote control session: it
 * asks the user for consent, resolves the shared display, tracks it across
 * display changes and executes the mouse/keyboard events (via robotjs)
 * forwarded by the renderer. Keeping robotjs and the OS input synthesis in the
 * trusted main process is what lets the Jitsi Meet window run with context
 * isolation enabled.
 */
class RemoteControlMain {
    /**
     * Constructs a new instance and wires up the IPC handlers.
     *
     * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which displays the meeting.
     * @param {Object} [options] - Optional configuration.
     * @param {function(Object): Promise<boolean>|boolean|false} [options.requestConsent] - Asks the
     * user whether a remote control session may start, receiving `{ sourceId }`. It must resolve to
     * true only when the user explicitly allowed it. Defaults to a native message box parented to
     * `jitsiMeetWindow`. Embedders should supply this to provide their own (e.g. localized) wording,
     * but whatever they supply MUST NOT be renderable or dismissable by web content. Pass `false` to
     * disable the gate entirely and start every session that is requested - see
     * {@link _resolveRequestConsent} for when that is (and is not) defensible.
     */
    constructor(jitsiMeetWindow, options = {}) {
        this._jitsiMeetWindow = jitsiMeetWindow;
        this._webContents = jitsiMeetWindow.webContents;
        this._requestConsent = this._resolveRequestConsent(options.requestConsent);

        // Whether a consent request is currently on screen. Guards against a
        // hostile - or merely repeating - renderer stacking up dialogs.
        this._consentPending = false;

        // robotjs is a native module. Load it lazily here (rather than at the
        // top of the file) so that importing `@jitsi/electron-sdk/main` does not
        // pull the native addon into apps that never use remote control.
        this._robot = require('@jitsi/robotjs');

        // The sourceId of the currently controlled desktop, kept so the display
        // can be re-resolved when the display configuration changes.
        this._sourceId = undefined;

        // The resolved display metrics (bounds + scaleFactor) for _sourceId.
        this._display = undefined;

        /**
         * The status ("up"/"down") of the mouse button.
         * FIXME: Assuming that one button at a time can be pressed. Haven't
         * noticed any issues but maybe we should store the status for every
         * mouse button that we are processing.
         */
        this._mouseButtonStatus = 'up';

        this.cleanup = this.cleanup.bind(this);
        this._handleDisplayMetricsChanged = this._handleDisplayMetricsChanged.bind(this);
        this._handleStart = this._handleStart.bind(this);
        this._handleStop = this._handleStop.bind(this);
        this._handleEvent = this._handleEvent.bind(this);

        // Route by sender so only the window this session belongs to can drive
        // it, and so several windows can each run remote control without the
        // process-wide ipcMain.handle(RC_START) colliding.
        addInvokeRoute(RC_START, { owner: this._webContents, handler: this._handleStart });
        addSendRoute(RC_STOP, { owner: this._webContents, handler: this._handleStop });
        addSendRoute(RC_EVENT, { owner: this._webContents, handler: this._handleEvent });

        app.whenReady().then(() => {
            screen.on(DISPLAY_METRICS_CHANGED, this._handleDisplayMetricsChanged);
        });

        // Clean up handlers to avoid leaks.
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Cleanup any handlers.
     */
    cleanup() {
        removeInvokeRoute(RC_START, this._webContents);
        removeSendRoute(RC_STOP, this._webContents);
        removeSendRoute(RC_EVENT, this._webContents);
        screen.removeListener(DISPLAY_METRICS_CHANGED, this._handleDisplayMetricsChanged);
    }

    /**
     * Returns the scale factor for the current display used to calculate the resolution of the display.
     *
     * NOTE: On Mac OS this._display.scaleFactor will always be 2 for some reason. But the values returned from
     * this._display.bounds will already take into account the scale factor. That's why we are returning 1 for Mac OS.
     *
     * @returns {number} The scale factor.
     */
    _getDisplayScaleFactor() {
        return process.platform === 'darwin' ? 1 : (this._display.scaleFactor || 1);
    }

    /**
     * Resolves the `requestConsent` option into the function `_handleStart`
     * calls.
     *
     * `false` opts out of the gate: every requested session starts without
     * asking. That is only defensible when the embedder can guarantee that a
     * start request cannot originate from untrusted web content - for instance a
     * kiosk or support appliance that loads a single deployment it controls, and
     * that has already obtained consent out of band. It is NOT defensible for a
     * general purpose client whose server URL the user (or an attacker) can
     * point anywhere: the request arrives as an iframe -> top frame postMessage,
     * so with the gate off any page loaded in the meeting iframe can drive the
     * mouse and keyboard with no interaction at all.
     *
     * @param {function(Object): Promise<boolean>|boolean|false|undefined} requestConsent - The
     * option as passed by the embedder.
     * @returns {function(Object): Promise<boolean>|boolean} The consent function.
     */
    _resolveRequestConsent(requestConsent) {
        if (requestConsent === false) {
            console.warn('[remotecontrol] The user consent gate is disabled: remote control sessions '
                + 'will start without asking.');

            return () => true;
        }

        return requestConsent || this._showConsentDialog.bind(this);
    }

    /**
     * Shows the default consent dialog: a native, modal message box parented to
     * the meeting window. Web content can neither render, click nor dismiss it,
     * which is the point - it holds even if both the Jitsi Meet iframe and the
     * renderer hosting it are fully compromised.
     *
     * @returns {Promise<boolean>} Whether the user allowed the session.
     */
    async _showConsentDialog() {
        const { response } = await dialog.showMessageBox(this._jitsiMeetWindow, {
            type: 'warning',
            buttons: [ 'Deny', 'Allow' ],
            defaultId: 0,
            cancelId: 0,
            message: 'Allow remote control of this computer?',
            detail: 'A meeting participant is requesting control of your mouse and keyboard.'
        });

        return response === 1;
    }

    /**
     * Handles the RC_START request: asks the user for consent, then resolves and
     * stores the display for the shared sourceId so subsequent events can be
     * mapped to screen coordinates.
     *
     * The consent gate lives here rather than in the renderer on purpose. The
     * start request reaches the renderer as an iframe -> top frame postMessage,
     * a channel that carries no trustworthy identity, so the only consent that
     * cannot be forged by the page is one collected by the main process.
     *
     * @param {IpcMainInvokeEvent} event - The electron event.
     * @param {string} sourceId - The source id of the desktop sharing stream.
     * @returns {Promise<Object>} `{ result: true }` on success, otherwise `{ error }`.
     */
    async _handleStart(event, sourceId) {
        if (this._consentPending) {
            return { error: 'Error: a remote control request is already pending' };
        }

        this._consentPending = true;

        let granted;

        try {
            granted = await this._requestConsent({ sourceId });
        } catch (error) {
            console.error('Error requesting remote control consent:', error && error.message);
            granted = false;
        } finally {
            this._consentPending = false;
        }

        if (!granted) {
            return { error: 'Error: remote control denied by the user' };
        }

        // The window may have gone away while the dialog was up, in which case
        // the session (and its IPC routes) no longer exist.
        if (this._jitsiMeetWindow.isDestroyed()) {
            return { error: 'Error: the meeting window is gone' };
        }

        this._mouseButtonStatus = 'up';
        this._sourceId = sourceId;
        this._display = this._getDisplay(sourceId);

        if (this._display) {
            return { result: true };
        }

        this._sourceId = undefined;

        return { error: 'Error: Can\'t detect the display that is currently shared' };
    }

    /**
     * Handles the RC_STOP request: ends the session and stops processing events.
     */
    _handleStop() {
        this._sourceId = undefined;
        this._display = undefined;
        this._mouseButtonStatus = 'up';
    }

    /**
     * Handles a forwarded remote control event and executes it via robotjs.
     * Events are ignored unless a session has been started (i.e. a display has
     * been resolved), enforcing the guard in the trusted process.
     *
     * @param {IpcMainEvent} event - The electron event.
     * @param {Object} data - The remote control event ({ type, x, y, button, key, modifiers }).
     */
    _handleEvent(event, data) {
        // Ignore events until a display has been associated with the session.
        if (!this._display || !data) {
            return;
        }

        const robot = this._robot;

        // NOTE: robotjs throws on input it doesn't recognize (an unknown key or
        // modifier, for instance). Now that it runs here rather than in the
        // renderer, an escaping exception is an uncaught exception in the main
        // process, which takes the whole app down. The preload sanitizes events
        // before they get here; this catch makes sure that a malformed - or
        // hostile - event that slips through only drops the event.
        try {
            switch (data.type) {
                case EVENTS.mousemove: {
                    const { width, height, x, y } = this._display.bounds;
                    const scaleFactor = this._getDisplayScaleFactor();
                    const destX = data.x * width * scaleFactor + x;
                    const destY = data.y * height * scaleFactor + y;

                    if (this._mouseButtonStatus === 'down') {
                        robot.dragMouse(destX, destY);
                    } else {
                        robot.moveMouse(destX, destY);
                    }
                    break;
                }
                case EVENTS.mousedown:
                case EVENTS.mouseup: {
                    this._mouseButtonStatus = MOUSE_ACTIONS_FROM_EVENT_TYPE[data.type];
                    robot.mouseToggle(
                        this._mouseButtonStatus,
                        (data.button ? MOUSE_BUTTONS[data.button] : undefined));
                    break;
                }
                case EVENTS.mousedblclick: {
                    robot.mouseClick(
                        (data.button ? MOUSE_BUTTONS[data.button] : undefined),
                        true);
                    break;
                }
                case EVENTS.mousescroll: {
                    const { x, y } = data;

                    if (x !== 0 || y !== 0) {
                        robot.scrollMouse(x, y);
                    }
                    break;
                }
                case EVENTS.keydown:
                case EVENTS.keyup: {
                    if (data.key) {
                        robot.keyToggle(
                            data.key === 'caps_lock' ? 'capslock' : data.key,
                            KEY_ACTIONS_FROM_EVENT_TYPE[data.type],
                            data.modifiers);
                    }
                    break;
                }
                default:
                    console.error('Unknown event type!');
            }
        } catch (error) {
            console.error('Error executing remote control event:', error && error.message);
        }
    }

    /**
     * Handles DISPLAY_METRICS_CHANGED event by re-resolving the shared display
     * for the active session. No message is pushed to the renderer: the main
     * process now owns the display metrics end to end.
     */
    _handleDisplayMetricsChanged() {
        if (this._sourceId) {
            this._display = this._getDisplay(this._sourceId);
        }
    }

    /**
     * Returns the display metrics(x, y, width, height, scaleFactor, etc...) of the display that will be used for the
     * remote control.
     *
     * @param {string} sourceId - The source id of the desktop sharing stream.
     * @returns {Object} bounds and scaleFactor of display matching sourceId.
     */
     _getDisplay(sourceId) {
        const displays = screen.getAllDisplays();

        switch(displays.length) {
            case 0:
                return undefined;
            case 1:
                // On Linux probably we'll end up here even if there are
                // multiple monitors.
                return displays[0];
            // eslint-disable-next-line no-case-declarations
            default: { // > 1 display
                // Remove the type part from the sourceId
                const parsedSourceId = sourceId.replace('screen:', '');

                // Currently native code sourceId2Coordinates is only necessary for windows.
                if (process.platform === 'win32') {
                    const sourceId2Coordinates = require("../node_addons/sourceId2Coordinates");
                    const coordinates = sourceId2Coordinates(parsedSourceId);
                    if(coordinates) {
                        const { x, y } = coordinates;
                        const display
                            = screen.getDisplayNearestPoint({
                                x: x + 1,
                                y: y + 1
                            });

                        if (typeof display !== 'undefined') {
                            // We need to use x and y returned from sourceId2Coordinates because the ones returned from
                            // Electron don't seem to respect the scale factors of the other displays.
                            const { width, height } = display.bounds;

                            return {
                                bounds: {
                                    x,
                                    y,
                                    width,
                                    height
                                },
                                scaleFactor: display.scaleFactor
                            };
                        } else {
                            return undefined;
                        }
                    }
                } else if (process.platform === 'darwin') {
                    // On Mac OS the sourceId = 'screen' + displayId.
                    // Try to match displayId with sourceId.
                    let displayId = Number(parsedSourceId);

                    if (isNaN(displayId)) {
                        // The source id may have the following format "desktop_id:0".

                        const idArr = parsedSourceId.split(":");

                        if (idArr.length <= 1) {
                            return;
                        }

                        displayId = Number(idArr[0]);
                    }
                    return displays.find(display => display.id === displayId);
                } else {
                    return undefined;
                }
            }
        }
    }
}

/**
 * Initializes the remote control functionality in the main electron process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - the BrowserWindow object which displays the meeting.
 * @param {Object} [options] - Optional configuration.
 * @param {function(Object): Promise<boolean>|boolean|false} [options.requestConsent] - Asks the
 * user whether a remote control session may start, receiving `{ sourceId }`. Defaults to a native
 * message box parented to `jitsiMeetWindow`. Pass `false` to disable the gate entirely, which is
 * only safe when a start request cannot come from untrusted web content.
 * @returns {RemoteControlMain} - the remote control object.
 */
module.exports = function setupRemoteControlMain(jitsiMeetWindow, options) {
    return new RemoteControlMain(jitsiMeetWindow, options);
};
