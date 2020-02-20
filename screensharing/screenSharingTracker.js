const { ipcRenderer, remote } = require('electron');
const querystring = require('querystring');

const { SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_EVENTS } = require('./constants');

const screenShareStop = document.getElementById("screen-share-marker-stop");
const screenShareMinimize = document.getElementById("screen-share-marker-minimize");
const sharingIdentity = document.getElementById("sharing-identity");

sharingIdentity.innerHTML = querystring.parse(global.location.search)['?sharingIdentity'];

/**
 * Minimize the window.
 */
screenShareMinimize.addEventListener("click", function() {
    remote.BrowserWindow.getFocusedWindow().minimize();
});

/**
 * When the user clicks the stop button, send a message that will eventually be processed by
 * {@link ScreenShareRenderHook} which will toggle the screen sharing session using the jitsi-meet api.
 */
screenShareStop.addEventListener("click", function() {
    ipcRenderer.send(SCREEN_SHARE_EVENTS_CHANNEL, {
        data: {
            name: SCREEN_SHARE_EVENTS.STOP_SCREEN_SHARE
        }
    });
});

