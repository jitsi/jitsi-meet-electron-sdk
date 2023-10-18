
const { ipcRenderer } = require('electron');

const { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS, SCREEN_SHARE_GET_SOURCES } = require('./constants');
const { logInfo, logWarning, setLogger } = require('./utils');

/**
 * Renderer process component that sets up electron specific screen sharing functionality, like screen sharing
 * marker and window selection.
 * {@link ScreenShareMainHook} needs to be initialized in the main process for the always on top tracker window
 * to work.
 */
class ScreenShareRenderHook {
    /**
     * Creates a ScreenShareRenderHook hooked to jitsi meet iframe events.
     *
     * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
     */
    constructor(api) {
        this._api = api;
        this._iframe = this._api.getIFrame();

        this._onScreenSharingStatusChanged = this._onScreenSharingStatusChanged.bind(this);
        this._sendCloseTrackerEvent = this._sendCloseTrackerEvent.bind(this);
        this._onScreenSharingEvent = this._onScreenSharingEvent.bind(this);
        this._onIframeApiLoad = this._onIframeApiLoad.bind(this);
        this._cleanTrackerContext = this._cleanTrackerContext.bind(this);
        this._onApiDispose = this._onApiDispose.bind(this);

        this._api.on('_willDispose', this._onApiDispose);
        this._iframe.addEventListener('load', this._onIframeApiLoad);
    }

    // this is a rewrite of the sendRequest method on the transport
    // used this to add an abort controller in case the backend doesn't
    // respond to the request
    // will be removed when is sure that the backend will respond to the request
    _isElectronScreensharing() {
        const transport = this._api._transport;

        if (!transport._backend) {
            return Promise.reject(new Error('No transport backend defined!'));
        }
        transport._requestID++;

        const id = transport._requestID;
        const controller = new AbortController();
        // If the request is not being responded in 10 sec the promise will be rejected.
        setTimeout(() => controller.abort('Request timeout'), 10000);

        return new Promise((resolve, reject) => {
            const abortListener = ({target}) => {
                controller.signal.removeEventListener('abort', abortListener);
                reject(target.reason);
              };

            controller.signal.addEventListener('abort', abortListener);
            transport._responseHandlers.set(id, ({ error, result }) => {
                if (typeof result !== 'undefined') {
                    resolve(result);

                // eslint-disable-next-line no-negated-condition
                } else if (typeof error !== 'undefined') {
                    reject(error);
                } else { // no response
                    reject(new Error('Unexpected response format!'));
                }
            });

            try {
                transport._backend.send({
                    type: 'request',
                    data: {
                        name: '_is_electron_screensharing'
                    },
                    id
                });
            } catch (error) {
                transport._responseHandlers.delete(id);
                reject(error);
            }
        });
    }

