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
     * Event for retrieving display metrics
     */
    GET_DISPLAY_EVENT: 'jitsi-remotecontrol-get-display',

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
