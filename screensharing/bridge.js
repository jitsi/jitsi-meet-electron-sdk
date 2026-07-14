const { SCREEN_SHARE_EVENTS, SCREEN_SHARE_EVENTS_CHANNEL, SCREEN_SHARE_GET_SOURCES } = require('./constants');

/**
 * Restricts `desktopCapturer.getSources` options to the known, cloneable fields
 * before they are forwarded to the main process. Anything else is dropped as
 * defense-in-depth against a compromised main world.
 *
 * @param {Object} options - The options object received from the main world.
 * @returns {Object} A sanitized options object.
 */
function sanitizeSourceOptions(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const safe = {
        types: Array.isArray(opts.types)
            ? opts.types.filter(type => typeof type === 'string')
            : [ 'screen', 'window' ]
    };

    if (opts.thumbnailSize && typeof opts.thumbnailSize === 'object') {
        const { height, width } = opts.thumbnailSize;

        safe.thumbnailSize = { height, width };
    }

    if (typeof opts.fetchWindowIcons === 'boolean') {
        safe.fetchWindowIcons = opts.fetchWindowIcons;
    }

    return safe;
}

/**
 * Whitelists an outgoing screen sharing event before it is sent to the main
 * process. Events with an unknown name are dropped.
 *
 * @param {Object} data - The event payload from the main world.
 * @returns {Object|null} A sanitized payload, or null when the event is invalid.
 */
function sanitizeOutgoingEvent(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    const { name } = data;

    if (!Object.values(SCREEN_SHARE_EVENTS).includes(name)) {
        return null;
    }

    const sanitized = { name };

    if ('requestId' in data) {
        sanitized.requestId = data.requestId;
    }
    if ('source' in data) {
        sanitized.source = data.source;
    }
    if ('screenShareAudio' in data) {
        sanitized.screenShareAudio = data.screenShareAudio;
    }

    return sanitized;
}

/**
 * Serializes a single `desktopCapturer` source so it can cross the
 * contextBridge. NativeImage instances (thumbnail, appIcon) do not survive the
 * structured clone, so they are replaced by their data URL, preserving the
 * `{ thumbnail: { dataUrl } }` shape the iframe API expects.
 *
 * @param {Object} source - A desktopCapturer source.
 * @returns {Object} A cloneable representation of the source.
 */
function serializeSource(source) {
    const { appIcon, thumbnail, ...rest } = source;
    const serialized = { ...rest };

    serialized.thumbnail = { dataUrl: thumbnail ? thumbnail.toDataURL() : null };

    if (appIcon) {
        serialized.appIcon = { dataUrl: appIcon.toDataURL() };
    }

    return serialized;
}

/**
 * Builds the screen sharing fragment of the `window.jitsiElectronSDK` bridge.
 *
 * @param {Object} context - Preload helpers.
 * @param {Electron.IpcRenderer} context.ipcRenderer - The ipcRenderer instance.
 * @param {Function} context.subscribe - Channel subscription helper.
 * @returns {Object} The screen sharing bridge API.
 */
module.exports = function createScreenSharingBridge({ ipcRenderer, subscribe }) {
    return {
        /**
         * Fetches the available desktop capture sources with their thumbnails
         * already serialized to data URLs.
         *
         * @param {Object} options - desktopCapturer.getSources options.
         * @returns {Promise<Array<Object>>} The serialized sources.
         */
        getDesktopSources: async options => {
            const sources = await ipcRenderer.invoke(SCREEN_SHARE_GET_SOURCES, sanitizeSourceOptions(options));

            return sources.map(serializeSource);
        },

        /**
         * Sends a screen sharing event to the main process.
         *
         * @param {Object} data - The event payload (must carry a known name).
         * @returns {void}
         */
        sendEvent: data => {
            const sanitized = sanitizeOutgoingEvent(data);

            if (sanitized) {
                ipcRenderer.send(SCREEN_SHARE_EVENTS_CHANNEL, { data: sanitized });
            }
        },

        /**
         * Subscribes to screen sharing events pushed from the main process.
         *
         * @param {Function} callback - Invoked with the event payload.
         * @returns {Function} An unsubscribe function.
         */
        onEvent: callback => subscribe(SCREEN_SHARE_EVENTS_CHANNEL, callback)
    };
};
