const screenShareStop = document.getElementById("screen-share-marker-stop");
const screenShareMinimize = document.getElementById("screen-share-marker-minimize");
const sharingIdentity = document.getElementById("sharing-identity");

sharingIdentity.innerText = new URL(window.location).searchParams.get('sharingIdentity');

const { EVENTS, sendEvent } = window.JitsiScreenSharingTracker;

/**
 * Minimize the window.
 */
screenShareMinimize.addEventListener("click", function() {
    sendEvent(EVENTS.HIDE_TRACKER);
});

/**
 * When the user clicks the stop button, send a message that will eventually be processed by
 * {@link ScreenShareRenderHook} which will toggle the screen sharing session using the jitsi-meet api.
 */
screenShareStop.addEventListener("click", function() {
    sendEvent(EVENTS.STOP_SCREEN_SHARE);
});
