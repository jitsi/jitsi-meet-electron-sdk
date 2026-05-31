const { ipcRenderer } = require('electron');
const os = require('os');
const postis = require("postis");
const constants = require("./constants");
const robot = require("@jitsi/robotjs");

const {
    EVENTS,
    KEY_ACTIONS_FROM_EVENT_TYPE,
    MOUSE_ACTIONS_FROM_EVENT_TYPE,
    MOUSE_BUTTONS,
    PERMISSIONS_ACTIONS,
    PROMPT_REMOTE_CONTROL_EVENT,
    REMOTE_CONTROL_MESSAGE_NAME,
    REQUESTS
} = constants;

/**
 * Parses the remote control events and executes them via robotjs.
 * {@link RemoteControlMain} needs to be initialized in the main process.
 * to work.
 */
class RemoteControl {
    /**
     * Constructs new instance and initializes the remote control functionality.
     *
     * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
     */
    constructor(api) {
        this._api = api;
        this._iframe = this._api.getIFrame();
        this._iframe.addEventListener('load', () => this._onIFrameLoad());
        this._approvedControllerId = undefined;
        this._authorizedRequestId = undefined;
        /**
         * The status ("up"/"down") of the mouse button.
         * FIXME: Assuming that one button at a time can be pressed. Haven't
         * noticed any issues but maybe we should store the status for every
         * mouse button that we are processing.
         */
        this._mouseButtonStatus = "up";
    }

    /**
     * Disposes the remote control functionality.
     */
    dispose() {
        if(this._channel) {
            this._channel.destroy();
            this._channel = null;
        }
        this._clearAuthorization();
        this._stop();
    }

    /**
     * Returns the scale factor for the current display used to calculate the resolution of the display.
     *
     * NOTE: On Mac OS this._display.scaleFactor will always be 2 for some reason. But the values returned from
     * this._display.bounds will already take into account the scale factor. That's why we are returning 1 for Mac OS.
     *
     * @returns {number} The scale factor.
     */
    _getDisplayScaleFactor() {
        return os.type() === 'Darwin' ? 1 : this._display.scaleFactor || 1;
    }

    /**
     * Sets the display metrics(x, y, width, height, scaleFactor, etc...) of the display that will be used for the
     * remote control.
     *
     * @param {string} sourceId - The source id of the desktop sharing stream.
     * @returns {void}
     */
    _setDisplayMetrics(sourceId) {
        this._display = ipcRenderer.sendSync('jitsi-remotecontrol-get-display', sourceId);
    }

    /**
     * Handles remote control start messages.
     *
     * @param {number} id - the id of the request that will be used for the
     * response.
     * @param {string} sourceId - The source id of the desktop sharing stream.
     */
    _start(id, sourceId) {
        this._displayMetricsChangeListener = () => {
            this._setDisplayMetrics(sourceId);
        };
        ipcRenderer.on('jitsi-remotecontrol-displays-changed', this._displayMetricsChangeListener);
        this._setDisplayMetrics(sourceId);

        const response = {
            id,
            type: 'response'
        };

        if(this._display) {
            response.result = true;
        } else {
            response.error
                = 'Error: Can\'t detect the display that is currently shared';
        }

        this._sendMessage(response);
    }

    /**
     * Clears the authorization state for remote control.
     *
     * @returns {void}
     */
    _clearAuthorization() {
        this._approvedControllerId = undefined;
        this._authorizedRequestId = undefined;
    }

    /**
     * Stops processing the events.
     */
    _stop() {
        this._display = undefined;
        this._mouseButtonStatus = "up";
        if (this._displayMetricsChangeListener) {
            ipcRenderer.removeListener('jitsi-remotecontrol-displays-changed', this._displayMetricsChangeListener);
            this._displayMetricsChangeListener = undefined;
        }
    }

    /**
     * Resolves the controller identifier from a remote control message.
     *
     * @param {Object} data - The remote control payload.
     * @returns {string|undefined}
     */
    _getControllerId(data = {}) {
        return data.controllerId || data.participantId || data.userId;
    }

    /**
     * Checks whether the message belongs to the approved controller.
     *
     * @param {Object} data - The remote control payload.
     * @returns {boolean}
     */
    _isAuthorizedMessage(data = {}) {
        const controllerId = this._getControllerId(data);

        return Boolean(controllerId
            && this._approvedControllerId
            && controllerId === this._approvedControllerId);
    }

    /**
     * Sends a permissions response to the iframe.
     *
     * @param {number|undefined} id - The request id.
     * @param {Object} request - The request payload.
     * @param {string} action - The permissions action.
     * @param {string} [error] - Optional error message.
     * @returns {void}
     */
    _sendPermissionsResponse(id, request, action, error) {
        this._sendEvent({
            ...request,
            action,
            error,
            type: EVENTS.permissions
        }, id);
    }

