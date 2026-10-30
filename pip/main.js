const { addSendRoute, removeSendRoute } = require('../helpers/ipcRouter');
const { PIP_CHANNEL } = require('./constants');
const log = require('@jitsi/logger');

let logger;


/**
 * Main process hook that handles picture-in-picture requests from the renderer.
 *
 * Entering video picture-in-picture requires transient user activation, which the
 * meeting frame does not have when Jitsi Meet requests PiP automatically because the
 * window lost focus. The hook therefore executes requestPictureInPicture in the meeting
 * frame with userGesture: true. That flag grants the whole frame a few seconds of
 * activation, usable by any script the Jitsi Meet deployment serves, so the grant is
 * limited to the only legitimate case: the window is unfocused and no gesture has been
 * granted since it lost focus. Requests that arrive while the window is focused are
 * dropped.
 */
class PictureInPictureMainHook {
    /**
     * Creates a PictureInPictureMainHook linked to the jitsi meet window.
     *
     * @param {BrowserWindow} jitsiMeetWindow - BrowserWindow where jitsi-meet is loaded.
     */
    constructor(jitsiMeetWindow) {
        this._jitsiMeetWindow = jitsiMeetWindow;
        this._webContents = jitsiMeetWindow.webContents;

        // Whether a user gesture has been granted since the window last lost focus. It is
        // re-armed on focus rather than on blur so that a request made while the window
        // was unfocused from the start (e.g. the meeting was joined in the background) is
        // honored, and so that the gating does not depend on the blur event arriving
        // before the IPC message.
        this._userGestureGranted = false;
        this._handlePipRequest = this._handlePipRequest.bind(this);
        this._onWindowFocus = this._onWindowFocus.bind(this);
        this.cleanup = this.cleanup.bind(this);

        // Listen for PiP requests from this window's renderer only.
        addSendRoute(PIP_CHANNEL, { owner: this._webContents, handler: this._handlePipRequest });
        this._jitsiMeetWindow.on('focus', this._onWindowFocus);
        logger.info('PiP main process hook initialized');

        // Automatically cleanup when the window is closed.
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Re-arms the user gesture grant once the window is focused again, so that the next
     * loss of focus can enter picture-in-picture.
     *
     * @returns {void}
     */
    _onWindowFocus() {
        this._userGestureGranted = false;
    }

    /**
     * Handles picture-in-picture requests from the renderer.
     * Finds the jitsi-meet iframe and executes requestPictureInPicture with userGesture: true,
     * unless the window is focused or a gesture was already granted since it lost focus.
     *
     * @param {IpcMainEvent} event - The IPC event object.
     * @param {number} frameName - The name of the frame where the PiP request originated.
     * @returns {void}
     */
    _handlePipRequest(event, frameName) {
        logger.info(`Received PiP request from renderer, frameName: ${frameName}`);

        if (!this._jitsiMeetWindow || !frameName) {
            logger.error('[PiP Main] Cannot handle PiP request: window not available');

            return;
        }

        // In Electron, Jitsi Meet only requests PiP when the window loses focus (the PiP
        // toolbar button is not shown there). A request while the window is focused can only
        // come from page script and must not be granted a user gesture.
        if (this._jitsiMeetWindow.isFocused()) {
            logger.warn('[PiP Main] Ignoring PiP request: the window is focused');

            return;
        }

        if (this._userGestureGranted) {
            logger.warn('[PiP Main] Ignoring PiP request: a user gesture was already granted since the window lost focus');

            return;
        }

        // Find the jitsi-meet iframe (non-file:// URL).
        const frames = this._jitsiMeetWindow.webContents.mainFrame.frames;
        const jitsiFrame = frames.find(frame => frame.name === frameName);

        if (!jitsiFrame) {
            logger.error(`[PiP Main]: Cannot find jitsi-meet iframe with name ${frameName}`);

            return;
        }

        this._userGestureGranted = true;

        // Execute requestPictureInPicture with userGesture: true.
        const pipScript = `
            if (window.JitsiMeetJS && window.JitsiMeetJS.app && window.JitsiMeetJS.app.electron
                && typeof window.JitsiMeetJS.app.electron.requestPictureInPicture === 'function') {
                window.JitsiMeetJS.app.electron.requestPictureInPicture();
            }`;

        logger.info('Executing requestPictureInPicture script in iframe with userGesture: true');
        jitsiFrame.executeJavaScript(pipScript, true)
            .then(() => {
                logger.info('PiP script executed successfully in iframe');
            })
            .catch(error => {
                logger.error('[PiP Main] Failed to execute PiP script:', error);
            });
    }

    /**
     * Cleans up event listeners. Called automatically when the window is closed,
     * but can also be called manually if needed.
     *
     * @returns {void}
     */
    cleanup() {
        logger.info('Cleaning up PiP main process hook');
        removeSendRoute(PIP_CHANNEL, this._webContents);

        // Remove the window listeners if the window still exists.
        if (this._jitsiMeetWindow && !this._jitsiMeetWindow.isDestroyed()) {
            this._jitsiMeetWindow.removeListener('focus', this._onWindowFocus);
            this._jitsiMeetWindow.removeListener('closed', this.cleanup);
        }

        // Prevent double cleanup.
        this._jitsiMeetWindow = null;
    }
}

/**
 * Initializes the picture-in-picture electron specific functionality in the main process.
 *
 * @param {BrowserWindow} jitsiMeetWindow - BrowserWindow where jitsi-meet is loaded.
 * @param {Array} loggerTransports - Optional array of logger transports for configuring the logger.
 * @returns {PictureInPictureMainHook} The PiP main hook instance.
 */
module.exports = function setupPictureInPictureMain(jitsiMeetWindow, loggerTransports) {
    logger = log.getLogger('PIP', loggerTransports || []);

    return new PictureInPictureMainHook(jitsiMeetWindow);
};