    /**
     * Make sure that even after reload/redirect the screensharing will be available
     */
    async _onIframeApiLoad() {
        this._iframe.contentWindow.JitsiMeetElectron = {
            /**
             * Get sources available for screensharing. The callback is invoked
             * with an array of DesktopCapturerSources.
             *
             * @param {Function} callback - The success callback.
             * @param {Function} errorCallback - The callback for errors.
             * @param {Object} options - Configuration for getting sources.
             * @param {Array} options.types - Specify the desktop source types
             * to get, with valid sources being "window" and "screen".
             * @param {Object} options.thumbnailSize - Specify how big the
             * preview images for the sources should be. The valid keys are
             * height and width, e.g. { height: number, width: number}. By
             * default electron will return images with height and width of
             * 150px.
             */
            obtainDesktopStreams(callback, errorCallback, options = {}) {
                ipcRenderer.invoke(SCREEN_SHARE_GET_SOURCES, options)
                    .then((sources) => callback(sources))
                    .catch((error) => errorCallback(error));
            }
        };

        ipcRenderer.on(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        this._api.on('screenSharingStatusChanged', this._onScreenSharingStatusChanged);
        this._api.on('videoConferenceLeft', this._sendCloseTrackerEvent);

        let isShareScreenExternalAPISupported;
        try {
            isShareScreenExternalAPISupported = await this._isElectronScreensharing();
        } catch (e) {
            isShareScreenExternalAPISupported = false;
        }

        if (isShareScreenExternalAPISupported) {
            this._iframe.contentWindow.JitsiMeetElectron = undefined;
            this._api.on('_requestDesktopSources', async (request, callback) => {
                const { options } = request;

                ipcRenderer.invoke(SCREEN_SHARE_GET_SOURCES, options)
                    .then((sources)=> sources.map(item => {item.thumbnail.dataUrl = item.thumbnail.toDataURL(); return item;}))
                    .then((sources) => callback({sources}))
                    .catch((error) => callback({ error }));
            });
            logInfo("Using external api screen share method");
        } else {
            logInfo("Using legacy screen share method");
        }
    }

    /**
     * Listen for events coming on the screen sharing event channel.
     *
     * @param {Object} event - Electron event data.
     * @param {Object} data - Channel specific data.
     *
     * @returns {void}
     */
    _onScreenSharingEvent(event, { data }) {
        switch (data.name) {
            // Event send by the screen sharing tracker window when a user stops screen sharing from it.
            // Send appropriate command to jitsi meet api.
            case SCREEN_SHARE_EVENTS.STOP_SCREEN_SHARE:
                if (this._isScreenSharing) {
                    this._api.executeCommand('toggleShareScreen');
                }
                break;
            default:
                logWarning(`Unhandled ${SCREEN_SHARE_EVENTS_CHANNEL}: ${data}`);

        }
    }

    /**
     * React to screen sharing events coming from the jitsi meet api. There should be
     * a {@link ScreenShareMainHook} listening on the main process for the forwarded events.
     *
     * @param {Object} event
     *
     * @returns {void}
     */
    _onScreenSharingStatusChanged(event) {
        if (event.on) {
            this._isScreenSharing = true;
            // Send event which should open an always on top tracker window from the main process.
            ipcRenderer.send(SCREEN_SHARE_EVENTS_CHANNEL, {
                data: {
                    name: SCREEN_SHARE_EVENTS.OPEN_TRACKER
                }
            });
        } else {
            this._isScreenSharing = false;
            this._sendCloseTrackerEvent();
        }
    }

    /**
     * Send event which should close the always on top tracker window.
     *
     * @return {void}
     */
    _sendCloseTrackerEvent() {
        ipcRenderer.send(SCREEN_SHARE_EVENTS_CHANNEL, {
            data: {
                name: SCREEN_SHARE_EVENTS.CLOSE_TRACKER
            }
        });
    }

    /**
     * Clear all event handlers related to the tracker in order to avoid any potential leaks and closes it in the event
     * that it's currently being displayed.
     *
     * @returns {void}
     */
    _cleanTrackerContext() {
        ipcRenderer.removeListener(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        this._api.removeListener('screenSharingStatusChanged', this._onScreenSharingStatusChanged);
        this._api.removeListener('videoConferenceLeft', this._sendCloseTrackerEvent);
        this._sendCloseTrackerEvent();
    }

    /**
     * Clear all event handlers in order to avoid any potential leaks.
     *
     * NOTE: It is very important to remove the load listener only when we are sure that the iframe won't be used
     * anymore. Otherwise if we use the videoConferenceLeft event for example, when the iframe is internally reloaded
     * because of an error and then loads again we won't initialize the screen sharing functionality.
     *
     * @returns {void}
     */
    _onApiDispose() {
        this._cleanTrackerContext();
        this._api.removeListener('_willDispose', this._onApiDispose);
        this._iframe.removeEventListener('load', this._onIframeApiLoad);
    }
}

/**
 * Initializes the screen sharing electron specific functionality in the renderer process containing the
 * jitsi meet iframe.
 *
 * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
 */
module.exports = function setupScreenSharingRender(api, loggerTransports = null) {
    setLogger(loggerTransports);

    return new ScreenShareRenderHook(api);
};
