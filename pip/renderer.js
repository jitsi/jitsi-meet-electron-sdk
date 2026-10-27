const log = require('@jitsi/logger');

let logger;

/**
 * Renderer process hook that sets up Electron-specific picture-in-picture functionality.
 *
 * Listens for the External API events of the jitsi-meet iframe and forwards to the main process
 * (through the `window.jitsiElectronSDK.pip` bridge):
 * - video-element PiP requests, which the main process executes with userGesture: true;
 * - the request to focus the window hosting the meeting when the user double clicks the custom
 *   PiP window (the legacy always-on-top double-click behavior);
 * - the end of the meeting, after which the custom PiP window opens at its default size again.
 *
 * Embedding apps that need to react to the custom PiP window's gestures listen to the External API
 * directly: `pipDoubleClicked` for the double click and `pipLeft` (with `reason: 'dismissed'`) for
 * the X button.
 */
class PictureInPictureRenderHook {
    /**
     * Creates a PictureInPictureRenderHook that listens for PiP requests from the jitsi-meet iframe.
     *
     * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
     */
    constructor(api) {
        this._api = api;
        this._bridge = window.jitsiElectronSDK?.pip;
        this._handlePipRequested = this._handlePipRequested.bind(this);
        this._handlePipDoubleClicked = this._handlePipDoubleClicked.bind(this);
        this._handleReadyToClose = this._handleReadyToClose.bind(this);
        this._onApiDispose = this._onApiDispose.bind(this);

        // Listen for PiP requests.
        this._api.on('_pipRequested', this._handlePipRequested);
        this._api.on('pipDoubleClicked', this._handlePipDoubleClicked);
        this._api.on('readyToClose', this._handleReadyToClose);

        // Clean up on API disposal.
        this._api.on('_willDispose', this._onApiDispose);
        logger.info('PiP render hook initialized!');
    }

    /**
     * Handles external API events from the jitsi-meet iframe.
     * Forwards picture-in-picture requests to the main process via the bridge.
     *
     * @returns {void}
     */
    _handlePipRequested() {
        logger.info('Received _pipRequested event from External API');
        const iframe = this._api.getIFrame();
        const frameName = iframe ? iframe.name : undefined;

        logger.info('Forwarding PiP request to main process, frameName:', frameName);

        // Forward to main process via the bridge.
        this._bridge.request(frameName);
    }

    /**
     * Handles the user double clicking the custom PiP window (the legacy always-on-top gesture,
     * meaning "return to the meeting") by focusing the window hosting the meeting through the main
     * process.
     *
     * @returns {void}
     */
    _handlePipDoubleClicked() {
        logger.info('PiP window double clicked');

        // Forward to main process via the bridge.
        this._bridge.focusMainWindow();
    }

    /**
     * Handles the end of the meeting: the size the user resized the custom PiP window to is meant
     * for that meeting only (the legacy always-on-top behavior), so the main process is asked to
     * forget it.
     *
     * @returns {void}
     */
    _handleReadyToClose() {
        logger.info('Meeting over, resetting the PiP window size');

        // Forward to main process via the bridge.
        this._bridge?.resetWindowSize();
    }

    /**
     * Cleans up event listeners when the API is disposed. Disposal ends the meeting too (an
     * embedding app may dispose the API without waiting for readyToClose), so the PiP window size
     * is reset here as well.
     *
     * @returns {void}
     */
    _onApiDispose() {
        logger.info('API disposing, cleaning up PiP render hook listeners');
        this._api.removeListener('_pipRequested', this._handlePipRequested);
        this._api.removeListener('pipDoubleClicked', this._handlePipDoubleClicked);
        this._api.removeListener('readyToClose', this._handleReadyToClose);
        this._api.removeListener('_willDispose', this._onApiDispose);
        this._handleReadyToClose();
    }
}

/**
 * Initializes the picture-in-picture electron specific functionality in the renderer process.
 *
 * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
 * @param {Array} loggerTransports - Optional array of logger transports for configuring the logger.
 * @returns {PictureInPictureRenderHook} The PiP render hook instance.
 */
module.exports = function setupPictureInPictureRender(api, loggerTransports) {
    logger = log.getLogger('PIP', loggerTransports || []);

    return new PictureInPictureRenderHook(api);
};
