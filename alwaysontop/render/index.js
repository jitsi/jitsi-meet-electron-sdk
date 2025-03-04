import { EventEmitter } from 'events';
import { ipcRenderer } from 'electron';
import path from 'path';
import { logInfo, setLogger } from './utils.js';
import { EVENTS, STATES, AOT_WINDOW_NAME, EXTERNAL_EVENTS, EVENTS_CHANNEL } from '../constants.js';

/**
 * Sends an update state event to the main process
 * @param {string} state the updated aot window state
 */
const sendStateUpdate = state => {
    logInfo(`sending ${state} state update to main process`);
    ipcRenderer.send(EVENTS_CHANNEL, { name: EVENTS.UPDATE_STATE, state });
};

/**
 * Sends a move command to the main process
 * @param {Number} x
 * @param {Number} y
 * @param {Object} initialSize - The size of the window on move start.
 */
const move = (x, y, initialSize) => {
    ipcRenderer.send(EVENTS_CHANNEL, {
        name: EVENTS.MOVE,
        initialSize,
        position: { x, y },
    });
};

class AlwaysOnTop extends EventEmitter {
    /**
     * Creates new instance.
     *
     * @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
     * @param {Object} options - AOT options.
     */
    constructor(api, { showOnPrejoin }) {
        super();

        this._api = api;
        this._showOnPrejoin = showOnPrejoin;
        this._joined = false;
        this._disposeWindow = this._disposeWindow.bind(this);
        this._dismiss = this._dismiss.bind(this);
        this._onConferenceJoined = this._onConferenceJoined.bind(this);
        this._onAotEvent = this._onAotEvent.bind(this);
        this._handleStateChange = this._handleStateChange.bind(this);
        this._switchToMainWindow = this._switchToMainWindow.bind(this);
        this._updateLargeVideoSrc = this._updateLargeVideoSrc.bind(this);
        this._onIntersection = this._onIntersection.bind(this);
        this._intersectionObserver = new IntersectionObserver(this._onIntersection);

        this._api.on('videoConferenceJoined', this._onConferenceJoined);
        this._api.on('readyToClose', this._disposeWindow);
        this._api.on('_willDispose', this._disposeWindow);

        if (showOnPrejoin) {
            this._api.on('prejoinScreenLoaded', this._onConferenceJoined);
        }

        window.parent.addEventListener('beforeunload', this._disposeWindow);
    }

    /**
     * Getter for the large/prejoin video element in Jitsi Meet.
     *
     * @returns {HTMLElement|undefined} the large video.
     */
    get _jitsiMeetLargeVideo() {
        if (this._showOnPrejoin) {
            return this._api._getPrejoinVideo() || this._api._getLargeVideo();
        } else {
            return this._api._getLargeVideo();
        }
    }

    /**
     * Getter for the target video element in the always on top window
     *
     * @returns {HTMLElement|undefined} the large video.
     */
    get _aotWindowVideo() {
        if (!this._aotWindow || !this._aotWindow.document) {
            return undefined;
        }
        return this._aotWindow.document.getElementById('video');
    }

    _onConferenceJoined() {
        logInfo('on conference joined');
        if (this._joined) {
            logInfo('conference already joined');
            return;
        }

        this._joined = true;
        ipcRenderer.on(EVENTS_CHANNEL, this._onAotEvent);

        sendStateUpdate(STATES.CONFERENCE_JOINED);

        this._intersectionObserver.observe(this._api.getIFrame());
    }

    /**
     * Handles intersection events for the instance's IntersectionObserver
     *
     * @param {IntersectionObserverEntry[]} entries
     * @param {IntersectionObserver} observer
     */
    _onIntersection(entries) {
        logInfo('handling main window intersection');
        const singleEntry = entries.pop();

        if (singleEntry.isIntersecting) {
            sendStateUpdate(STATES.IS_INTERSECTING);
        } else {
            sendStateUpdate(STATES.IS_NOT_INTERSECTING);
        }
    }

    /**
     * Updates the source of the always on top window when the source of the
     * large video is changed.
     *
     * @returns {void}
     */
    _updateLargeVideoSrc() {
        // adding a small timeout before updating media seems to fix the black screen preview
        // in the bottom right corner during screen share.
        setTimeout(() => {
            if (!this._aotWindow) {
                return;
            }

            if (!this._jitsiMeetLargeVideo) {
                this._aotWindowVideo.style.display = 'none';
                this._aotWindowVideo.srcObject = null;
            } else {
                this._aotWindowVideo.style.display = 'block';
                const mediaStream = this._jitsiMeetLargeVideo.srcObject;
                const transform = this._jitsiMeetLargeVideo.style.transform;
                this._aotWindowVideo.srcObject = mediaStream;
                this._aotWindowVideo.style.transform = transform;
                this._aotWindowVideo.play();
            }
        }, 100);
    }

    /**
     * Closes the aot window without causing main process to clear its main window handlers
     * This allows the aot window to be reopened on another focus - blur sequence on the main window
     */
    _dismiss() {
        this.emit(EXTERNAL_EVENTS.ALWAYSONTOP_DISMISSED);
        sendStateUpdate(STATES.DISMISS);
    }

    /**
     * Switches focus to the main window
     */
    _switchToMainWindow() {
        this.emit(EXTERNAL_EVENTS.ALWAYSONTOP_DOUBLE_CLICK);
        sendStateUpdate(STATES.SHOW_MAIN_WINDOW);
    }

