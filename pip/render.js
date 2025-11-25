const { ipcRenderer } = require('electron');

const { PIP_CHANNEL } = require('./constants');

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
    }

    /**
     * Handles external API events from the jitsi-meet iframe.
     * Forwards picture-in-picture requests to the main process via IPC.
     *
     * @returns {void}
     */
    _handlePipRequested() {
        const iframe = this._api.getIFrame();
        const frameName = iframe ? iframe.name : undefined;

        // Forward to main process via IPC.
        ipcRenderer.send(PIP_CHANNEL, frameName);
    }

    /**
     * Cleans up event listeners when the API is disposed.
     *
     * @returns {void}
     */
    _onApiDispose() {
        this._api.removeListener('_pipRequested', this._handlePipRequested);
        this._api.removeListener('_willDispose', this._onApiDispose);
    }
}

/**
 * Initializes the picture-in-picture electron specific functionality in the renderer process.
 *
 * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
 * @returns {PictureInPictureRenderHook} The PiP render hook instance.
 */
module.exports = function setupPictureInPictureRender(api) {
    return new PictureInPictureRenderHook(api);
};
