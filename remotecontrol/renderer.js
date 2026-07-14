const postis = require('postis');

const { getBridge } = require('../renderer/bridge');
const { EVENTS, REMOTE_CONTROL_MESSAGE_NAME, REQUESTS } = require('./constants');

/**
 * Relays remote control events between the Jitsi Meet iframe and the main
 * process. Unlike the pre-context-isolation renderer, it no longer executes
 * robotjs or resolves display metrics: it forwards start/stop/events over the
 * `window.jitsiElectronSDK.remoteControl` bridge, and the main process does the
 * actual work. {@link RemoteControlMain} must be initialized in the main
 * process for this to work.
 */
class RemoteControl {
    /**
     * Constructs new instance and initializes the remote control functionality.
     *
     * @param {JitsiIFrameApi} api - The Jitsi Meet iframe api object.
     */
    constructor(api) {
        this._api = api;
        this._bridge = getBridge('remoteControl');
        this._iframe = this._api.getIFrame();

        // Whether a remote control session has been started. Guards against
        // forwarding events before the display has been associated in main.
        this._started = false;

        this._onIFrameLoad = this._onIFrameLoad.bind(this);
        this._iframe.addEventListener('load', this._onIFrameLoad);
    }

    /**
     * Disposes the remote control functionality.
     */
    dispose() {
        if (this._channel) {
            this._channel.destroy();
            this._channel = null;
        }
        this._stop();
    }

    /**
     * Handles remote control start messages by asking the main process to
     * resolve the shared display, then relays the outcome to Jitsi Meet.
     *
     * @param {number} id - the id of the request that will be used for the
     * response.
     * @param {string} sourceId - The source id of the desktop sharing stream.
     * @returns {Promise<void>}
     */
    async _start(id, sourceId) {
        const response = {
            id,
            type: 'response'
        };

        let result;

        try {
            result = await this._bridge.start(sourceId);
        } catch (e) {
            result = { error: `Error: ${e && e.message}` };
        }

        if (result && result.result) {
            this._started = true;
            response.result = true;
        } else {
            this._started = false;
            response.error = (result && result.error)
                || 'Error: Can\'t detect the display that is currently shared';
        }

        this._sendMessage(response);
    }

    /**
     * Stops processing the events.
     */
    _stop() {
        this._started = false;
        this._bridge.stop();
    }

    /**
     * Handles iframe load events.
     */
    _onIFrameLoad() {
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
     * Forwards the passed message to the main process.
     * @param {Object} message the remote control message.
     */
    _onRemoteControlMessage(message) {
        const { id, data } = message;

        switch(data.type) {
            case REQUESTS.start:
                this._start(id, data.sourceId);
                break;
            case EVENTS.stop:
                this._stop();
                break;
            case EVENTS.mousemove:
            case EVENTS.mousedown:
            case EVENTS.mouseup:
            case EVENTS.mousedblclick:
            case EVENTS.mousescroll:
            case EVENTS.keydown:
            case EVENTS.keyup:
                // Ignore events until the session has started, mirroring the
                // guard the main process also enforces.
                if (this._started) {
                    this._bridge.sendEvent(data);
                }
                break;
            default:
                console.error("Unknown event type!");
        }
    }

    /**
     * Sends remote control event to the controlled participant.
     *
     * @param {Object} event the remote control event.
     */
    _sendEvent(event) {
        const remoteControlEvent = Object.assign(
            { name: REMOTE_CONTROL_MESSAGE_NAME },
            event
        );
        this._sendMessage({ data: remoteControlEvent });
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