    /**
     * Opens a new window
     */
    _openNewWindow(magic) {
        logInfo('new window');
        this._api.on('largeVideoChanged', this._updateLargeVideoSrc);
        this._api.on('prejoinVideoChanged', this._updateLargeVideoSrc);
        this._api.on('videoMuteStatusChanged', this._updateLargeVideoSrc);

        this._aotWindow = window.open('', `${AOT_WINDOW_NAME}-${magic}`);
        this._aotWindow.alwaysOnTop = {
            api: this._api,
            dismiss: this._dismiss,
            /**
             * Custom implementation for window move.
             * We use setBounds in order to preserve the initial size of the window
             * during drag. This is in order to fix:
             * https://github.com/electron/electron/issues/9477
             * @param x
             * @param y
             */
            move,
            ondblclick: this._switchToMainWindow,
            onload: this._updateLargeVideoSrc,
        };

        const cssPath = path.join(import.meta.url, './alwaysontop.css');
        const jsPath = path.join(import.meta.url, './alwaysontop.js');

        // Add the markup for the JS to manipulate and load the CSS.
        this._aotWindow.document.body.innerHTML = `
            <div id="react"></div>
            <video autoplay="" id="video" style="transform: none;" muted></video>
            <div class="dismiss"></div>
            <link rel="stylesheet" href="file://${cssPath}">
        `;

        // JS must be loaded through a script tag, as setting it through
        // inner HTML may not trigger script load.
        const scriptTag = this._aotWindow.document.createElement('script');
        scriptTag.setAttribute('src', `file://${jsPath}`);
        this._aotWindow.document.head.appendChild(scriptTag);
    }

    /**
     * Hides the aot window
     */
    _hideWindow() {
        this._api.removeListener('largeVideoChanged', this._updateLargeVideoSrc);
        this._api.removeListener('videoMuteStatusChanged', this._updateLargeVideoSrc);

        this.emit(EXTERNAL_EVENTS.ALWAYSONTOP_WILL_CLOSE);

        if (this._aotWindowVideo) {
            this._aotWindowVideo.srcObject = null;
        }
    }

    /**
     * Shows the aot window
     */
    _showWindow() {
        this._api.on('largeVideoChanged', this._updateLargeVideoSrc);
        this._api.on('prejoinVideoChanged', this._updateLargeVideoSrc);
        this._api.on('videoMuteStatusChanged', this._updateLargeVideoSrc);

        this._updateLargeVideoSrc();
    }

    /**
     * Disposes the aot window
     *
     */
    _disposeWindow() {
        logInfo('disposing window');

        this._joined = false;
        this._api.removeListener('largeVideoChanged', this._updateLargeVideoSrc);
        this._api.removeListener('prejoinVideoChanged', this._updateLargeVideoSrc);
        this._api.removeListener('videoMuteStatusChanged', this._updateLargeVideoSrc);
        this._api.removeListener('videoConferenceJoined', this._onConferenceJoined);
        this._api.removeListener('readyToClose', this._disposeWindow);
        window.parent.removeEventListener('beforeunload', this._disposeWindow);

        if (this._showOnPrejoin) {
            this._api.removeListener('prejoinScreenLoaded', this._onConferenceJoined);
        }

        const iframe = this._api.getIFrame();

        if (iframe) {
            this._intersectionObserver.unobserve(this._api.getIFrame());
        }

        this.emit(EXTERNAL_EVENTS.ALWAYSONTOP_WILL_CLOSE);

        sendStateUpdate(STATES.CLOSE);
        ipcRenderer.removeListener(EVENTS_CHANNEL, this._onAotEvent);

        if (this._aotWindow) {
            delete this._aotWindow.alwaysOnTop;
            this._aotWindow.close();
            this._aotWindow = null;
        }
    }

    /**
     * Handler for aot channel events
     *
     * @param {IpcRendererEvent} event electron event
     * @param {Object} options channel params
     */
    _onAotEvent(event, { name, ...rest }) {
        switch (name) {
            case EVENTS.UPDATE_STATE:
                this._handleStateChange(rest.state, rest.data);
                break;
        }
    }

    /**
     * Handler for state updates
     *
     * @param {string} state updated state
     * @param {Object} data ancillary data to the event
     */
    _handleStateChange(state, data) {
        logInfo(`handling ${state} state update from main process`);

        switch (state) {
            case STATES.HIDE:
                this._hideWindow();
                break;
            case STATES.OPEN:
                try {
                    this._openNewWindow(data.aotMagic);
                } catch (e) {
                    this._api.removeListener('largeVideoChanged', this._updateLargeVideoSrc);
                    this._api.removeListener('prejoinVideoChanged', this._updateLargeVideoSrc);
                    this._api.removeListener('videoMuteStatusChanged', this._updateLargeVideoSrc);
                }
                break;
            case STATES.SHOW:
                this._showWindow();
                break;
            default:
                break;
        }
    }
}

/**
* Initializes the always on top functionality in the render process of the
* window which displays Jitsi Meet.
*
* @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
* @param {Logger} loggerTransports - external loggers.
* @param {Object} options - AOT options.
*/
export default (api, loggerTransports, { showOnPrejoin = false } = {}) => {
    setLogger(loggerTransports);

    return new AlwaysOnTop(api, {
        showOnPrejoin: showOnPrejoin && typeof api._getPrejoinVideo === 'function'
    });
};
