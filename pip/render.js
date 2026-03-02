const { ipcRenderer } = require('electron');
const log = require('@jitsi/logger');

const { PIP_CHANNEL } = require('./constants');

let logger;

/**
 * Renderer process hook that sets up Electron-specific picture-in-picture functionality.
 * Listens for postMessage requests from the jitsi-meet iframe and forwards them to the main process
 * which can execute requestPictureInPicture with userGesture: true.
 */
class PictureInPictureRenderHook {
    /**
     * Creates a PictureInPictureRenderHook that listens for PiP requests from the jitsi-meet iframe.
     *
     * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
     */
    constructor(api) {
        this._api = api;
        this._handlePipRequested = this._handlePipRequested.bind(this);
        this._onApiDispose = this._onApiDispose.bind(this);

        // Listen for PiP requests.
        this._api.on('_pipRequested', this._handlePipRequested);

        // Clean up on API disposal.
        this._api.on('_willDispose', this._onApiDispose);
        logger.info('PiP render hook initialized!');
    }

    /**
     * Handles external API events from the jitsi-meet iframe.
     * Forwards picture-in-picture requests to the main process via IPC.
     *
     * @returns {void}
     */
    _handlePipRequested() {
        logger.info('Received _pipRequested event from External API');
        const iframe = this._api.getIFrame();
        const frameName = iframe ? iframe.name : undefined;

        logger.info('Forwarding PiP request to main process, frameName:', frameName);

        // Forward to main process via IPC.
        ipcRenderer.send(PIP_CHANNEL, frameName);
    }

    /**
     * Cleans up event listeners when the API is disposed.
     *
     * @returns {void}
     */
    _onApiDispose() {
        logger.info('API disposing, cleaning up PiP render hook listeners');
        this._api.removeListener('_pipRequested', this._handlePipRequested);
        this._api.removeListener('_willDispose', this._onApiDispose);
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
