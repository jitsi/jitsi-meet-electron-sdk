const postis = require('postis');

const { getBridge } = require('../renderer/bridge');
const { POWER_MONITOR_MESSAGE_NAME } = require('./constants');

/**
 * The power monitor bridge fragment exposed by the SDK preload.
 */
let _bridge;

/**
 * The channel we use to communicate with Jitsi Meet window.
 */
let _channel;

/**
 * Unsubscribe function for the power monitor events subscription.
 */
let _unsubscribeEvents;

/**
 * The listener we use to listen for power monitor events.
 *
 * @param {Object} event - The event.
 * @returns {void}
 */
function eventsChannelListener(event) {
    _sendEvent(event);
}

/**
 * Sends event to Jitsi Meet.
 *
 * @param {Object} event the remote control event.
 */
function _sendEvent(event) {
    _sendMessage({
        data: Object.assign({ name: POWER_MONITOR_MESSAGE_NAME }, event)
    });
}

/**
 * Sends a message to Jitsi Meet.
 *
 * @param {Object} message the message to be sent.
 */
function _sendMessage(message) {
    // A query invoke can resolve after dispose() has torn down the channel
    // (e.g. the iframe closed mid-query); drop the late response as the old
    // subscription-based path did.
    if (!_channel) {
        return;
    }

    _channel.send({
          method: 'message',
          params: message
    });
}

/**
 * Disposes the power monitor functionality.
 */
function dispose() {
    if (_unsubscribeEvents) {
        _unsubscribeEvents();
        _unsubscribeEvents = null;
    }

    if (_channel) {
        _channel.destroy();
        _channel = null;
    }
}

/**
 * Initializes the power monitor in the render process of the
 * window which displays Jitsi Meet.
 *
 * @param {JitsiIFrameApi} api - the Jitsi Meet iframe api object.
 */
module.exports = function setupPowerMonitorRender(api) {
    _bridge = getBridge('powerMonitor');

    const iframe = api.getIFrame();

    api.on('_willDispose', dispose);
    api.on('readyToClose', dispose);

    iframe.addEventListener('load', () => {
        _channel = postis({
            window: iframe.contentWindow,
            windowForEventListening: window,
            scope: 'jitsi-power-monitor'
        });
        _channel.ready(() => {
            _unsubscribeEvents = _bridge.onEvent(eventsChannelListener);
            _channel.listen('message', message => {
                const { name } = message.data;
                if(name === POWER_MONITOR_MESSAGE_NAME) {
                    _bridge.query(message)
                        .then(response => _sendMessage(response))
                        .catch(() => { /* window tearing down; drop the response */ });
                }
            });
        });
    });
};
