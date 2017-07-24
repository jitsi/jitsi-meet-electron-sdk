/* global __dirname */
const { remote } = require('electron');

const path = require("path");
const url = require("url");

/**
 * URL for index.html which will be our entry point.
 */
const alwaysOnTopURL = url.format({
    pathname: path.join(__dirname, "alwaysontop.html"),
    protocol: "file:",
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

        this._api = api;
        this._jitsiMeetElectronWindow
            = remote.getCurrentWindow();

        if (!api) {
            throw new Error('Wrong arguments!');
        }
        this._jitsiMeetElectronWindow.on('blur', this._openAlwaysOnTopWindow);
        this._jitsiMeetElectronWindow.on('focus', this._closeAlwaysOnTopWindow);
        this._jitsiMeetElectronWindow.on('close', this._closeAlwaysOnTopWindow);
    }

    /**
     * Getter for the large video element in Jitsi Meet.
     *
     * @returns {HTMLElement|undefined} the large video.
     */
    get _jitsiMeetLargeVideo() {
        const iframe = this._api.getIFrame();
        if(!iframe || !iframe.contentWindow || !iframe.contentWindow.document) {
            return;
        }
        return iframe.contentWindow.document.getElementById('largeVideo');
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
     * Creates and opens the always on top window.
     *
     * @returns {void}
     */
    _openAlwaysOnTopWindow() {
        if(!this._jitsiMeetLargeVideo || this._alwaysOnTopWindow) {
            return;
        }
        this._jitsiMeetLargeVideo.addEventListener(
            'play',
            this._updateLargeVideoSrc
        );
        this._alwaysOnTopWindow = window.open(alwaysOnTopURL, 'AlwaysOnTop');
        if(!this._alwaysOnTopWindow) {
            return;
        }
        this._alwaysOnTopWindow.alwaysOnTop = {
            api: this._api,
            onload: this._updateLargeVideoSrc,
            onbeforeunload: () => {
                if(this._jitsiMeetLargeVideo) {
                    this._jitsiMeetLargeVideo.removeEventListener(
                        'play',
                        this._updateLargeVideoSrc
                    );
                }
            },
            ondblclick: () => {
                this._closeAlwaysOnTopWindow();
                this._jitsiMeetElectronWindow.show();
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
        }
    }

    /**
     * Updates the source of the always on top window when the source of the
     * large video is changed.
     *
     * @returns {void}
     */
    _updateLargeVideoSrc() {
        if(!this._jitsiMeetLargeVideo || !this._alwaysOnTopWindowVideo) {
            return;
        }
        const mediaStream = this._jitsiMeetLargeVideo.srcObject;
        const transform = this._jitsiMeetLargeVideo.style.transform;
        this._alwaysOnTopWindowVideo.srcObject = mediaStream;
        this._alwaysOnTopWindowVideo.style.transform = transform;
        this._alwaysOnTopWindowVideo.play();
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
