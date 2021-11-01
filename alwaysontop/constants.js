module.exports = {
    AOT_WINDOW_NAME: 'AlwaysOnTop',
    ASPECT_RATIO: 16 / 9,
    EVENTS: {
        MOVE: 'aot-move',
        UPDATE_STATE: 'aot-update-state',
    },
    EXTERNAL_EVENTS: {
        ALWAYSONTOP_DISMISSED: 'dismissed',
        ALWAYSONTOP_WILL_CLOSE: 'will-close',
        ALWAYSONTOP_DOUBLE_CLICK: 'double-click'
    },
    SIZE: {
        width: 320,
        height: 180
    },
    STATES: {
        CLOSE: 'aot-close',
        CONFERENCE_JOINED: 'aot-conference-joined',
        DISMISS: 'aot-dismiss',
        HIDE: 'aot-hide',
        OPEN: 'aot-open',
        SHOW: 'aot-show',
        SHOW_MAIN_WINDOW: 'aot-main-window-show'
    },
    STORAGE: {
        AOT_X: 'aot-x',
        AOT_Y: 'aot-y'
    }
};
