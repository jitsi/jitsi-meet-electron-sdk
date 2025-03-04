export const AOT_WINDOW_NAME = 'AlwaysOnTop';
export const ASPECT_RATIO = 16 / 9;

export const EVENTS = {
    MOVE: 'aot-move',
    UPDATE_STATE: 'aot-update-state',
};

export const EXTERNAL_EVENTS = {
    ALWAYSONTOP_DISMISSED: 'dismissed',
    ALWAYSONTOP_WILL_CLOSE: 'will-close',
    ALWAYSONTOP_DOUBLE_CLICK: 'double-click'
};

export const EVENTS_CHANNEL = 'aot-events-channel';

export const SIZE = {
    width: 320,
    height: 180
};

export const STATES = {
    CLOSE: 'aot-close',
    CONFERENCE_JOINED: 'aot-conference-joined',
    DISMISS: 'aot-dismiss',
    HIDE: 'aot-hide',
    OPEN: 'aot-open',
    SHOW: 'aot-show',
    SHOW_MAIN_WINDOW: 'aot-main-window-show',
    IS_NOT_INTERSECTING: 'is-not-intersecting',
    IS_INTERSECTING: 'is-intersecting'
};

export const STORAGE = {
    AOT_X: 'aot-x',
    AOT_Y: 'aot-y'
};
