module.exports = {
    /**
     * electron.screen event
     */
    DISPLAY_METRICS_CHANGED: 'display-metrics-changed',

    /**
     * Types of remote-control events.
     */
    EVENTS: {
        mousemove: "mousemove",
        mousedown: "mousedown",
        mouseup: "mouseup",
        mousedblclick: "mousedblclick",
        mousescroll: "mousescroll",
        keydown: "keydown",
        keyup: "keyup",
        stop: "stop",
        supported: "supported"
    },

    /**
     * IPC channel carrying a single mouse/keyboard event from the renderer to
     * the main process, where it is executed via robotjs.
     */
    RC_EVENT: 'jitsi-remotecontrol-event',

    /**
     * IPC channel (ipcMain.handle) used to start a remote control session. The
     * main process resolves the shared display for the given sourceId and
     * replies with `{ result: true }` or `{ error }`.
     */
    RC_START: 'jitsi-remotecontrol-start',

    /**
     * IPC channel used to stop a remote control session.
     */
    RC_STOP: 'jitsi-remotecontrol-stop',

    /**
     * The named keys robotjs accepts in `keyToggle`. Anything outside this list
     * (other than a single printable ASCII character, which robotjs maps
     * directly) makes robotjs throw, so the preload sanitizer drops it before it
     * reaches the main process. Mirrors `key_names[]` in robotjs' robotjs.cc,
     * plus `caps_lock`, the spelling Jitsi Meet sends and which the main process
     * translates to `capslock`.
     */
    KEY_NAMES: [
        'backspace', 'delete', 'enter', 'tab', 'escape',
        'up', 'down', 'right', 'left', 'home', 'end', 'pageup', 'pagedown',
        'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
        'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23', 'f24',
        'capslock', 'caps_lock',
        'command', 'alt', 'right_alt', 'control', 'left_control', 'right_control',
        'shift', 'right_shift', 'space', 'printscreen', 'insert', 'menu',
        'audio_mute', 'audio_vol_down', 'audio_vol_up', 'audio_play', 'audio_stop',
        'audio_pause', 'audio_prev', 'audio_next', 'audio_rewind', 'audio_forward',
        'audio_repeat', 'audio_random',
        'numpad_lock', 'numpad_0', 'numpad_1', 'numpad_2', 'numpad_3', 'numpad_4',
        'numpad_5', 'numpad_6', 'numpad_7', 'numpad_8', 'numpad_9',
        'numpad_+', 'numpad_-', 'numpad_*', 'numpad_/', 'numpad_.',
        'lights_mon_up', 'lights_mon_down', 'lights_kbd_toggle', 'lights_kbd_up', 'lights_kbd_down'
    ],

    /**
     * The modifier names robotjs accepts alongside a key. Mirrors
     * `CheckKeyFlags` in robotjs' robotjs.cc; unrecognized modifiers make
     * robotjs throw.
     */
    KEY_MODIFIERS: [
        'alt', 'right_alt', 'command', 'control', 'left_control', 'right_control',
        'shift', 'right_shift', 'none'
    ],

    /**
     * Key actions mapping between the values in remote control key event and
     * robotjs methods.
     */
    KEY_ACTIONS_FROM_EVENT_TYPE: {
        keydown: "down",
        keyup: "up"
    },

    /**
     * Mouse actions mapping between the values in remote control mouse event and
     * robotjs methods.
     */
    MOUSE_ACTIONS_FROM_EVENT_TYPE: {
        mousedown: "down",
        mouseup: "up"
    },
    
    /**
     * Mouse button mapping between the values in remote control mouse event and
     * robotjs methods.
     */
    MOUSE_BUTTONS: {
        1: "left",
        2: "middle",
        3: "right"
    },

    /**
     * The name of remote control messages.
     */
    REMOTE_CONTROL_MESSAGE_NAME: "remote-control",

    /**
     * Types of remote-control requests.
     */
    REQUESTS: {
        start: "start"
    }
};
