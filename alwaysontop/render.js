/* global __dirname */
const { ipcRenderer, remote } = require('electron');

const { EventEmitter } = require('events');
const os = require('os');
const path = require('path');
const log = require('jitsi-meet-logger');

const { ALWAYSONTOP_DISMISSED, ALWAYSONTOP_WILL_CLOSE, SIZE } = require('./constants');

/**
 * The logger instance
 */
let logger;

/**
 * Checks if a BrowserWindow object is defined and that it's not destroyed
 *
 * @param  {BrowserWindow} win - electron BrowserWindow instance to be checked
 * @return {boolean} - whether the window object exists and can be worked with
 */
function exists(win) {
    return win && !win.isDestroyed();
}

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
    if (typeof localStorageValue !== 'string' || localStorageValue === '') {
        return undefined;
    }

    const value = Number(localStorageValue);

    if (isNaN(value)) { // Handling values like 'abcde'
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
        this._showAlwaysOnTopWindow = this._showAlwaysOnTopWindow.bind(this);
        this._hideAlwaysOnTopWindow = this._hideAlwaysOnTopWindow.bind(this);
        this._onMessageReceived = this._onMessageReceived.bind(this);
        this._onConferenceJoined = this._onConferenceJoined.bind(this);
        this._onConferenceLeft = this._onConferenceLeft.bind(this);
        this._onIntersection = this._onIntersection.bind(this);
        this._onFocus = this._onFocus.bind(this);
        this._onBlur = this._onBlur.bind(this);
        this._dismiss = this._dismiss.bind(this);

        this._api = api;
        this._jitsiMeetElectronWindow = remote.getCurrentWindow();
        this._intersectionObserver = new IntersectionObserver(this._onIntersection);
        this._isHidden = true;
        this._isIntersecting = true;

        this.logInfo('constructor');
        if (!api) {
            throw new Error('Wrong arguments!');
        }

        api.on('videoConferenceJoined', this._onConferenceJoined);
        api.on('videoConferenceLeft', this._onConferenceLeft);
        api.on('_willDispose', this._onConferenceLeft);

        window.addEventListener('beforeunload', () => {
            this.logInfo('beforeunload');
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
            this.logInfo('beforeunload end');
        });

        this._sendPosition(this._position);
        this.logInfo('constructor end');
    }

    /**
     * Event handler for window focus.
     */
    _onFocus() {
        this.logInfo('_onFocus');
        if (this._isIntersecting) {
            this.logInfo('hide aot');
            this._hideAlwaysOnTopWindow();
        }
    }

    /**
     * Event handler for window blur.
     */
    _onBlur() {
        this.logInfo('_onBlur');
        this._openAlwaysOnTopWindow();
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
        if (!this._alwaysOnTopWindow || !this._alwaysOnTopWindow.document) {
            return undefined;
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
        this.logInfo('_sendPosition');
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
     * Wrapper over the logger's info
     *
     * @param {string} info - The info text
     */
    logInfo(info) {
        logger.info(`[RENDER] ${info}`);
    }

    /**
    * Wrapper over the logger's error
    *
    * @param {Object} err - the error object
    */
    logError(err) {
        logger.error({ err }, '[RENDER ERROR]');
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
     * Sends reset size command to the main process.
     * This is needed in order to reset AOT to the default size after leaving a conference
     * @private
     */
    _sendResetSize() {
        this.logInfo('_sendResetSize');
        ipcRenderer.send('jitsi-always-on-top', {
            type: 'event',
            data: {
                name: 'resetSize',
            }
        });
    }

    /**
     * Handles videoConferenceJoined api event.
     *
     * @returns {void}
     */
    _onConferenceJoined() {
        this.logInfo('_onConferenceJoined');
        this._isIntersecting = true;
        this._jitsiMeetElectronWindow.on('blur', this._onBlur);
        this._jitsiMeetElectronWindow.on('focus', this._onFocus);
        this._jitsiMeetElectronWindow.on('close', this._closeAlwaysOnTopWindow);
        this._intersectionObserver.observe(this._api.getIFrame());
        this.logInfo('_onConferenceJoined end');
    }

    /**
     * Handles videoConferenceLeft api event.
     *
     * @returns {void}
     */
    _onConferenceLeft() {
        this.logInfo('_onConferenceLeft');
        this._intersectionObserver.unobserve(this._api.getIFrame());
        this._jitsiMeetElectronWindow.removeListener(
            'blur',
            this._onBlur
        );
        this._jitsiMeetElectronWindow.removeListener(
            'focus',
            this._onFocus
        );
        this._jitsiMeetElectronWindow.removeListener(
            'close',
            this._closeAlwaysOnTopWindow
        );
        this._sendResetSize();
        this._closeAlwaysOnTopWindow();
        this.logInfo('_onConferenceLeft end');
    }

    /**
     * Handles intersection events for the instance's IntersectionObserver
     *
     * @param {IntersectionObserverEntry[]} entries
     * @param {IntersectionObserver} observer
     */
    _onIntersection(entries) {
        this.logInfo('_onIntersection');
        const singleEntry = entries.pop();
        this._isIntersecting = singleEntry.isIntersecting;

        if (singleEntry.isIntersecting) {
            this.logInfo('isIntersecting: true');
            this._hideAlwaysOnTopWindow();
        } else {
            this.logInfo('isIntersecting: false');
            this._openAlwaysOnTopWindow();
        }

        this.logInfo('_onIntersection end');
    }

    /**
     * Handles IPC messages from the main process.
     *
     * @param {*} event - The event object passed by electron.
     * @param {string} type - The type of the message.
     * @param {Object} data - The payload of the message.
     */
    _onMessageReceived(event, { type, data = {} }) {
        this.logInfo('_onMessageReceived');
        if (type === 'event' && data.name === 'new-window') {
            this.logInfo('_onMessageReceived: new-window');
            this._onNewAlwaysOnTopBrowserWindow(data.id);
        }
        this.logInfo('_onMessageReceived end');
    }

    /**
     * Handles 'new-window' always on top events.
     *
     * @param {number} windowId - The id of the BrowserWindow instance.
     * @returns {void}
     */
    _onNewAlwaysOnTopBrowserWindow(windowId) {
        this.logInfo('_onNewAlwaysOnTopBrowserWindow');
        this._alwaysOnTopBrowserWindow = remote.BrowserWindow.fromId(windowId);
        if (!this._alwaysOnTopBrowserWindow || this._alwaysOnTopBrowserWindow.isDestroyed()) {
            return;
        }

        const { webContents } = this._alwaysOnTopBrowserWindow;
        // if the window is still loading we may end up loosing the injected content when load finishes. We need to wait
        // for the loading to be completed. We are using the browser windows events instead of the DOM window ones because
        // it appears they are unreliable (readyState is always completed, most of the events are not fired!!!)
        if (webContents.isLoading()) {
            this.logInfo('_onNewAlwaysOnTopBrowserWindow: isLoading');
            webContents.on('did-stop-loading', () => this._setupAlwaysOnTopWindow());
        } else {
            this._setupAlwaysOnTopWindow();
        }
        this.logInfo('_onNewAlwaysOnTopBrowserWindow end');
    }
    /**
     * Dismisses always on top window.
     *
     * @returns {void}
     */
    _dismiss() {
        this.logInfo('_dismiss');
        this.emit(ALWAYSONTOP_DISMISSED);
        this._closeAlwaysOnTopWindow();
        this.logInfo('_dismiss end');
    }

    /**
     * Sets all necessary content (HTML, CSS, JS) to the always on top window.
     *
     * @returns {void}
     */
    _setupAlwaysOnTopWindow() {
        this.logInfo('_setupAlwaysOnTopWindow');
        if (!this._alwaysOnTopWindow) {
            return;
        }
        this._alwaysOnTopWindow.alwaysOnTop = {
            api: this._api,
            dismiss: this._dismiss,
            onload: this._updateLargeVideoSrc,
            onbeforeunload: () => {
                this.logInfo('_setupAlwaysOnTopWindow: onbeforeunload');
                this.emit(ALWAYSONTOP_WILL_CLOSE);
                this._isHidden = true;
                this._api.removeListener(
                    'largeVideoChanged',
                    this._updateLargeVideoSrc
                );
                this.logInfo('_setupAlwaysOnTopWindow: onbeforeunload end');
            },
            ondblclick: () => {
                this.logInfo('_setupAlwaysOnTopWindow: ondblclick');
                this._hideAlwaysOnTopWindow();
                this._jitsiMeetElectronWindow.show();
                this.logInfo('_setupAlwaysOnTopWindow: ondblclick end');
            },
            /**
             * On Windows and Linux if we use the standard drag
             * (-webkit-app-region: drag) all mouse events are blocked. To fix
             * this we'll implement drag ourselves.
             */
            shouldImplementDrag: os.type() !== 'Darwin',
            /**
             * Custom implementation for window move.
             * We use setBounds in order to preserve the initial size of the window
             * during drag. This is in order to fix:
             * https://github.com/electron/electron/issues/9477
             * @param x
             * @param y
             */
            move: (x, y, initialSize) => {
                if (this._alwaysOnTopBrowserWindow) {
                    try {
                        this._alwaysOnTopBrowserWindow.setBounds({
                            x,
                            y,
                            width: initialSize.width,
                            height: initialSize.height
                        });
                    } catch (e) {
                        this.logError(e);
                    }
                }
            },
            /**
             * Returns the current size of the AOT window
             * @returns {{width: number, height: number}}
             */
            getCurrentSize: () => {
                if (this._alwaysOnTopBrowserWindow) {
                    try {
                        const [width, height] = this._alwaysOnTopBrowserWindow.getSize();
                        return { width, height };
                    } catch (e) { 
                        this.logError(e);
                    }
                }

                return SIZE;
            }
        };

        const cssPath = path.join(__dirname, './alwaysontop.css');
        const jsPath = path.join(__dirname, './alwaysontop.js');

        // Add the markup for the JS to manipulate and load the CSS.
        this._alwaysOnTopWindow.document.body.innerHTML = `
            <div id="react"></div>
            <video autoplay="" id="video" style="transform: none;" muted></video>
            <div class="dismiss"></div>
            <link rel="stylesheet" href="file://${ cssPath}">
        `;

        // JS must be loaded through a script tag, as setting it through
        // inner HTML maybe not trigger script load.
        const scriptTag
            = this._alwaysOnTopWindow.document.createElement('script');

        scriptTag.setAttribute('src', `file://${jsPath}`);
        this._alwaysOnTopWindow.document.head.appendChild(scriptTag);
        this.logInfo('_setupAlwaysOnTopWindow end');
    }

    /**
     * Creates and opens the always on top window.
     *
     * @returns {void}
     */
    _openAlwaysOnTopWindow() {
        this.logInfo('_openAlwaysOnTopWindow');
        if (this._alwaysOnTopWindow) {
            this._showAlwaysOnTopWindow();
            return;
        }
        ipcRenderer.on('jitsi-always-on-top', this._onMessageReceived);
        this._api.on('largeVideoChanged', this._updateLargeVideoSrc);

        // Intentionally open about:blank. Otherwise if an origin is set, a
        // cross-origin redirect can cause any set global variables to be blown
        // away.
        this._alwaysOnTopWindow = window.open('', 'AlwaysOnTop');
        this._isHidden = false;
        this.logInfo('_openAlwaysOnTopWindow end');
    }

    /**
     * Closes the always on top window.
     *
     * @returns {void}
     */
    _closeAlwaysOnTopWindow() {
        this.logInfo('_closeAlwaysOnTopWindow');
        if (exists(this._alwaysOnTopBrowserWindow)) {
            try {
                this.logInfo('_closeAlwaysOnTopWindow: store position');
                const position =
                    this._alwaysOnTopBrowserWindow.getPosition();

                this._position = {
                    x: position[0],
                    y: position[1]
                };
            } catch (e) { 
                this.logError(e);
            }
        }

        if (this._alwaysOnTopWindow) {
            this.logInfo('_closeAlwaysOnTopWindow: close');
            // we need to check the BrowserWindow reference here because
            // window.closed is not reliable due to Electron quirkiness
            if (exists(this._alwaysOnTopBrowserWindow)) {
                this._alwaysOnTopWindow.close();
                this._isHidden = true;
            }

            ipcRenderer.removeListener('jitsi-always-on-top', this._onMessageReceived);
        }

        //we need to tell the main process to close the BrowserWindow because when
        //open and close AOT are called in quick succession, the reference to the new BrowserWindow
        //instantiated on main process is set to undefined, thus we lose control over it
        ipcRenderer.send('jitsi-always-on-top-should-close');

        this._alwaysOnTopBrowserWindow = undefined;
        this._alwaysOnTopWindow = undefined;
        this.logInfo('_closeAlwaysOnTopWindow end');
    }

    /**
     * Shows the always on top window.
     *
     * @returns {void}
     */
    _showAlwaysOnTopWindow() {
        if (exists(this._alwaysOnTopBrowserWindow)) {
            this._isHidden = false;
            this._updateLargeVideoSrc();
            try {
                this._alwaysOnTopBrowserWindow.showInactive();
            } catch (e) {
                this.logError(e);
            }
        }
    }

    /**
     * Hides the always on top window.
     *
     * @returns {void}
     */
    _hideAlwaysOnTopWindow() {
        if (exists(this._alwaysOnTopBrowserWindow)) {
            this.emit(ALWAYSONTOP_WILL_CLOSE);
            try {
                this._alwaysOnTopBrowserWindow.hide();
                this._isHidden = true;
                this._alwaysOnTopWindowVideo.style.display = 'none';
                this._alwaysOnTopWindowVideo.srcObject = null;
            } catch (e) {
                this.logError(e);
            }
        }
    }

    /**
     * Updates the source of the always on top window when the source of the
     * large video is changed.
     *
     * @returns {void}
     */
    _updateLargeVideoSrc() {
        this.logInfo('_updateLargeVideoSrc');
        if (this._isHidden || !this._alwaysOnTopWindowVideo) {
            return;
        }

        if (!this._jitsiMeetLargeVideo) {
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
        this.logInfo('_updateLargeVideoSrc end');
    }
}

/**
* Initializes the always on top functionality in the render process of the
* window which displays Jitsi Meet.
*
* @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
* @param {Logger} loggerTransports - external loggers
*/
module.exports = function setupAlwaysOnTopRender(api, loggerTransports) {
    logger = log.getLogger('AOT', loggerTransports || []);
    return new AlwaysOnTop(api);
};
