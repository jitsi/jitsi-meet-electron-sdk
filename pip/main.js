const { addSendRoute, removeSendRoute } = require('../helpers/ipcRouter');
const popupsConfigRegistry = require('../popupsconfig/PopupsConfigRegistry');
const {
    PIP_CHANNEL,
    PIP_FOCUS_MAIN_CHANNEL,
    PIP_WINDOW_NAME,
    PIP_WINDOW_POPUP_CONFIG_NAME
} = require('./constants');
const { getPiPWindowOptions, saveBounds, setAspectRatioToResizeableWindow } = require('./windowUtils');
const log = require('@jitsi/logger');

let logger;


/**
 * Main process hook that handles picture-in-picture requests from the renderer.
 *
 * Supports two PiP flavors:
 * - Video-element PiP: executes requestPictureInPicture with userGesture: true
 *   to bypass transient activation requirements.
 * - Custom PiP window: jitsi-meet opens a same-origin popup (named
 *   PIP_WINDOW_NAME) from inside the meeting iframe; this hook turns it into a
 *   small frameless always-on-top window (the legacy always-on-top look) and
 *   focuses the meeting window when the renderer hook asks for it (double
 *   click in the PiP window). The popup itself needs no Electron access: it is
 *   rendered and moved by the meeting page through web platform APIs only.
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
        this._pipWindow = null;
        this._handlePipRequest = this._handlePipRequest.bind(this);
        this._handleWindowCreated = this._handleWindowCreated.bind(this);
        this._handleFocusMainRequest = this._handleFocusMainRequest.bind(this);
        this.cleanup = this.cleanup.bind(this);

        // Listen for PiP requests from this window's renderer only.
        addSendRoute(PIP_CHANNEL, { owner: this._webContents, handler: this._handlePipRequest });
        addSendRoute(PIP_FOCUS_MAIN_CHANNEL, { owner: this._webContents, handler: this._handleFocusMainRequest });

        // Turn the popup jitsi-meet opens from inside the iframe into the
        // frameless always-on-top PiP window. The registered options are
        // consumed by the window open handler installed by
        // initPopupsConfigurationMain, like the OAuth popup configurations.
        popupsConfigRegistry.registerPopupConfig(PIP_WINDOW_POPUP_CONFIG_NAME, {
            matchPatterns: {
                frameName: `^${PIP_WINDOW_NAME}$`
            },
            target: 'electron',

            /**
             * Provides the BrowserWindow options for the PiP window. The popup
             * is always opened as about:blank and rendered by the meeting
             * iframe; any other URL does not get the frameless treatment.
             *
             * @param {Object} details - The window open handler details.
             * @returns {Object|undefined} The window options or undefined.
             */
            overrideBrowserWindowOptions: details =>
                (details?.url === 'about:blank' ? getPiPWindowOptions() : undefined)
        });

        this._webContents.on('did-create-window', this._handleWindowCreated);
        logger.info('PiP main process hook initialized');

        // Automatically cleanup when the window is closed.
        this._jitsiMeetWindow.on('closed', this.cleanup);
    }

    /**
     * Configures a freshly created PiP window: always-on-top level that renders
     * over full screen apps, aspect-ratio-preserving resizing and persistence
     * of its bounds. Mirrors the legacy always-on-top window setup.
     *
     * @param {BrowserWindow} pipWindow - The newly created PiP window.
     * @param {Object} details - The did-create-window details.
     * @returns {void}
     */
    _handleWindowCreated(pipWindow, details) {
        if (details?.frameName !== PIP_WINDOW_NAME) {
            return;
        }

        logger.info('Setting up PiP window');
        this._pipWindow = pipWindow;

        // Required to allow the window to be rendered on top of full screen apps.
        pipWindow.setAlwaysOnTop(true, 'screen-saver');

        setAspectRatioToResizeableWindow(pipWindow);

        // showInactive keeps the focus where it is: the PiP window appears
        // because the user focused something else, so it must not steal focus.
        pipWindow.once('ready-to-show', () => {
            if (!pipWindow.isDestroyed()) {
                pipWindow.showInactive();
            }
        });

        pipWindow.webContents.on('render-process-gone', (event, renderDetails) => {
            logger.error('Closing PiP window because its renderer is gone:', renderDetails?.reason);
            if (!pipWindow.isDestroyed()) {
                pipWindow.close();
            }
        });

        // Remember the bounds as they change rather than reading them when the
        // window closes: jitsi-meet closes it from the page with window.close(),
        // for which Electron destroys the web contents first and emits only
        // 'closed', when the bounds can no longer be read ('close' is not
        // emitted at all). 'move' also covers the moves jitsi-meet performs with
        // window.moveTo() while the user drags the frameless window.
        let bounds = pipWindow.getBounds();
        const rememberBounds = () => {
            bounds = pipWindow.getBounds();
        };

        pipWindow.on('move', rememberBounds);
        pipWindow.on('resize', rememberBounds);
        pipWindow.on('closed', () => {
            saveBounds(bounds);

            if (this._pipWindow === pipWindow) {
                this._pipWindow = null;
            }
        });
    }

    /**
     * Focuses the window hosting the meeting; requested by the renderer hook
     * when the user double clicks the PiP window (the legacy always-on-top
     * double-click behavior).
     *
     * @returns {void}
     */
    _handleFocusMainRequest() {
        logger.info('Focusing the jitsi-meet window on PiP request');

        if (!this._jitsiMeetWindow || this._jitsiMeetWindow.isDestroyed()) {
            return;
        }

        if (this._jitsiMeetWindow.isMinimized()) {
            this._jitsiMeetWindow.restore();
        }
        this._jitsiMeetWindow.show();
        this._jitsiMeetWindow.focus();
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
        logger.info(`Received PiP request from renderer, frameName: ${frameName}`);

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
        removeSendRoute(PIP_FOCUS_MAIN_CHANNEL, this._webContents);

        if (this._pipWindow && !this._pipWindow.isDestroyed()) {
            this._pipWindow.close();
        }
        this._pipWindow = null;

        // Remove the window close listener if the window still exists.
        if (this._jitsiMeetWindow && !this._jitsiMeetWindow.isDestroyed()) {
            this._webContents.removeListener('did-create-window', this._handleWindowCreated);
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
