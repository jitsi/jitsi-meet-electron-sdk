const electron = require('electron');
const postis = require('postis');
const { ipcRenderer } = electron;

const {
    POWER_MONITOR_EVENTS_CHANNEL,
    POWER_MONITOR_MESSAGE_NAME,
    POWER_MONITOR_QUERIES_CHANNEL
} = require('./constants');

/**
 * The channel we use to communicate with Jitsi Meet window.
 */
let _channel;

/**
 * The listener we use to listen for power monitor events.
 * @param _ - Not used.
 * @param event - The event.
 */
function eventsChannelListener(_, event) {
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
    // response-listener path did.
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
    ipcRenderer.removeListener(
        POWER_MONITOR_EVENTS_CHANNEL, eventsChannelListener);

    if(_channel) {
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
            ipcRenderer.on(POWER_MONITOR_EVENTS_CHANNEL, eventsChannelListener);
            _channel.listen('message', message => {
                const { name } = message.data;
                if(name === POWER_MONITOR_MESSAGE_NAME) {
                    ipcRenderer.invoke(POWER_MONITOR_QUERIES_CHANNEL, message)
                        .then(response => _sendMessage(response))
                        .catch(() => { /* window tearing down; drop the response */ });
                }
            });
        });
    });
};
