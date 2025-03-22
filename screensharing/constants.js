/**
 * The name of the channel that exchange events between render and main process.
 * @type {string}
 */
export const SCREEN_SHARE_EVENTS_CHANNEL = 'jitsi-screen-sharing-marker';

/**
 * The name of the channel that returns desktopCapturer.getSources
 * @type {string}
 */
export const SCREEN_SHARE_GET_SOURCES = 'jitsi-screen-sharing-get-sources';

/**
 * Size of the screen sharing tracker window.
 */
export const TRACKER_SIZE = {
    height: 40,
    width: 530
};

/**
 * Possible events passed on the SCREEN_SHARE_EVENTS_CHANNEL.
 */
export const SCREEN_SHARE_EVENTS = {
    OPEN_TRACKER: 'open-tracker-window',
    CLOSE_TRACKER: 'close-tracker-window',
    HIDE_TRACKER: 'hide-tracker-window',
    STOP_SCREEN_SHARE: 'stop-screen-share',
    OPEN_PICKER: 'open-picker',
    DO_GDM: 'do-gdm'
};