    /**
     * Handles remote control authorization requests.
     *
     * @param {Object} message - The remote control message.
     * @returns {Promise<void>}
     */
    async _handleAuthorizationRequest(message) {
        const { id, data } = message;
        const controllerId = this._getControllerId(data);

        this._stop();
        this._clearAuthorization();

        if (!controllerId) {
            this._sendPermissionsResponse(
                id,
                data,
                PERMISSIONS_ACTIONS.error,
                'Remote control request is missing the controller identity');

            return;
        }

        let response;

        try {
            response = await ipcRenderer.invoke(PROMPT_REMOTE_CONTROL_EVENT, {
                controllerId,
                displayName: data.displayName,
                participantId: data.participantId,
                screenSharing: Boolean(data.screenSharing),
                userId: data.userId
            });
        } catch (error) {
            this._sendPermissionsResponse(
                id,
                data,
                PERMISSIONS_ACTIONS.error,
                error.message);

            return;
        }

        if (!this._channel) {
            return;
        }

        if (response && response.action === PERMISSIONS_ACTIONS.grant) {
            this._approvedControllerId = controllerId;
            this._authorizedRequestId = id;
            this._sendPermissionsResponse(id, data, PERMISSIONS_ACTIONS.grant);
        } else if (response && response.action === PERMISSIONS_ACTIONS.error) {
            this._sendPermissionsResponse(
                id,
                data,
                PERMISSIONS_ACTIONS.error,
                response.error || 'Remote control approval failed');
        } else {
            this._sendPermissionsResponse(id, data, PERMISSIONS_ACTIONS.deny);
        }
    }

    /**
     * Handles iframe load events.
     */
    _onIFrameLoad() {
        this._stop();
        this._clearAuthorization();

        this._api.on('_willDispose', () => {
            this.dispose();
        });
        this._api.on('readyToClose', () => {
            this.dispose();
        });
        this._channel = postis({
            window: this._iframe.contentWindow,
            windowForEventListening: window,
            scope: 'jitsi-remote-control'
        });
        this._channel.ready(() => {
            this._channel.listen('message', message => {
                const { name } = message.data;
                if(name === REMOTE_CONTROL_MESSAGE_NAME) {
                    this._onRemoteControlMessage(message);
                }
            });
            this._sendEvent({ type: EVENTS.supported });
        });
    }

    /**
     * Executes the passed message.
     * @param {Object} message the remote control message.
     */
    _onRemoteControlMessage(message) {
        const { id, data } = message;
        const isAuthorizationRequest
            = data.type === EVENTS.permissions
                && data.action === PERMISSIONS_ACTIONS.request;

        if (isAuthorizationRequest) {
            this._handleAuthorizationRequest(message);

            return;
        }

        // If we haven't set the display prop. We haven't received the remote
        // control start message or there was an error associating a display.
        if ((data.type === REQUESTS.start || data.type === EVENTS.stop || this._display)
            && !this._isAuthorizedMessage(data)) {
            if (data.type === REQUESTS.start) {
                this._sendMessage({
                    error: 'Error: Remote control has not been approved for this participant',
                    id,
                    type: 'response'
                });
            }

            return;
        }

        if(!this._display
            && data.type != REQUESTS.start) {
            return;
        }
        switch(data.type) {
            case EVENTS.mousemove: {
                const { width, height, x, y } = this._display.bounds;
                const scaleFactor = this._getDisplayScaleFactor();
                const destX = data.x * width * scaleFactor + x;
                const destY = data.y * height * scaleFactor + y;
                if(this._mouseButtonStatus === "down") {
                    robot.dragMouse(destX, destY);
                } else {
                    robot.moveMouse(destX, destY);
                }
                break;
            }
            case EVENTS.mousedown:
            case EVENTS.mouseup: {
                this._mouseButtonStatus
                    = MOUSE_ACTIONS_FROM_EVENT_TYPE[data.type];
                robot.mouseToggle(
                    this._mouseButtonStatus,
                    (data.button
                            ? MOUSE_BUTTONS[data.button] : undefined));
                break;
            }
            case EVENTS.mousedblclick: {
                robot.mouseClick(
                    (data.button
                        ? MOUSE_BUTTONS[data.button] : undefined),
                    true);
                break;
            }
            case EVENTS.mousescroll:{
                const { x, y } = data;
                if(x !== 0 || y !== 0) {
                    robot.scrollMouse(x, y);
                }
                break;
            }
            case EVENTS.keydown:
            case EVENTS.keyup: {
                if (data.key) {
                    robot.keyToggle(
                        data.key === 'caps_lock' ? 'capslock' : data.key,
                        KEY_ACTIONS_FROM_EVENT_TYPE[data.type],
                        data.modifiers);
                }
                break;
            }
            case REQUESTS.start: {
                this._authorizedRequestId = id;
                this._start(id, data.sourceId);
                break;
            }
            case EVENTS.stop: {
                this._stop();
                this._clearAuthorization();
                break;
            }
            default:
                console.error("Unknown event type!");
        }
    }

    /**
     * Sends remote control event to the controlled participant.
     *
     * @param {Object} event the remote control event.
     */
    _sendEvent(event, id) {
        const remoteControlEvent = Object.assign(
            { name: REMOTE_CONTROL_MESSAGE_NAME },
            event
        );
        this._sendMessage({
            data: remoteControlEvent,
            id
        });
    }

    /**
     * Sends a message to Jitsi Meet.
     *
     * @param {Object} message the message to be sent.
     */
    _sendMessage(message) {
        this._channel.send({
            method: 'message',
            params: message
        });
    }
}

/**
 * Initializes the remote control functionality in the render process of the
 * window which displays Jitsi Meet.
 *
 * @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
 * @returns {RemoteControl} - the remote control object.
 */
module.exports = function setupRemoteControlRender(api) {
    return new RemoteControl(api);
};
