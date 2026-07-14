const { ipcMain } = require('electron');

/**
 * Per-window IPC router for the SDK's main-process handlers.
 *
 * Electron's `ipcMain` is process-wide: a channel has a single set of `.on`
 * listeners and (crucially) `ipcMain.handle` throws if the same channel is
 * registered twice. That makes it awkward for several `setup*Main` calls to
 * coexist (e.g. two windows both hosting Jitsi Meet), and it offers no sender
 * validation on its own.
 *
 * This router registers each channel with `ipcMain` exactly once and keeps a
 * table of per-window routes. Every incoming event is dispatched to the first
 * route whose `accepts(sender)` predicate matches `event.sender`. Events from a
 * sender that matches no route are rejected (invoke) or dropped (send), which is
 * the sender validation required by the migration plan: only the WebContents a
 * feature was set up for can reach its handler. When the last route for a
 * channel is removed the global `ipcMain` registration is torn down.
 *
 * @typedef {Object} Route
 * @property {Electron.WebContents} owner - Identity key for the route, used for
 * add (idempotent replace) and remove. Also the default sender matcher.
 * @property {function(Electron.WebContents): boolean} [accepts] - Predicate
 * deciding whether an event's sender belongs to this route. Defaults to strict
 * identity against `owner` (`sender === owner`).
 * @property {Function} handler - Feature handler invoked as `(event, ...args)`.
 * For invoke routes its return value becomes the `ipcRenderer.invoke` result.
 */

/**
 * Registered invoke (`ipcMain.handle`) channels.
 * @type {Map<string, { routes: Route[] }>}
 */
const invokeChannels = new Map();

/**
 * Registered send (`ipcMain.on`) channels. The bound global `listener` is kept
 * so it can be removed once the channel has no routes left.
 * @type {Map<string, { routes: Route[], listener: Function }>}
 */
const sendChannels = new Map();

/**
 * Normalizes a route, filling in the default identity matcher.
 *
 * @param {Route} route - The route to normalize.
 * @returns {Route} The normalized route.
 */
function normalize(route) {
    return {
        owner: route.owner,
        accepts: route.accepts || (sender => sender === route.owner),
        handler: route.handler
    };
}

/**
 * Inserts or replaces (by `owner`) a route in a channel's route list.
 *
 * @param {Route[]} routes - The channel's current routes.
 * @param {Route} route - The route to upsert.
 * @returns {void}
 */
function upsert(routes, route) {
    const index = routes.findIndex(existing => existing.owner === route.owner);

    if (index === -1) {
        routes.push(route);
    } else {
        routes[index] = route;
    }
}

/**
 * Finds the route that claims ownership of an event's sender.
 *
 * @param {Route[]} routes - The channel's current routes.
 * @param {Electron.IpcMainEvent|Electron.IpcMainInvokeEvent} event - The event.
 * @returns {Route|undefined} The matching route, or undefined when none match.
 */
function routeFor(routes, event) {
    return routes.find(route => route.accepts(event.sender));
}

/**
 * Registers an invoke route (`ipcRenderer.invoke` / `ipcMain.handle`). The
 * underlying `ipcMain.handle` is installed on first use for the channel.
 *
 * @param {string} channel - The IPC channel name.
 * @param {Route} route - The per-window route.
 * @returns {void}
 */
function addInvokeRoute(channel, route) {
    let entry = invokeChannels.get(channel);

    if (!entry) {
        entry = { routes: [] };
        invokeChannels.set(channel, entry);
        ipcMain.handle(channel, (event, ...args) => {
            const matched = routeFor(entry.routes, event);

            if (!matched) {
                return { error: 'Error: rejected IPC from an untrusted sender' };
            }

            return matched.handler(event, ...args);
        });
    }

    upsert(entry.routes, normalize(route));
}

/**
 * Removes a previously added invoke route. When the channel has no routes left
 * its `ipcMain.handle` registration is removed.
 *
 * @param {string} channel - The IPC channel name.
 * @param {Electron.WebContents} owner - The route's owner identity.
 * @returns {void}
 */
function removeInvokeRoute(channel, owner) {
    const entry = invokeChannels.get(channel);

    if (!entry) {
        return;
    }

    entry.routes = entry.routes.filter(route => route.owner !== owner);

    if (entry.routes.length === 0) {
        ipcMain.removeHandler(channel);
        invokeChannels.delete(channel);
    }
}

/**
 * Registers a send route (`ipcRenderer.send` / `ipcMain.on`). A single global
 * listener is installed on first use for the channel and dispatches to the
 * matching route.
 *
 * @param {string} channel - The IPC channel name.
 * @param {Route} route - The per-window route.
 * @returns {void}
 */
function addSendRoute(channel, route) {
    let entry = sendChannels.get(channel);

    if (!entry) {
        const listener = (event, ...args) => {
            const matched = routeFor(entry.routes, event);

            if (matched) {
                matched.handler(event, ...args);
            }
        };

        entry = { routes: [], listener };
        sendChannels.set(channel, entry);
        ipcMain.on(channel, listener);
    }

    upsert(entry.routes, normalize(route));
}

/**
 * Removes a previously added send route. When the channel has no routes left
 * its `ipcMain.on` listener is removed.
 *
 * @param {string} channel - The IPC channel name.
 * @param {Electron.WebContents} owner - The route's owner identity.
 * @returns {void}
 */
function removeSendRoute(channel, owner) {
    const entry = sendChannels.get(channel);

    if (!entry) {
        return;
    }

    entry.routes = entry.routes.filter(route => route.owner !== owner);

    if (entry.routes.length === 0) {
        ipcMain.removeListener(channel, entry.listener);
        sendChannels.delete(channel);
    }
}

module.exports = {
    addInvokeRoute,
    addSendRoute,
    removeInvokeRoute,
    removeSendRoute
};
