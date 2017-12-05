/* global __dirname */
const { ipcRenderer, remote } = require('electron');

const os = require('os');
const path = require('path');
const url = require('url');

/**
 * URL for index.html which will be our entry point.
 */
const alwaysOnTopURL = url.format({
    pathname: path.join(__dirname, 'alwaysontop.html'),
    protocol: 'file:',
    slashes: true
});

/**
 * Implements the always on top functionality for the render process.
 */
class AlwaysOnTop {
    /**
     * Creates new instance.
     *
     * @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
     */
    constructor(api) {
        this._updateLargeVideoSrc = this._updateLargeVideoSrc.bind(this);
        this._openAlwaysOnTopWindow = this._openAlwaysOnTopWindow.bind(this);
        this._closeAlwaysOnTopWindow = this._closeAlwaysOnTopWindow.bind(this);
        this._onMessageReceived = this._onMessageReceived.bind(this);
        this._onConferenceJoined = this._onConferenceJoined.bind(this);
        this._onConferenceLeft = this._onConferenceLeft.bind(this);

        this._api = api;
        this._jitsiMeetElectronWindow = remote.getCurrentWindow();

        if (!api) {
            throw new Error('Wrong arguments!');
        }

        api.on('videoConferenceJoined', this._onConferenceJoined);
        api.on('videoConferenceLeft', this._onConferenceLeft);

        window.addEventListener('beforeunload', () => {
            // Maybe not necessary but it's better to be safe that we are not
            // leaking listeners:
            this._onConferenceLeft();

            api.removeListener(
                'videoConferenceJoined',
                this._onConferenceJoined
            );
            api.removeListener(
                'videoConferenceLeft',
                this._onConferenceLeft
            );
        });
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
    get _alwaysOnTopWindowVideo() {
        if(!this._alwaysOnTopWindow || !this._alwaysOnTopWindow.document) {
            return;
        }
        return this._alwaysOnTopWindow.document.getElementById('video');
    }

    /**
     * Handles videoConferenceJoined api event.
     *
     * @returns {void}
     */
    _onConferenceJoined() {
        this._jitsiMeetElectronWindow.on('blur', this._openAlwaysOnTopWindow);
        this._jitsiMeetElectronWindow.on('focus', this._closeAlwaysOnTopWindow);
        this._jitsiMeetElectronWindow.on('close', this._closeAlwaysOnTopWindow);
    }

    /**
     * Handles videoConferenceLeft api event.
     *
     * @returns {void}
     */
    _onConferenceLeft() {
        this._jitsiMeetElectronWindow.removeListener(
            'blur',
            this._openAlwaysOnTopWindow
        );
        this._jitsiMeetElectronWindow.removeListener(
            'focus',
            this._closeAlwaysOnTopWindow
        );
        this._jitsiMeetElectronWindow.removeListener(
            'close',
            this._closeAlwaysOnTopWindow
        );
        this._closeAlwaysOnTopWindow();
    }

    /**
     * Handles IPC messages from the main process.
     *
     * @param {*} event - The event object passed by electron.
     * @param {string} type - The type of the message.
     * @param {Object} data - The payload of the message.
     */
    _onMessageReceived(event, { type, data}) {
        const { id, name } = data;

        if (type === 'event' && name === 'new-window') {
            this._alwaysOnTopBrowserWindow
                = remote.BrowserWindow.fromId(id);
        }
    }

    /**
     * Creates and opens the always on top window.
     *
     * @returns {void}
     */
    _openAlwaysOnTopWindow() {
        if(this._alwaysOnTopWindow) {
            return;
        }
        ipcRenderer.on('jitsi-always-on-top', this._onMessageReceived);
        this._api.on('largeVideoChanged', this._updateLargeVideoSrc);
        this._alwaysOnTopWindow = window.open(alwaysOnTopURL, 'AlwaysOnTop');
        if(!this._alwaysOnTopWindow) {
            return;
        }
        this._alwaysOnTopWindow.alwaysOnTop = {
            api: this._api,
            onload: this._updateLargeVideoSrc,
            onbeforeunload: () => {
                this._api.removeListener(
                    'largeVideoChanged',
                    this._updateLargeVideoSrc
                );
            },
            ondblclick: () => {
                this._closeAlwaysOnTopWindow();
                this._jitsiMeetElectronWindow.show();
            },
            /**
             * On Windows and Linux if we use the standard drag
             * (-webkit-app-region: drag) all mouse events are blocked. To fix
             * this we'll implement drag ourselves.
             */
            shouldImplementDrag: os.type() !== 'Darwin',
            move: (x, y) => {
                if (this._alwaysOnTopBrowserWindow) {
                    this._alwaysOnTopBrowserWindow.setPosition(x, y);
                }
            }
        };
    }

    /**
     * Closes the always on top window.
     *
     * @returns {void}
     */
    _closeAlwaysOnTopWindow() {
        if(this._alwaysOnTopWindow) {
            this._alwaysOnTopWindow.close();
            this._alwaysOnTopWindow = undefined;
            this._alwaysOnTopBrowserWindow = undefined;
            ipcRenderer.removeListener('jitsi-always-on-top',
                this._onMessageReceived);
        }
    }

    /**
     * Updates the source of the always on top window when the source of the
     * large video is changed.
     *
     * @returns {void}
     */
    _updateLargeVideoSrc() {
        if(!this._alwaysOnTopWindowVideo) {
            return;
        }

        if(!this._jitsiMeetLargeVideo) {
            this._alwaysOnTopWindowVideo.style.display = 'none';
            this._alwaysOnTopWindowVideo.srcObject = null;
        } else {
            this._alwaysOnTopWindowVideo.style.display = 'block';
            const mediaStream = this._jitsiMeetLargeVideo.srcObject;
            const transform = this._jitsiMeetLargeVideo.style.transform;
            this._alwaysOnTopWindowVideo.srcObject = mediaStream;
            this._alwaysOnTopWindowVideo.style.transform = transform;
            this._alwaysOnTopWindowVideo.play();
        }
    }
}

/**
* Initializes the always on top functionality in the render process of the
* window which displays Jitsi Meet.
*
* @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
*/
module.exports = function setupAlwaysOnTopRender(api) {
    new AlwaysOnTop(api);
};
