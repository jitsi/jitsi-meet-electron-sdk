const { ipcMain } = require('electron');
const { PIP_CHANNEL } = require('./constants');
const log = require('@jitsi/logger');

let logger;


/**
 * Main process hook that handles picture-in-picture requests from the renderer.
 * Executes requestPictureInPicture with userGesture: true to bypass transient activation requirements.
 */
class PictureInPictureMainHook {
    /**
     * Creates a PictureInPictureMainHook linked to the jitsi meet window.
     *
     * @param {BrowserWindow} jitsiMeetWindow - BrowserWindow where jitsi-meet is loaded.
     */
    constructor(jitsiMeetWindow) {
        this._jitsiMeetWindow = jitsiMeetWindow;
        this._handlePipRequest = this._handlePipRequest.bind(this);
        this.cleanup = this.cleanup.bind(this);

        // Listen for PiP requests from the renderer process.
        ipcMain.on(PIP_CHANNEL, this._handlePipRequest);

        // Automatically cleanup when the window is closed.
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Handles picture-in-picture requests from the renderer.
     * Finds the jitsi-meet iframe and executes requestPictureInPicture with userGesture: true.
     *
     * @param {IpcMainEvent} event - The IPC event object.
     * @param {number} frameName - The name of the frame where the PiP request originated.
     * @returns {void}
     */
    _handlePipRequest(event, frameName) {
        if (!this._jitsiMeetWindow || !frameName) {
            logger.error('[PiP Main] Cannot handle PiP request: window not available');

            return;
        }

        // Find the jitsi-meet iframe (non-file:// URL).
        const frames = this._jitsiMeetWindow.webContents.mainFrame.frames;
        const jitsiFrame = frames.find(frame => frame.name === frameName);

        if (!jitsiFrame) {
            logger.error(`[PiP Main]: Cannot find jitsi-meet iframe with name ${frameName}`);

            return;
        }

        // Execute requestPictureInPicture with userGesture: true.
        const pipScript = `
            if (window.JitsiMeetJS && window.JitsiMeetJS.app && window.JitsiMeetJS.app.electron
                && typeof window.JitsiMeetJS.app.electron.requestPictureInPicture === 'function') {
                window.JitsiMeetJS.app.electron.requestPictureInPicture();
            }`;

        jitsiFrame.executeJavaScript(pipScript, true)
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
        ipcMain.removeListener(PIP_CHANNEL, this._handlePipRequest);

        // Remove the window close listener if the window still exists.
        if (this._jitsiMeetWindow && !this._jitsiMeetWindow.isDestroyed()) {
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
