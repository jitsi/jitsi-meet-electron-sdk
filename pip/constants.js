/**
 * IPC channel for picture-in-picture communication between renderer and main process.
 */
const PIP_CHANNEL = 'jitsi-pip-channel';

/**
 * IPC channel used to ask the main process to focus the window hosting the
 * meeting when the user double clicks the custom PiP window (the legacy
 * always-on-top double-click behavior).
 */
const PIP_FOCUS_MAIN_CHANNEL = 'jitsi-pip-focus-main-channel';

/**
 * The window.open() frame name that identifies the custom PiP window opened by
 * jitsi-meet from inside the meeting iframe. Must stay in sync with
 * react/features/pip in jitsi-meet.
 */
const PIP_WINDOW_NAME = 'JitsiMeetPiPWindow';

/**
 * Name under which the PiP window configuration is registered in the popups
 * config registry.
 */
const PIP_WINDOW_POPUP_CONFIG_NAME = 'jitsi-pip-window';

/**
 * Default (and minimum) size of the PiP window;
 */
const PIP_WINDOW_SIZE = {
    height: 180,
    width: 320
};

/**
 * Aspect ratio enforced while resizing the PiP window; matches the legacy
 * always-on-top window.
 */
const PIP_WINDOW_ASPECT_RATIO = 16 / 9;

/**
 * electron-store keys under which the PiP window position is persisted
 * between sessions.
 */
const PIP_WINDOW_POSITION_STORAGE_KEYS = {
    X: 'pip-window-x',
    Y: 'pip-window-y'
};

module.exports = {
    PIP_CHANNEL,
    PIP_FOCUS_MAIN_CHANNEL,
    PIP_WINDOW_ASPECT_RATIO,
    PIP_WINDOW_NAME,
    PIP_WINDOW_POPUP_CONFIG_NAME,
    PIP_WINDOW_POSITION_STORAGE_KEYS,
    PIP_WINDOW_SIZE
};
