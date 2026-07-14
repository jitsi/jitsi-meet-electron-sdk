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
