
const { ipcRenderer } = require('electron');

const { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS, SCREEN_SHARE_GET_SOURCES } = require('./constants');
const { logWarning, setLogger } = require('./utils');

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

    /**
     * Make sure that even after reload/redirect the screensharing will be available
     */
    async _onIframeApiLoad() {
        ipcRenderer.on(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        this._api.on('screenSharingStatusChanged', this._onScreenSharingStatusChanged);
        this._api.on('videoConferenceLeft', this._sendCloseTrackerEvent);
        this._api.on('_requestDesktopSources', async (request, callback) => {
            const { options } = request;

            ipcRenderer.invoke(SCREEN_SHARE_GET_SOURCES, options)
                .then(sources => {
                    sources.forEach(item => {
                        item.thumbnail.dataUrl = item.thumbnail.toDataURL();
                    });
                    callback({ sources });
                })
                .catch((error) => callback({ error }));
        });
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
            case SCREEN_SHARE_EVENTS.OPEN_PICKER: {
                // Store requestId to match response with request
                const { requestId } = data;

                this._api._openDesktopPicker().then(r => {
                    ipcRenderer.send(SCREEN_SHARE_EVENTS_CHANNEL, {
                        data: {
                            name: SCREEN_SHARE_EVENTS.DO_GDM,
                            requestId,
                            ...r
                        }
                    });
                }).catch(error => {
                    // If picker fails, still send DO_GDM with requestId to complete the flow
                    logWarning(`Desktop picker error: ${error}`);
                    ipcRenderer.send(SCREEN_SHARE_EVENTS_CHANNEL, {
                        data: {
                            name: SCREEN_SHARE_EVENTS.DO_GDM,
                            requestId,
                            source: null
                        }
                    });
                });
                break;
            }
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
