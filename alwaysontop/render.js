/* global __dirname */
const { ipcRenderer, remote } = require('electron');

const { EventEmitter } = require('events');
const os = require('os');
const path = require('path');
const url = require('url');

const { ALWAYSONTOP_WILL_CLOSE } = require('./constants');

/**
 * URL for index.html which will be our entry point.
 */
const alwaysOnTopURL = url.format({
    pathname: path.join(__dirname, 'alwaysontop.html'),
    protocol: 'file:',
    slashes: true
});

/**
 * Returieves and trying to parse a numeric value from the local storage.
 *
 * @param {string} localStorageKey - The key of the value that has to be
 * retrieved from local storage.
 * @returns {number} - The parsed number or undefined if the value is not
 * available or if it can't be converted to number.
 */
function getNumberFromLocalStorage(localStorageKey) {
    const localStorageValue = localStorage.getItem(localStorageKey);

    // We need to explicitly check these values because Number('') is 0 and
    // Number(null) is 0.
    if(typeof localStorageValue !== 'string' || localStorageValue === '') {
        return undefined;
    }

    const value = Number(localStorageValue);

    if(isNaN(value)) { // Handling values like 'abcde'
        return undefined;
    }

    return value;
}

/**
 * Implements the always on top functionality for the render process.
 */
class AlwaysOnTop extends EventEmitter {
    /**
     * Creates new instance.
     *
     * @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
     */
    constructor(api) {
        super();
        this._updateLargeVideoSrc = this._updateLargeVideoSrc.bind(this);
        this._openAlwaysOnTopWindow = this._openAlwaysOnTopWindow.bind(this);
        this._closeAlwaysOnTopWindow = this._closeAlwaysOnTopWindow.bind(this);
        this._onMessageReceived = this._onMessageReceived.bind(this);
        this._onConferenceJoined = this._onConferenceJoined.bind(this);
        this._onConferenceLeft = this._onConferenceLeft.bind(this);
        this._onIntersection = this._onIntersection.bind(this);

        this._api = api;
        this._jitsiMeetElectronWindow = remote.getCurrentWindow();
        this._intersectionObserver = new IntersectionObserver(this._onIntersection);

        if (!api) {
            throw new Error('Wrong arguments!');
        }

        api.on('videoConferenceJoined', this._onConferenceJoined);
        api.on('videoConferenceLeft', this._onConferenceLeft);
        api.on('_willDispose', this._onConferenceLeft);

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

        this._sendPosition(this._position);
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
     * Sends the position of the always on top window to the main process.
     *
     * @param {Object} position - The position to be sent.
     * @returns  {void}
     */
    _sendPosition({ x, y }) {
        ipcRenderer.send('jitsi-always-on-top', {
            type: 'event',
            data: {
                name: 'position',
                x,
                y
            }
        });
    }

    /**
     * Getter for the position of the always on top window.
     *
     * @returns {Object} The x and y coordinates of the window.
     */
    get _position() {
        return {
            x: getNumberFromLocalStorage('jitsi-always-on-top-x'),
            y: getNumberFromLocalStorage('jitsi-always-on-top-y')
        };
    }

    /**
     * Setter for the position of the always on top window. Stores the
     * coordinates in the local storage and and sends them to the main process.
     *
     * @param {Object} coordinates - The x and y coordinates of the window.
     */
    set _position({ x, y }) {
        if (typeof x === 'number' && typeof y === 'number') {
            localStorage.setItem('jitsi-always-on-top-x', x);
            localStorage.setItem('jitsi-always-on-top-y', y);
            this._sendPosition({ x, y });
        }
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
        this._intersectionObserver.observe(this._api.getIFrame());
    }

    /**
     * Handles videoConferenceLeft api event.
     *
     * @returns {void}
     */
    _onConferenceLeft() {
        this._intersectionObserver.unobserve(this._api.getIFrame());
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
     * Handles intersection events for the instance's IntersectionObserver
     *
     * @param {IntersectionObserverEntry[]} entries
     * @param {IntersectionObserver} observer
     */
    _onIntersection(entries) {
        const singleEntry = entries.pop();
        this._jitsiMeetElectronWindow.removeListener(
            'focus',
            this._closeAlwaysOnTopWindow
        );

        if (singleEntry.isIntersecting) {
            this._closeAlwaysOnTopWindow();
            this._jitsiMeetElectronWindow.on(
                'focus',
                this._closeAlwaysOnTopWindow
            );
        } else {
            this._openAlwaysOnTopWindow();
        }
    }

    /**
     * Handles IPC messages from the main process.
     *
     * @param {*} event - The event object passed by electron.
     * @param {string} type - The type of the message.
     * @param {Object} data - The payload of the message.
     */
    _onMessageReceived(event, { type, data = {}}) {
        if (type === 'event' && data.name === 'new-window') {
            this._alwaysOnTopBrowserWindow
                = remote.BrowserWindow.fromId(data.id);
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
                this.emit(ALWAYSONTOP_WILL_CLOSE);
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
        if (this._alwaysOnTopBrowserWindow && !this._alwaysOnTopBrowserWindow.isDestroyed()) {
            const position =
                this._alwaysOnTopBrowserWindow.getPosition();

            this._position = {
                x: position[0],
                y: position[1]
            };
        }

        if(this._alwaysOnTopWindow) {
            // we need to check the BrowserWindow reference here because
            // window.closed is not reliable due to Electron quirkiness
            if(this._alwaysOnTopBrowserWindow &&!this._alwaysOnTopBrowserWindow.isDestroyed()) {
                this._alwaysOnTopWindow.close();
            }

            ipcRenderer.removeListener('jitsi-always-on-top',
                this._onMessageReceived);
        }

        this._alwaysOnTopBrowserWindow = undefined;
        this._alwaysOnTopWindow = undefined;
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
    return new AlwaysOnTop(api);
};
