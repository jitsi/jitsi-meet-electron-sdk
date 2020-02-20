/* global process */

const { ipcRenderer, desktopCapturer } = require('electron');
const semver = require('semver');

const { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS } = require('./constants');

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
        this._cleanContext = this._cleanContext.bind(this);

        ipcRenderer.on(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        this._api.on('screenSharingStatusChanged', this._onScreenSharingStatusChanged);
        this._api.on('videoConferenceLeft', this._cleanContext);
        this._api.on('_willDispose', this._cleanContext);
        this._iframe.addEventListener('load', this._onIframeApiLoad);
    }

    /**
     * Make sure that even after reload/redirect the screensharing will be available
     */
    _onIframeApiLoad() {
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
                if (semver.lt(process.versions.electron, '5.0.0')) {
                    desktopCapturer.getSources(options, (error, sources) => {
                        if (error) {
                            errorCallback(error);
                            return;
                        }

                        callback(sources);
                    });
                } else {
                    desktopCapturer
                        .getSources(options)
                        .then((sources) => callback(sources))
                        .catch((error) => errorCallback(error));
                }
            }
        };
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
                console.warn(`Unhandled ${SCREEN_SHARE_EVENTS_CHANNEL}: ${data}`);

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
     * Clear all event handler in order to avoid any potential leaks and close the screen sharing tracker
     * window in the event that it's currently being displayed.
     *
     * @returns {void}
     */
    _cleanContext() {
        ipcRenderer.removeListener(SCREEN_SHARE_EVENTS_CHANNEL, this._onScreenSharingEvent);
        this._api.removeListener('screenSharingStatusChanged', this._onScreenSharingStatusChanged);
        this._api.removeListener('videoConferenceLeft', this._sendCloseTrackerEvent);
        this._api.removeListener('_willDispose', this._sendCloseTrackerEvent);
        this._iframe.removeEventListener('load', this._onIframeApiLoad);
        this._sendCloseTrackerEvent();
    }
}

/**
 * Initializes the screen sharing electron specific functionality in the renderer process containing the
 * jitsi meet iframe.
 *
 * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
 */
module.exports = function setupScreenSharingRender(api) {
    return new ScreenShareRenderHook(api);
};
