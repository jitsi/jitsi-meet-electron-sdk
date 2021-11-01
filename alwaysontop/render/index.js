/* global __dirname */

const { EventEmitter } = require('events');
const { ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { logInfo, setLogger } = require('../main/utils');

const { EVENTS, STATES, AOT_WINDOW_NAME, EXTERNAL_EVENTS } = require('../constants');

/**
 * Sends an update state event to main process
 * @param {string} value the updated aot window state
 */
 const sendStateUpdate = value => {
    logInfo(`sending ${value} state update to main process`);

    ipcRenderer.send(EVENTS.UPDATE_STATE, { value } );
};

/**
 * Sends a move command to the main process
 * @param {Number} x 
 * @param {Number} y 
 */
const move = (x, y) => {
    ipcRenderer.send(EVENTS.MOVE, { x, y } );
};

class AlwaysOnTop extends EventEmitter {
    /**
     * Creates new instance.
     *
     * @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
     */
    constructor(api) {
        super();

        this._api = api;

        this._closeWindow = this._closeWindow.bind(this);
        this._dismiss = this._dismiss.bind(this);
        this._onConferenceJoined = this._onConferenceJoined.bind(this);
        this._onStateChange = this._onStateChange.bind(this);
        this._switchToMainWindow = this._switchToMainWindow.bind(this);
        this._updateLargeVideoSrc = this._updateLargeVideoSrc.bind(this);

        this._api.on('_willDispose', this._closeWindow);
        this._api.on('videoConferenceJoined', this._onConferenceJoined);
        this._api.on('videoConferenceLeft', this._closeWindow);
    }

    /**
     * Getter for the large video element in Jitsi Meet.
     *
     * @returns {HTMLElement|undefined} the large video.
     */
    get _jitsiMeetLargeVideo() {
        return this._api._getLargeVideo();
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
        ipcRenderer.on(EVENTS.UPDATE_STATE, this._onStateChange);

        sendStateUpdate(STATES.CONFERENCE_JOINED);
    }

    /**
     * Updates the source of the always on top window when the source of the
     * large video is changed.
     *
     * @returns {void}
     */
     _updateLargeVideoSrc() {
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
    _openNewWindow() {
        this._api.on('largeVideoChanged', this._updateLargeVideoSrc);

        this._aotWindow = window.open('', AOT_WINDOW_NAME);
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
            /**
             * On Windows and Linux if we use the standard drag
             * (-webkit-app-region: drag) all mouse events are blocked. To fix
             * this we'll implement drag ourselves.
             */
            shouldImplementDrag: os.type() !== 'Darwin'
        };

        const cssPath = path.join(__dirname, './alwaysontop.css');
        const jsPath = path.join(__dirname, './alwaysontop.js');

        // Add the markup for the JS to manipulate and load the CSS.
        this._aotWindow.document.body.innerHTML = `
            <div id="react"></div>
            <video autoplay="" id="video" style="transform: none;" muted></video>
            <div class="dismiss"></div>
            <link rel="stylesheet" href="file://${cssPath}">
        `;

        // JS must be loaded through a script tag, as setting it through
        // inner HTML maybe not trigger script load.
        const scriptTag = this._aotWindow.document.createElement('script');

        scriptTag.setAttribute('src', `file://${jsPath}`);
        this._aotWindow.document.head.appendChild(scriptTag);
    }

    /**
     * Hides the aot window
     */
    _hideWindow() {
        this._api.removeListener('largeVideoChanged', this._updateLargeVideoSrc);

        this.emit(EXTERNAL_EVENTS.ALWAYSONTOP_WILL_CLOSE);

        this._aotWindow.srcObject = null;
    }

    /**
     * Shows the aot window
     */
    _showWindow() {
        this._api.on('largeVideoChanged', this._updateLargeVideoSrc);

        this._updateLargeVideoSrc();
    }

    /**
     * Closes the aot window
     * 
     */
    _closeWindow() {
        logInfo(`closing window and cleaning listeners`);

        this.emit(EXTERNAL_EVENTS.ALWAYSONTOP_WILL_CLOSE);

        sendStateUpdate(STATES.CLOSE);

        this._api.removeListener('_willDispose', this._closeWindow);
        this._api.removeListener('largeVideoChanged', this._updateLargeVideoSrc);
        this._api.removeListener('videoConferenceJoined', this._onConferenceJoined);
        this._api.removeListener('videoConferenceLeft', this._closeWindow);

        ipcRenderer.removeListener(EVENTS.UPDATE_STATE, this._onStateChange);

        if (this._aotWindow) {
            this._aotWindow.close();
            this._aotWindow = null;
        }
    }

    /**
     * Handler for state updates
     * @param {Event} event trigger event
     * @param {Object} options event params
     */
    _onStateChange (event, { value }) {
        logInfo(`handling ${value} state update from main process`);

        switch (value) {
            case STATES.HIDE:
                this._hideWindow();
                break;
            case STATES.OPEN:
                this._openNewWindow();
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
* @param {Logger} loggerTransports - external loggers
*/
module.exports = (api, loggerTransports) => {
    setLogger(loggerTransports);

    return new AlwaysOnTop(api, loggerTransports);
};
